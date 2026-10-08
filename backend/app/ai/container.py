"""DI-контейнер AI: той самий патерн, що RagContainer (ліниві cached_property + _REGISTRY).

ІНВАРІАНТ: ключі _REGISTRY[kind] == значення Literal `backend` у settings.py.
У Celery використовуйте build_ai_container() (клієнти прив'язані до event loop);
в API — init_ai_container() у lifespan startup + close_ai_container() на shutdown.
"""
from __future__ import annotations

from functools import cached_property
from importlib import import_module
from typing import TYPE_CHECKING, Any, Callable

from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.agent.launcher import CeleryLauncher
from app.ai.agent.loop import AgentLoop
from app.ai.agent.tools.registry import ToolRegistry, default_registry
from app.ai.analysis.service import AnalysisOrchestrator
from app.ai.tasks.bus import RedisTaskEventBus, MemoryTaskEventBus
from app.ai.tasks.cancel import RedisTaskCancelStore, MemoryTaskCancelStore
from app.ai.tasks.dispatcher import CeleryTaskDispatcher
from app.ai.tasks.engine import TaskEngine
from app.ai.tasks.ports import TaskCancelStore, TaskEventBus, TaskHandler
from app.ai.tasks.service import TaskService
from app.ai.tasks.handlers import TaskAnalysisHandler
from app.ai.tasks.artifacts import ArtifactService
from app.ai.tasks.checkpoint import DbTaskCheckpointStore
from app.ai.integrations.rag import RagDataSourceResolver
from app.ai.analysis.llm_adapter import RouterAnalysisLLM
from app.ai.chat.launcher import InlineLauncher
from app.ai.chat.pipeline import ChatPipeline
from app.ai.domain.enums import RunMode
from app.ai.domain.ports import CancelStore, EventBus, RunLauncher
from app.ai.llm.registry import ModelRegistry
from app.ai.llm.router import LLMRouter
from app.ai.prompts.service import PromptService
from app.ai.runtime.cancel import MemoryCancelStore, RedisCancelStore
from app.ai.runtime.loader import RunLoader
from app.ai.runtime.recorder import RunRecorder
from app.ai.runtime.runner import RunRunner
from app.ai.services.capabilities_service import CapabilitiesService
from app.ai.services.conversation_service import ConversationService
from app.ai.services.profile_service import ProfileService
from app.ai.services.run_service import RunService
from app.ai.settings import AiSettings, get_ai_settings
from app.rag.container import RagContainer

SessionFactory = Callable[[], AsyncSession]

if TYPE_CHECKING:
    from app.rag.retrieval.service import RetrievalService

_REGISTRY: dict[str, dict[str, str]] = {
    "llm": {"vllm": "app.ai.llm.adapters.vllm:VLLMClient"},
    "bus": {
        "redis": "app.ai.runtime.bus.redis_stream:RedisStreamBus",
        "memory": "app.ai.runtime.bus.memory:MemoryBus",
    },
}


def register(kind: str, name: str, path: str) -> None:
    _REGISTRY.setdefault(kind, {})[name] = path


def _load(kind: str, name: str, cfg: Any) -> Any:
    try:
        module, cls = _REGISTRY[kind][name].split(":")
    except KeyError as e:
        raise ValueError(f"Unknown {kind} backend: {name!r} (registered: {sorted(_REGISTRY.get(kind, {}))})") from e
    return getattr(import_module(module), cls)(cfg)


class AiContainer:
    def __init__(self, session_factory: SessionFactory, settings: AiSettings | None = None,
                 rag: RagContainer | None = None, *, analysis_catalog: Any = None,
                 report_store: Any = None, web_search: Any = None, artifact_store: Any = None,
                 data_source_resolver: Any = None) -> None:
        self.session_factory = session_factory
        self.settings = settings or get_ai_settings()
        self.rag = rag or RagContainer()
        self.analysis_catalog = analysis_catalog
        self.report_store = report_store
        self.web_search = web_search
        self.artifact_store = artifact_store
        self.data_source_resolver = data_source_resolver

    # ---- інфраструктура ----------------------------------------------------------

    @cached_property
    def models(self) -> ModelRegistry:
        return ModelRegistry(self.settings)

    @cached_property
    def llm(self) -> LLMRouter:
        clients = {name: _load("llm", p.backend, p) for name, p in self.settings.providers.items()}
        return LLMRouter(self.models, clients)

    @cached_property
    def bus(self) -> EventBus:
        return _load("bus", self.settings.bus.backend, self.settings.bus)

    @cached_property
    def cancel(self) -> CancelStore:
        redis = getattr(self.bus, "redis", None)
        if redis is not None:
            return RedisCancelStore(redis, self.settings.bus.cancel_ttl_s)
        return MemoryCancelStore()

    # ---- rag-інтеграція ------------------------------------------------------------

    @cached_property
    def retrieval(self) -> RetrievalService:
        from app.rag.retrieval.service import RetrievalService
        r = self.rag
        return RetrievalService(session_factory=self.session_factory, vector_store=r.vector_store,
                                embedder=r.embedder, sparse=r.sparse, reranker=r.reranker,
                                settings=r.settings)

    # ---- AI-сервіси ------------------------------------------------------------------

    @cached_property
    def prompts(self) -> PromptService:
        return PromptService(self.session_factory, self.settings.prompts)

    @cached_property
    def analyzer(self) -> AnalysisOrchestrator | None:
        if self.analysis_catalog is None:
            return None
        return AnalysisOrchestrator(self.analysis_catalog, RouterAnalysisLLM(self.llm, self.settings.default_model), checkpoint_store=DbTaskCheckpointStore(self.session_factory))

    @cached_property
    def tools(self) -> ToolRegistry:
        return default_registry(
            self.retrieval, allow_write=self.settings.agent.allow_write_tools,
            catalog=self.analysis_catalog, analyzer=self.analyzer,
            report_store=self.report_store, web_search=self.web_search, task_service_factory=lambda: self.task_service)

    @cached_property
    def runner(self) -> RunRunner:
        loader = RunLoader(session_factory=self.session_factory, settings=self.settings,
                           prompts=self.prompts, retrieval=self.retrieval)
        return RunRunner(
            session_factory=self.session_factory, settings=self.settings, bus=self.bus,
            cancel=self.cancel, loader=loader, recorder=RunRecorder(self.session_factory),
            executors={RunMode.CHAT: ChatPipeline(self.llm, self.retrieval),
                       RunMode.AGENT: AgentLoop(self.llm, self.tools)})

    @cached_property
    def inline_launcher(self) -> InlineLauncher:
        return InlineLauncher(self.runner.execute)

    @cached_property
    def launchers(self) -> dict[RunMode, RunLauncher]:
        return {RunMode.CHAT: self.inline_launcher, RunMode.AGENT: CeleryLauncher(self.session_factory)}

    @cached_property
    def run_service(self) -> RunService:
        return RunService(session_factory=self.session_factory, settings=self.settings,
                          registry=self.models, prompts=self.prompts, tools=self.tools,
                          retrieval=self.retrieval, launchers=self.launchers, cancel=self.cancel)

    @cached_property
    def conversation_service(self) -> ConversationService:
        return ConversationService(self.session_factory)

    @cached_property
    def profile_service(self) -> ProfileService:
        return ProfileService(self.session_factory, self.tools, self.models)


    @cached_property
    def task_bus(self) -> TaskEventBus:
        return MemoryTaskEventBus() if self.settings.bus.backend == "memory" else RedisTaskEventBus(self.settings.bus)

    @cached_property
    def task_cancel(self) -> TaskCancelStore:
        redis=getattr(self.task_bus,"redis",None)
        return RedisTaskCancelStore(redis,self.settings.bus.cancel_ttl_s) if redis is not None else MemoryTaskCancelStore()

    @cached_property
    def artifact_service(self) -> ArtifactService | None:
        if self.artifact_store is None: return None
        return ArtifactService(self.session_factory,self.artifact_store)

    @cached_property
    def task_engine(self) -> TaskEngine:
        handlers: dict[str, TaskHandler] = {}
        if self.analyzer is not None:
            handlers["analysis"]=TaskAnalysisHandler(self.analyzer,artifact_service=self.artifact_service)
        return TaskEngine(self.session_factory,bus=self.task_bus,cancel_store=self.task_cancel,handlers=handlers)

    @cached_property
    def task_service(self) -> TaskService:
        resolver=self.data_source_resolver or (RagDataSourceResolver(self.analysis_catalog) if self.analysis_catalog is not None else None)
        return TaskService(
            self.session_factory,
            bus=self.task_bus,
            cancel_store=self.task_cancel,
            source_resolver=resolver,
            dispatcher=CeleryTaskDispatcher(self.settings.tasks.queue),
        )

    @cached_property
    def capabilities_service(self) -> CapabilitiesService:
        return CapabilitiesService(session_factory=self.session_factory, settings=self.settings,
                                   registry=self.models, tools=self.tools, retrieval=self.retrieval,
                                   rag_settings=self.rag.settings)

    # ---- lifecycle -------------------------------------------------------------------

    async def startup(self) -> None:
        """Lifespan startup API: індекс Qdrant + синхронізація системних промптів."""
        from app.ai.prompts.sync import sync_system_prompts
        emb = self.rag.settings.embedding
        await self.rag.vector_store.ensure(emb.dim, sparse=self.rag.sparse is not None)
        await sync_system_prompts(self.session_factory)

    async def aclose(self) -> None:
        inline = self.__dict__.get("inline_launcher")
        if inline is not None:
            await inline.aclose()               # спершу даємо inline-run-ам завершитись
        for name in ("llm", "bus", "task_bus"):
            comp = self.__dict__.get(name)
            close = getattr(comp, "aclose", None)
            if close is not None:
                await close()
        await self.rag.aclose()


def build_ai_container(session_factory: SessionFactory, settings: AiSettings | None = None,
                       rag: RagContainer | None = None, **kwargs: Any) -> AiContainer:
    return AiContainer(session_factory, settings, rag, **kwargs)


_container: AiContainer | None = None


def init_ai_container(session_factory: SessionFactory) -> AiContainer:
    global _container
    _container = AiContainer(session_factory)
    return _container


def get_ai_container() -> AiContainer:
    """FastAPI dependency (API-процес)."""
    if _container is None:
        raise RuntimeError("AI container is not initialised: call init_ai_container() in lifespan")
    return _container


async def close_ai_container() -> None:
    global _container
    if _container is not None:
        await _container.aclose()
        _container = None
