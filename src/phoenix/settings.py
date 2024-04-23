from dataclasses import dataclass, field


@dataclass
class _Settings:
    """Settings for Phoenix, lazily initialized."""

    # By default, don't log migrations
    log_migrations: bool = field(default=False)


# Singleton instance of the settings
Settings = _Settings()
