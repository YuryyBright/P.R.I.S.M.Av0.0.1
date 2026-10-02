"""
Celery configuration module for the FastAPI PRISMA project.
This module provides configuration settings for Celery tasks and workers.
"""

import logging
import os
import ssl
from functools import lru_cache
from typing import Any, Dict

from kombu import Queue

from app.core.config import ModeEnum, settings
from app.rag.settings import get_rag_settings


def get_redis_ssl_options() -> Dict[str, Any]:
    """
    Build SSL options for Redis connections in production.

    Returns:
        Dict[str, Any]: Redis SSL configuration options.
    """
    cert_path = os.getenv("REDIS_CERT_PATH", "/app/certs")

    if not os.path.exists(cert_path):
        cert_path = os.path.join(
            os.path.dirname(
                os.path.dirname(
                    os.path.dirname(__file__)
                )
            ),
            "certs",
        )

    ca_cert_path = os.path.join(cert_path, "ca.crt")

    ssl_opts = {
        "ssl_cert_reqs": ssl.CERT_REQUIRED,
        "ssl_ca_certs": ca_cert_path if os.path.exists(ca_cert_path) else None,
        "ssl_check_hostname": True,
    }

    ssl_opts = {
        key: value
        for key, value in ssl_opts.items()
        if value is not None
    }

    if not os.path.exists(ca_cert_path):
        logger = logging.getLogger(__name__)
        logger.warning(
            f"CA certificate not found at {ca_cert_path}. "
            "SSL connections to Redis may fail. "
            "Generate certificates using backend/certs/generate-certs.sh"
        )

    return ssl_opts


def get_celery_config() -> Dict[str, Any]:
    """
    Get Celery configuration dictionary with all necessary settings.

    Returns:
        Dict[str, Any]: Dictionary containing all Celery configuration settings
    """
    task_queues = [
        Queue("default"),
        Queue("high_priority"),
        Queue("low_priority"),
        Queue("emails"),
        Queue("maintenance"),
        Queue("logging"),
        Queue("user_management"),
        Queue("periodic_tasks"),
        Queue(get_rag_settings().ingestion.queue),
    ]

    config = {
        # Broker and Backend
        "broker_url": settings.CELERY_BROKER_URL,
        "result_backend": settings.CELERY_RESULT_BACKEND,

        # Task modules must be imported by the worker process. The API registers
        # them via background_tasks → app.worker; celery -A app.celery_app alone
        # does not load that module, which leaves [tasks] empty and discards work.
        "imports": ("app.worker",),

        # Serialization
        "task_serializer": settings.CELERY_TASK_SERIALIZER,
        "result_serializer": settings.CELERY_RESULT_SERIALIZER,
        "accept_content": settings.CELERY_ACCEPT_CONTENT,

        # Beat Settings
        "beat_scheduler": settings.CELERY_BEAT_SCHEDULER,
        "beat_max_loop_interval": settings.CELERY_BEAT_MAX_LOOP_INTERVAL,

        # Task Settings
        "task_time_limit": settings.CELERY_TASK_TIME_LIMIT,
        "task_soft_time_limit": settings.CELERY_TASK_SOFT_TIME_LIMIT,
        "worker_prefetch_multiplier": settings.CELERY_WORKER_PREFETCH_MULTIPLIER,

        # Queue Configuration
        "task_default_queue": settings.CELERY_TASK_DEFAULT_QUEUE,
        "task_queues": task_queues,
        "task_routes": settings.CELERY_TASK_ROUTES,

        # Task Execution
        "task_always_eager": getattr(
            settings,
            "CELERY_TASK_ALWAYS_EAGER",
            False,
        ),
        "task_eager_propagates": getattr(
            settings,
            "CELERY_TASK_EAGER_PROPAGATES",
            False,
        ),

        # Security and Other Settings
        "security_key": settings.SECRET_KEY,
        "timezone": settings.CELERY_TIMEZONE,

        # Additional Production Settings
        "broker_connection_retry_on_startup": True,
        "broker_pool_limit": None,

        # Task Result Settings
        "task_ignore_result": False,
        "task_track_started": True,
        "task_send_sent_event": True,

        # Worker Settings
        "worker_send_task_events": True,
        "worker_disable_rate_limits": False,

        # Error Handling
        "task_acks_late": True,
        "task_reject_on_worker_lost": True,

        # Retry Settings
        "task_default_retry_delay": 180,
        "task_max_retries": 3,
    }

    if settings.MODE == ModeEnum.production:
        ssl_opts = get_redis_ssl_options()

        config.update(
            {
                "broker_use_ssl": ssl_opts or None,
                "redis_backend_use_ssl": ssl_opts or None,
                "task_default_rate_limit": "10000/m",
                "worker_max_tasks_per_child": 1000,
                "broker_connection_retry": True,
                "broker_connection_retry_on_startup": True,
                "broker_connection_max_retries": 10,
                "broker_pool_limit": 50,
                "broker_heartbeat": 30,
                "broker_heartbeat_checkrate": 2,
            }
        )

    return config


@lru_cache()
def get_cached_celery_config() -> Dict[str, Any]:
    """
    Get cached Celery configuration.

    Uses lru_cache to cache the configuration and avoid repeated lookups.

    Returns:
        Dict[str, Any]: Cached dictionary of Celery configuration settings
    """
    return get_celery_config()