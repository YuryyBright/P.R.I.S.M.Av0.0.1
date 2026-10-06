from fastapi import APIRouter

from app.api.v1.endpoints.ai import ai_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.rag import (
    collections,
    documents,
    jobs,
)
from app.api.v1.endpoints.users import (
    auth,
    dashboard,
    permission,
    permission_group,
    role,
    role_group,
    user,
)

api_router = APIRouter()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

api_router.include_router(
    health_router,
    prefix="",
    tags=["health"],
)


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["auth"],
)


# ---------------------------------------------------------------------------
# Users / RBAC
# ---------------------------------------------------------------------------

api_router.include_router(
    user.router,
    prefix="/users",
    tags=["users"],
)

api_router.include_router(
    role.router,
    prefix="/roles",
    tags=["roles"],
)

api_router.include_router(
    permission.router,
    prefix="/permissions",
    tags=["permissions"],
)

api_router.include_router(
    role_group.router,
    prefix="/role-groups",
    tags=["role-groups"],
)

api_router.include_router(
    permission_group.router,
    prefix="/permission-groups",
    tags=["permission-groups"],
)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

api_router.include_router(
    dashboard.router,
    prefix="/dashboard",
    tags=["dashboard"],
)


# ---------------------------------------------------------------------------
# RAG
# ---------------------------------------------------------------------------

api_router.include_router(collections.router)
api_router.include_router(documents.router)
api_router.include_router(jobs.router)


# ---------------------------------------------------------------------------
# AI
# ---------------------------------------------------------------------------

api_router.include_router(ai_router)