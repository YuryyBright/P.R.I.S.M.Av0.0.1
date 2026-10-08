"""
Service configuration for environment-specific settings.
Manages Redis, Celery, and other service configurations.
"""

from typing import Any, Dict
from app.core.config import ModeEnum, settings
from app.core.redis_config import build_redis_url


class ServiceSettings:
    """
    Environment-specific service settings for Celery,
    Redis, and other external services.
    """

    def __init__(self) -> None:
        self.mode = settings.MODE

    @property
    def redis_url(self) -> str:
        """
        Get the Redis URL based on current environment.

        For production, uses rediss:// (SSL) with proper certificate validation.
        For development and testing, uses redis:// without SSL unless explicitly enabled.

        The returned URL is compatible with redis-py's from_url() method but should
        ideally be used with RedisConnectionFactory for better SSL handling.
        """
        return build_redis_url(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD,
            db=settings.REDIS_DB,
            ssl_enabled=settings.redis_ssl_enabled,
            cert_path=settings.REDIS_CERT_PATH,
            check_hostname=settings.redis_ssl_hostname_check_enabled,
            production=self.mode == ModeEnum.production,
        )

    @property
    def celery_broker_url(self) -> str:
        """
        Get the Celery broker URL based on current environment
        """
        return self.redis_url

    @property
    def celery_result_backend(self) -> str:
        """
        Get the Celery result backend URL based on current environment
        """
        return self.redis_url

    @property
    def use_celery(self) -> bool:
        """
        Determine whether to use Celery based on environment
        """
        return self.mode in [ModeEnum.development, ModeEnum.production]

    @property
    def email_settings(self) -> Dict[str, Any]:
        """
        Get email configuration based on environment
        """
        return {
            "SMTP_HOST": settings.SMTP_HOST,
            "SMTP_PORT": settings.SMTP_PORT,
            "SMTP_TLS": settings.SMTP_TLS,
            "SMTP_USER": settings.SMTP_USER,
            "SMTP_PASSWORD": settings.SMTP_PASSWORD,
        }

    @property
    def database_url(self) -> str:
        """
        Get database URL based on environment
        """
        return (
            str(settings.ASYNC_DATABASE_URI)
            .replace("+asyncpg", "")
            .replace("+aiosqlite", "")
        )


# Global instance
service_settings = ServiceSettings()
