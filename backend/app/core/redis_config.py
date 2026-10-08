"""Build Redis URLs from the shared connection settings."""

from __future__ import annotations

from urllib.parse import quote, urlencode


def build_redis_url(
    *,
    host: str | None,
    port: int | None,
    password: str | None,
    db: int,
    ssl_enabled: bool,
    cert_path: str,
    check_hostname: bool,
    production: bool,
) -> str:
    """Create a redis-py URL with consistent auth, database and TLS options."""
    scheme = "rediss" if ssl_enabled else "redis"
    auth = ""
    if password:
        username = "default" if production else ""
        auth = f"{username}:{quote(password, safe='')}@"

    query = ""
    if ssl_enabled:
        query = "?" + urlencode(
            {
                "ssl_cert_reqs": "required",
                "ssl_ca_certs": f"{cert_path.rstrip('/')}/ca.crt",
                "ssl_check_hostname": str(check_hostname).lower(),
            }
        )

    return f"{scheme}://{auth}{host or 'localhost'}:{port or 6379}/{db}{query}"
