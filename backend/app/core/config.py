import json
import os
import secrets
from enum import Enum
from functools import lru_cache
from typing import Annotated, Any, Dict, List, Optional, Union

from pydantic import (
    AnyHttpUrl,
    EmailStr,
    Field,
    PostgresDsn,
    ValidationInfo,
    field_validator,
    model_validator,
)
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from pydantic_settings.sources import PydanticBaseSettingsSource
from app.core.env_settings import get_project_root, settings_customise_sources
from app.core.redis_config import build_redis_url


# Get project root path
project_root = get_project_root()

class ModeEnum(str, Enum):
    development = "development"
    production = "production"
    testing = "testing"


class DatabaseTypeEnum(str, Enum):
    sqlite = "sqlite"
    postgresql = "postgresql"


class Settings(BaseSettings):
    # Core Settings
    MODE: ModeEnum = ModeEnum.development
    API_VERSION: str = "v1"
    API_V1_STR: str = f"/api/{API_VERSION}"
    PROJECT_NAME: Optional[str] = "FastAPI PRISMA"
    DEBUG: bool = False

    # Security Settings
    SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_REFRESH_SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_RESET_SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_VERIFICATION_SECRET_KEY: str = secrets.token_urlsafe(32)
    ENCRYPT_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"  # Added JWT Algorithm
    BACKEND_CORS_ORIGINS: List[Union[str, AnyHttpUrl]] = [
        "http://localhost:3000",
        "http://localhost:80",
    ]

    # Frontend URL. The links that go out in email are derived from this after
    # the environment loads, by derive_frontend_urls below. They are empty here
    # rather than f-strings over FRONTEND_URL: a default assigned in the class
    # body captures the default FRONTEND_URL as the class body executes, so an
    # environment override never reached it.
    FRONTEND_URL: str = "http://localhost:5173"
    PASSWORD_RESET_URL: str = ""

    # Database Type Setting
    DATABASE_TYPE: DatabaseTypeEnum = DatabaseTypeEnum.postgresql

    # Token Settings
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 1  # 1 hour
    REFRESH_TOKEN_EXPIRE_MINUTES: int = Field(default=60 * 24 * 100, gt=0)
    # Backward-compatible input alias. Minutes remain the runtime source of truth.
    REFRESH_TOKEN_EXPIRE_DAYS: int | None = Field(default=None, gt=0)
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = Field(default=30)
    # Single source of truth for how long a verification link works: the Redis
    # TTL that /verify-email enforces, the JWT exp, and the duration stated in
    # the email all read this. A second setting drove the last two and silently
    # over-promised by 7x (#182).
    VERIFICATION_TOKEN_EXPIRE_MINUTES: int = Field(default=1440)  # 24 hours
    UNVERIFIED_ACCOUNT_CLEANUP_HOURS: int = Field(default=72)  # 3 days
    MAX_LOGIN_ATTEMPTS: int = Field(default=5)
    PASSWORD_HISTORY_SIZE: int = Field(default=5)  # Number of old passwords to store
    PREVENT_PASSWORD_REUSE: int = Field(default=5)  # Number of recent passwords to check against
    TOKEN_ISSUER: Optional[str] = None  # Added
    TOKEN_AUDIENCE: Optional[str] = None  # Added

    # Refresh token HttpOnly cookie (first-party SPA; see ADR 0006)
    REFRESH_TOKEN_COOKIE_NAME: str = "refresh_token"
    REFRESH_COOKIE_DOMAIN: Optional[str] = None  # e.g. ".example.com" in production
    # None = Secure only when MODE=production (localhost HTTP needs Secure=false)
    REFRESH_COOKIE_SECURE: Optional[bool] = None
    REFRESH_COOKIE_SAMESITE: str = "lax"  # lax | strict | none (none requires Secure)

    # Email settings
    EMAILS_ENABLED: bool = Field(default=False)
    SMTP_TLS: bool = True
    SMTP_HOST: str | None = None
    SMTP_PORT: int | None = None
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    EMAILS_FROM_EMAIL: str = "info@prisma.com"
    EMAILS_FROM_NAME: str = "FastAPI PRISMA"
    EMAIL_TEMPLATES_DIR: str = os.path.join(project_root, "app", "email-templates")

    # Database Settings
    DATABASE_USER: Optional[str] = None
    DATABASE_PASSWORD: Optional[str] = None
    DATABASE_HOST: Optional[str] = None
    DATABASE_PORT: Optional[int] = None
    DATABASE_NAME: str = "fastapi_db"
    DATABASE_CELERY_NAME: str = "celery_schedule_jobs"
    SQLITE_DB_PATH: Optional[str] = None
    POSTGRES_URL: Optional[str] = None
    SQLALCHEMY_DATABASE_URI: Optional[str] = None
    SUPABASE_URL: Optional[str] = None
    SUPABASE_JWT_SECRET: Optional[str] = None
    DB_POOL_SIZE: int = Field(default=83, gt=0)
    WEB_CONCURRENCY: int = Field(default=9, gt=0)
    POOL_SIZE: int = Field(default=5, gt=0)
    ASYNC_DATABASE_URI: PostgresDsn | str = ""

    # Redis Settings
    REDIS_HOST: Optional[str] = None
    REDIS_PORT: Optional[int] = None
    REDIS_PASSWORD: Optional[str] = None
    REDIS_DB: int = Field(default=0, ge=0)
    REDIS_SSL: Optional[bool] = None
    REDIS_CERT_PATH: str = "/app/certs"
    REDIS_SSL_CHECK_HOSTNAME: Optional[bool] = None

    # PgAdmin settings
    PGADMIN_DEFAULT_EMAIL: EmailStr = "admin@example.com"
    PGADMIN_DEFAULT_PASSWORD: str = "admin"  # User Settings
    FIRST_SUPERUSER_EMAIL: EmailStr = "admin@example.com"
    FIRST_SUPERUSER_PASSWORD: str = "admin123"
    USER_CHANGED_PASSWORD_DATE: Optional[str] = None
    USERS_OPEN_REGISTRATION: bool = False

    # Email Verification Settings
    # The link's lifetime is VERIFICATION_TOKEN_EXPIRE_MINUTES above, not here.
    # Derived from FRONTEND_URL; see derive_frontend_urls.
    EMAIL_VERIFICATION_URL: str = ""

    # Admin User Creation Settings
    ADMIN_CREATED_USERS_AUTO_VERIFIED: bool = True  # Auto-verify admin-created users
    ADMIN_CREATED_USERS_SEND_EMAIL: bool = False  # Send verification email to admin-created users

    # Logging settings
    LOG_LEVEL: str = "INFO"

    # Feature Flags
    ENABLE_ACCOUNT_LOCKOUT: bool = True
    ACCOUNT_LOCKOUT_MINUTES: int = 60 * 24  # 24 hours

    # Registration Security Settings
    MAX_REGISTRATION_ATTEMPTS_PER_HOUR: int = 5
    MAX_REGISTRATION_ATTEMPTS_PER_EMAIL: int = 3
    # Backward-compatible alias for UNVERIFIED_ACCOUNT_CLEANUP_HOURS.
    UNVERIFIED_ACCOUNT_CLEANUP_DELAY_HOURS: int | None = Field(default=None, gt=0)
    EMAIL_DOMAIN_BLACKLIST: List[str] = []
    EMAIL_DOMAIN_ALLOWLIST: List[str] = []  # Empty means all domains allowed

    # Enhanced Security Settings
    PASSWORD_MIN_LENGTH: int = 12  # NIST recommends at least 8, we use 12
    PASSWORD_MAX_LENGTH: int = 128  # Reasonable maximum length
    PASSWORD_REQUIRE_UPPERCASE: bool = True  # At least one uppercase letter
    PASSWORD_REQUIRE_LOWERCASE: bool = True  # At least one lowercase letter
    PASSWORD_REQUIRE_DIGITS: bool = True  # At least one digit
    PASSWORD_REQUIRE_SPECIAL: bool = True  # At least one special character
    PASSWORD_SPECIAL_CHARS: str = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    PASSWORD_HASHING_ITERATIONS: int = 12  # bcrypt work factor (12 is good balance)
    COMMON_PASSWORDS: List[str] = [  # List of commonly used passwords to prevent
        "password",
        "123456",
        "qwerty",
        "abc123",
        "letmein",
        "admin",
        "welcome",
        "monkey",
        "password1",
        "123456789",
        "football",
        "000000",
        "qwerty123",
        "1234567",
        "123123",
        "12345678",
        "dragon",
        "baseball",
        "abc123",
        "football",
        "monkey",
        "letmein",
        "shadow",
        "master",
        "666666",
        "qwertyuiop",
        "123321",
        "mustang",
        "123456",
        "michael",
        "superman",
        "princess",
        "password1",
        "123qwe",
        "password123",
    ]
    PREVENT_COMMON_PASSWORDS: bool = True  # Prevent use of common passwords
    PREVENT_SEQUENTIAL_CHARS: bool = True  # Prevent use of sequential characters (e.g., abc, 123)
    PASSWORD_PEPPER: Optional[str] = None  # Optional pepper for password hashing
    PREVENT_REPEATED_CHARS: bool = True  # Prevent use of too many repeated characters

    # Account Security Settings
    MAX_PASSWORD_CHANGE_ATTEMPTS: int = 3  # Maximum password change attempts per hour
    # Backward-compatible seconds alias; lockout code uses minutes.
    ACCOUNT_LOCKOUT_DURATION: int | None = Field(default=None, gt=0)
    REQUIRE_PASSWORD_CHANGE_DAYS: int = 90  # Force password change every 90 days
    ENABLE_BRUTE_FORCE_PROTECTION: bool = True
    BRUTE_FORCE_TIME_WINDOW: int = 3600  # 1 hour window for attempt counting
    PASSWORD_MIN_AGE_HOURS: int = 24  # Minimum time between password changes
    LOGIN_HISTORY_DAYS: int = 90  # Keep login history for 90 days

    # Session Security
    REQUIRE_MFA_AFTER_INACTIVITY: bool = True
    INACTIVITY_TIMEOUT: int = 1800  # 30 minutes of inactivity
    CONCURRENT_SESSION_LIMIT: int = 5  # Maximum concurrent sessions

    # Celery Configuration
    CELERY_BROKER_URL: str = "redis://{REDIS_HOST}:{REDIS_PORT}/0"
    CELERY_RESULT_BACKEND: str = "redis://{REDIS_HOST}:{REDIS_PORT}/0"

    # Celery Task Settings
    CELERY_TASK_SERIALIZER: str = "json"
    CELERY_RESULT_SERIALIZER: str = "json"
    CELERY_ACCEPT_CONTENT: List[str] = ["json"]
    CELERY_TIMEZONE: str = "UTC"  # Celery Beat Settings
    CELERY_BEAT_SCHEDULER: str = "celery.beat:PersistentScheduler"
    CELERY_BEAT_MAX_LOOP_INTERVAL: int = 5

    # Task Queue Settings
    CELERY_TASK_DEFAULT_QUEUE: str = "default"
    CELERY_TASK_DEFAULT_EXCHANGE: str = "default"
    CELERY_TASK_DEFAULT_ROUTING_KEY: str = "default"

    # Task Execution Settings
    CELERY_TASK_TIME_LIMIT: int = 5 * 60  # 5 minutes
    CELERY_TASK_SOFT_TIME_LIMIT: int = 60  # 1 minute
    CELERY_WORKER_PREFETCH_MULTIPLIER: int = 1

    # Task Routing Configuration
    CELERY_TASK_ROUTES: Dict[str, Dict[str, str]] = {
        "app.tasks.high_priority.*": {
            "queue": "high_priority",
            "routing_key": "high_priority",
        },
        "app.tasks.low_priority.*": {
            "queue": "low_priority",
            "routing_key": "low_priority",
        },
    }

    CELERY_TASK_QUEUES: List[Dict[str, Any]] = [
        {
            "name": "default",
            "exchange": "default",
            "routing_key": "default",
        },
        {
            "name": "high_priority",
            "exchange": "high_priority",
            "routing_key": "high_priority",
        },
        {
            "name": "low_priority",
            "exchange": "low_priority",
            "routing_key": "low_priority",
        },
    ]

    # Rate Limiting and Security Settings
    MAX_VERIFICATION_ATTEMPTS_PER_HOUR: int = 5
    VERIFICATION_COOLDOWN_SECONDS: int = 300  # 5 minutes between attempts
    RATE_LIMIT_PERIOD_SECONDS: int = 3600  # 1 hour for rate limiting window
    # ADDED missing settings for resend verification email rate limits
    MAX_RESEND_VERIFICATION_ATTEMPTS_PER_HOUR: int = 3
    RATE_LIMIT_PERIOD_RESEND_VERIFICATION_SECONDS: int = 3600

    # Single per-address budget for verification-bearing mail (#113). Registration
    # and resend-verification previously kept separate buckets, so alternating
    # between them allowed 3 + 3 emails per hour at one address. Both endpoints
    # now share this one.
    MAX_ACCOUNT_EMAILS_PER_ADDRESS_PER_HOUR: int = 3
    ACCOUNT_EMAIL_RATE_LIMIT_PERIOD_SECONDS: int = 3600
    # Minimum response time for registration and resend-verification. A floor
    # rather than a sleep on selected branches: a hand-placed pad goes stale as
    # soon as a branch is added, which is how the old one stopped covering.
    UNIFORM_ACCOUNT_RESPONSE_FLOOR_SECONDS: float = 0.5

    # Token Security
    ACCESS_TOKEN_ENTROPY_BITS: int = 256  # Entropy for token generation
    VERIFY_TOKEN_ON_EVERY_REQUEST: bool = True
    TOKEN_VERSION_ON_PASSWORD_CHANGE: bool = True  # Invalidate tokens on password change
    # Origin-network anomaly detection, not IP binding (ADR 0011 decision 5, #69).
    # The address a session was established from is recorded with its allowlist
    # entry; a refresh presented from a different /24 (IPv4) or /64 (IPv6) revokes
    # that one session. Access tokens are never checked, no request is blocked
    # outright, and the user's other sessions survive. Behind a reverse proxy this
    # sees real client addresses only once forwarded headers are trusted (#203).
    VALIDATE_TOKEN_IP: bool = True
    # Peers whose X-Forwarded-For / X-Real-IP headers are believed (ADR 0011
    # decision 8, #203). Addresses or CIDR networks, JSON list or comma-separated.
    # Defaults to loopback: a deployment that puts the app behind a proxy on
    # another host or container must name that proxy or its network. A wildcard
    # is rejected -- see app.utils.client_address.
    TRUSTED_PROXIES: Annotated[List[str], NoDecode] = ["127.0.0.1", "::1"]

    @property
    def redis_ssl_enabled(self) -> bool:
        if self.REDIS_SSL is not None:
            return self.REDIS_SSL
        return self.MODE == ModeEnum.production

    @property
    def redis_ssl_hostname_check_enabled(self) -> bool:
        if self.REDIS_SSL_CHECK_HOSTNAME is not None:
            return self.REDIS_SSL_CHECK_HOSTNAME
        return self.MODE == ModeEnum.production

    # Rate Limiting and Security Settings
    # MAX_VERIFICATION_ATTEMPTS_PER_HOUR: int = 5
    # VERIFICATION_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    # VERIFICATION_COOLDOWN_SECONDS: int = 300  # 5 minutes between attempts
    # RATE_LIMIT_PERIOD_SECONDS: int = 3600  # 1 hour for rate limiting window

    # Registration Security Settings
    # MAX_REGISTRATION_ATTEMPTS_PER_HOUR: int = 5
    # MAX_REGISTRATION_ATTEMPTS_PER_EMAIL: int = 3
    # UNVERIFIED_ACCOUNT_CLEANUP_HOURS: int = 24
    # EMAIL_DOMAIN_BLACKLIST: List[str] = []
    # EMAIL_DOMAIN_ALLOWLIST: List[str] = []

    @field_validator("BACKEND_CORS_ORIGINS")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        elif isinstance(v, str):
            return [v]
        raise ValueError(v)

    @field_validator("TRUSTED_PROXIES", mode="before")
    def split_trusted_proxies(cls, v: Any) -> Any:
        """Accept both env forms: a JSON list, and a bare comma-separated list.

        The field is ``NoDecode`` so this runs on the raw environment string.
        Without it, ``TRUSTED_PROXIES=172.16.0.0/12`` -- the form an operator
        reaches for first -- fails to boot with a JSON parse error naming
        neither the value nor the fix.
        """
        from app.utils.client_address import split_entries

        if isinstance(v, str):
            text = v.strip()
            return json.loads(text) if text.startswith("[") else split_entries(text)
        return v

    @field_validator("REDIS_PASSWORD", mode="before")
    @classmethod
    def ignore_password_placeholder(cls, value: Any) -> Any:
        """Treat an inline dotenv comment as an unset optional password."""
        if isinstance(value, str) and value.lstrip().startswith("# Optional:"):
            return None
        return value

    @field_validator("TRUSTED_PROXIES", mode="after")
    def validate_trusted_proxies(cls, v: List[str]) -> List[str]:
        """Fail at startup on a wildcard or a typo rather than per request.

        Parsing lives in ``app.utils.client_address`` so the middleware and this
        check cannot disagree about what a trusted proxy is.
        """
        from app.utils.client_address import parse_trusted_proxies

        parse_trusted_proxies(v)
        return v

    @field_validator("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD")
    def set_email_values_based_on_mode(cls, v: Any, info: ValidationInfo) -> Any:
        mode = info.data.get("MODE", ModeEnum.development)
        field_name = info.field_name

        # Default values for development mode
        if mode == ModeEnum.development:
            if field_name == "SMTP_HOST" and not v:
                return "fastapi_mailhog"
            elif field_name == "SMTP_PORT" and not v:
                return 1025
            elif field_name in ["SMTP_USER", "SMTP_PASSWORD"] and not v:
                return ""

        # For production, these fields should be provided
        if mode == ModeEnum.production and not v and field_name in ["SMTP_HOST", "SMTP_PORT"]:
            raise ValueError(f"{field_name} must be set in production mode")

        return v

    @field_validator("ASYNC_DATABASE_URI", mode="after")
    def assemble_db_connection(cls, v: str | None, info: ValidationInfo) -> Any:
        if isinstance(v, str) and v == "":
            db_type = info.data.get("DATABASE_TYPE", DatabaseTypeEnum.postgresql)

            if db_type == DatabaseTypeEnum.sqlite:
                sqlite_path = info.data.get("SQLITE_DB_PATH")
                if not sqlite_path:
                    sqlite_path = os.path.join(project_root, "app.db")
                return f"sqlite+aiosqlite:///{sqlite_path}"
            else:
                # Check if we have a full Postgres URL (Supabase style)
                postgres_url = info.data.get("POSTGRES_URL")
                if postgres_url:
                    # Parse the existing URL and modify it to use asyncpg
                    return postgres_url.replace("postgres://", "postgresql+asyncpg://")

                # Fallback to building the URL from components
                return PostgresDsn.build(
                    scheme="postgresql+asyncpg",
                    username=info.data.get("DATABASE_USER"),
                    password=info.data.get("DATABASE_PASSWORD"),
                    host=info.data.get("DATABASE_HOST"),
                    port=info.data.get("DATABASE_PORT"),
                    path=info.data.get("DATABASE_NAME"),
                )
        return v

    SYNC_CELERY_DATABASE_URI: PostgresDsn | str = ""

    @field_validator("SYNC_CELERY_DATABASE_URI", mode="after")
    def assemble_celery_db_connection(cls, v: str | None, info: ValidationInfo) -> Any:
        if isinstance(v, str) and v == "":
            db_type = info.data.get("DATABASE_TYPE", DatabaseTypeEnum.postgresql)

            if db_type == DatabaseTypeEnum.sqlite:
                sqlite_path = info.data.get("SQLITE_DB_PATH")
                if not sqlite_path:
                    sqlite_path = os.path.join(
                        project_root,
                        f"{info.data.get('DATABASE_CELERY_NAME', 'celery')}.db",
                    )
                return f"sqlite:///{sqlite_path}"
            else:
                # PostgreSQL connection
                return PostgresDsn.build(
                    scheme="postgresql+psycopg2",
                    username=info.data.get("DATABASE_USER"),
                    password=info.data.get("DATABASE_PASSWORD"),
                    host=info.data.get("DATABASE_HOST"),
                    port=info.data.get("DATABASE_PORT"),
                    path=info.data.get("DATABASE_CELERY_NAME"),
                )
        return v

    SYNC_CELERY_BEAT_DATABASE_URI: PostgresDsn | str = ""

    @field_validator("SYNC_CELERY_BEAT_DATABASE_URI", mode="after")
    def assemble_celery_beat_db_connection(cls, v: str | None, info: ValidationInfo) -> Any:
        if isinstance(v, str) and v == "":
            db_type = info.data.get("DATABASE_TYPE", DatabaseTypeEnum.postgresql)

            if db_type == DatabaseTypeEnum.sqlite:
                sqlite_path = info.data.get("SQLITE_DB_PATH")
                if not sqlite_path:
                    sqlite_path = os.path.join(
                        project_root,
                        f"{info.data.get('DATABASE_CELERY_NAME', 'celery')}.db",
                    )
                return f"sqlite:///{sqlite_path}"
            else:
                # PostgreSQL connection
                return PostgresDsn.build(
                    scheme="postgresql+psycopg2",
                    username=info.data.get("DATABASE_USER"),
                    password=info.data.get("DATABASE_PASSWORD"),
                    host=info.data.get("DATABASE_HOST"),
                    port=info.data.get("DATABASE_PORT"),
                    path=info.data.get("DATABASE_CELERY_NAME"),
                )
        return v

    ASYNC_CELERY_BEAT_DATABASE_URI: PostgresDsn | str = ""

    @field_validator("ASYNC_CELERY_BEAT_DATABASE_URI", mode="after")
    def assemble_async_celery_beat_db_connection(cls, v: str | None, info: ValidationInfo) -> Any:
        if isinstance(v, str) and v == "":
            db_type = info.data.get("DATABASE_TYPE", DatabaseTypeEnum.postgresql)

            if db_type == DatabaseTypeEnum.sqlite:
                sqlite_path = info.data.get("SQLITE_DB_PATH")
                if not sqlite_path:
                    sqlite_path = os.path.join(
                        project_root,
                        f"{info.data.get('DATABASE_CELERY_NAME', 'celery')}.db",
                    )
                return f"sqlite+aiosqlite:///{sqlite_path}"
            else:
                # PostgreSQL connection
                return PostgresDsn.build(
                    scheme="postgresql+asyncpg",
                    username=info.data.get("DATABASE_USER"),
                    password=info.data.get("DATABASE_PASSWORD"),
                    host=info.data.get("DATABASE_HOST"),
                    port=info.data.get("DATABASE_PORT"),
                    path=info.data.get("DATABASE_CELERY_NAME"),
                )
        return v

    def get_celery_redis_url(self) -> str:
        """Build Redis URL for Celery broker and backend"""
        return build_redis_url(
            host=self.REDIS_HOST,
            port=self.REDIS_PORT,
            password=self.REDIS_PASSWORD,
            db=self.REDIS_DB,
            ssl_enabled=self.redis_ssl_enabled,
            cert_path=self.REDIS_CERT_PATH,
            check_hostname=self.redis_ssl_hostname_check_enabled,
            production=self.MODE == ModeEnum.production,
        )

    @field_validator("CELERY_BROKER_URL", "CELERY_RESULT_BACKEND", mode="after")
    def assemble_redis_urls(cls, v: str, info: ValidationInfo) -> str:
        if isinstance(v, str) and "{" in v:  # If it's a template string
            mode = info.data.get("MODE", ModeEnum.development)
            configured_ssl = info.data.get("REDIS_SSL")
            ssl_enabled = (
                mode == ModeEnum.production
                if configured_ssl is None
                else configured_ssl
            )
            configured_hostname_check = info.data.get("REDIS_SSL_CHECK_HOSTNAME")
            check_hostname = (
                mode == ModeEnum.production
                if configured_hostname_check is None
                else configured_hostname_check
            )
            return build_redis_url(
                host=info.data.get("REDIS_HOST"),
                port=info.data.get("REDIS_PORT"),
                password=info.data.get("REDIS_PASSWORD"),
                db=info.data.get("REDIS_DB", 0),
                ssl_enabled=ssl_enabled,
                cert_path=info.data.get("REDIS_CERT_PATH", "/app/certs"),
                check_hostname=check_hostname,
                production=mode == ModeEnum.production,
            )
        return v

    @model_validator(mode="after")
    def derive_frontend_urls(self) -> "Settings":
        """Point the emailed links at wherever the admin_frontend actually is.

        PASSWORD_RESET_URL and EMAIL_VERIFICATION_URL used to be assigned in the
        class body as f-strings over FRONTEND_URL. That binds the *default*
        FRONTEND_URL at class-definition time, so overriding FRONTEND_URL in the
        environment left them pointing at localhost:5173 -- and .env.production
        does not set PASSWORD_RESET_URL at all, so production password-reset
        emails carried a localhost link nobody could follow.

        Deriving here instead means one setting decides where mail points.

        An explicit value still wins: model_fields_set holds only the fields a
        source actually supplied, so a deployment needing a link on a different
        host than FRONTEND_URL can still set one.
        """
        base = self.FRONTEND_URL.rstrip("/")
        if "PASSWORD_RESET_URL" not in self.model_fields_set or not self.PASSWORD_RESET_URL:
            self.PASSWORD_RESET_URL = f"{base}/reset-password"
        if "EMAIL_VERIFICATION_URL" not in self.model_fields_set or not self.EMAIL_VERIFICATION_URL:
            self.EMAIL_VERIFICATION_URL = f"{base}/verify-email"
        return self

    @model_validator(mode="after")
    def normalize_refresh_token_lifetime(self) -> "Settings":
        """Keep legacy day-based config in sync with the canonical minute value."""
        minutes_were_set = "REFRESH_TOKEN_EXPIRE_MINUTES" in self.model_fields_set
        if not minutes_were_set and self.REFRESH_TOKEN_EXPIRE_DAYS is not None:
            self.REFRESH_TOKEN_EXPIRE_MINUTES = self.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60
        self.REFRESH_TOKEN_EXPIRE_DAYS = (self.REFRESH_TOKEN_EXPIRE_MINUTES + 1439) // 1440
        return self

    @model_validator(mode="after")
    def normalize_legacy_duration_settings(self) -> "Settings":
        """Normalize deprecated duration aliases to the active settings."""
        cleanup_hours_were_set = "UNVERIFIED_ACCOUNT_CLEANUP_HOURS" in self.model_fields_set
        cleanup_alias = self.UNVERIFIED_ACCOUNT_CLEANUP_DELAY_HOURS
        cleanup_alias_was_set = (
            "UNVERIFIED_ACCOUNT_CLEANUP_DELAY_HOURS" in self.model_fields_set
            and cleanup_alias is not None
        )
        if not cleanup_hours_were_set and cleanup_alias_was_set and cleanup_alias is not None:
            self.UNVERIFIED_ACCOUNT_CLEANUP_HOURS = cleanup_alias
        self.UNVERIFIED_ACCOUNT_CLEANUP_DELAY_HOURS = self.UNVERIFIED_ACCOUNT_CLEANUP_HOURS

        lockout_minutes_were_set = "ACCOUNT_LOCKOUT_MINUTES" in self.model_fields_set
        lockout_alias = self.ACCOUNT_LOCKOUT_DURATION
        lockout_alias_was_set = (
            "ACCOUNT_LOCKOUT_DURATION" in self.model_fields_set
            and lockout_alias is not None
        )
        if not lockout_minutes_were_set and lockout_alias_was_set and lockout_alias is not None:
            self.ACCOUNT_LOCKOUT_MINUTES = (lockout_alias + 59) // 60
        self.ACCOUNT_LOCKOUT_DURATION = self.ACCOUNT_LOCKOUT_MINUTES * 60
        return self

    @model_validator(mode="after")
    def derive_pool_size(self) -> "Settings":
        """Derive the default pool size after environment overrides are loaded."""
        if "POOL_SIZE" not in self.model_fields_set:
            self.POOL_SIZE = max(self.DB_POOL_SIZE // self.WEB_CONCURRENCY, 5)
        return self

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        """Validate that critical settings are properly set in production mode"""
        if self.MODE == ModeEnum.production:
            # Ensure critical settings are set for production
            assert self.SECRET_KEY != "development_secret", "Change the SECRET_KEY for production"
            assert len(self.SECRET_KEY) >= 32, "SECRET_KEY should be at least 32 characters in production"

            # Validate database configuration if using PostgreSQL
            if self.DATABASE_TYPE == DatabaseTypeEnum.postgresql:
                assert self.DATABASE_HOST != "localhost", "Use a proper DATABASE_HOST in production"

            # Validate security settings
            assert (
                self.JWT_REFRESH_SECRET_KEY is not None
            ), "JWT_REFRESH_SECRET_KEY must be set in .env for production mode"
            assert (
                len(self.JWT_REFRESH_SECRET_KEY) >= 32
            ), "JWT_REFRESH_SECRET_KEY should be at least 32 characters in production"

            assert (
                self.JWT_RESET_SECRET_KEY is not None
            ), "JWT_RESET_SECRET_KEY must be set in .env for production mode"
            assert (
                len(self.JWT_RESET_SECRET_KEY) >= 32
            ), "JWT_RESET_SECRET_KEY should be at least 32 characters in production"

            assert self.ENCRYPT_KEY is not None, "ENCRYPT_KEY must be set in .env for production mode"
            assert len(self.ENCRYPT_KEY) >= 32, "ENCRYPT_KEY should be at least 32 characters in production"
        return self

    @model_validator(mode="after")
    def ensure_required_fields_are_loaded(self) -> "Settings":
        # These fields must be loaded from the environment (env vars or .env files)
        # and should not be None after initialization.
        # This validation runs after all sources (model_config, init_kwargs, env_vars,
        # dotenv_files, secrets_dir)
        required_fields_from_env = {
            "PROJECT_NAME",
            "TOKEN_ISSUER",
            "TOKEN_AUDIENCE",
            "REDIS_HOST",
            "REDIS_PORT",
            "FIRST_SUPERUSER_EMAIL",
            "FIRST_SUPERUSER_PASSWORD",
            "USER_CHANGED_PASSWORD_DATE",
            "JWT_REFRESH_SECRET_KEY",
            "JWT_RESET_SECRET_KEY",
            "ENCRYPT_KEY",
        }

        missing_fields = []
        for field_name in required_fields_from_env:
            if getattr(self, field_name) is None:
                missing_fields.append(field_name)

        if missing_fields:
            raise ValueError(
                f"Missing required environment settings: {', '.join(missing_fields)}. "
                "Please ensure they are set in your .env file or environment variables."
            )
        return self

    # This configuration uses the new SettingsConfigDict style in Pydantic v2
    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file_encoding="utf-8",
        extra="ignore",
        # env_file is now handled by settings_customise_sources
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        return settings_customise_sources(
            settings_cls,
            init_settings,
            env_settings,
            dotenv_settings,
            file_secret_settings,
        )


@lru_cache()
def get_settings() -> Settings:
    """Retrieve and cache application settings."""
    # The settings object will now automatically use the customized sources
    # defined in settings_customise_sources.
    return Settings()


settings = get_settings()
