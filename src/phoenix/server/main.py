from argparse import SUPPRESS, ArgumentParser

from phoenix.config import (
    get_env_db_logging_level,
    get_env_disable_migrations,
    get_env_fullstory_org,
    get_env_log_migrations,
    get_env_logging_level,
    get_env_logging_mode,
    get_env_scarf_sh_pixel_id,
)
from phoenix.logging import setup_logging
from phoenix.server.cli.commands import db, serve
from phoenix.settings import Settings


def main() -> None:
    initialize_settings()
    setup_logging()

    parser = ArgumentParser(prog="phoenix", add_help=False)
    parser.add_argument("-h", "--help", action="help", help=SUPPRESS)
    subparsers = parser.add_subparsers(dest="command", required=True, help=SUPPRESS)

    serve.register(subparsers)
    db.register(subparsers)

    args = parser.parse_args()
    args.func(args)


def initialize_settings() -> None:
    """Initialize the settings from environment variables."""
    Settings.logging_mode = get_env_logging_mode()
    Settings.logging_level = get_env_logging_level()
    Settings.db_logging_level = get_env_db_logging_level()
    Settings.log_migrations = get_env_log_migrations()
    Settings.disable_migrations = get_env_disable_migrations()
    Settings.fullstory_org = get_env_fullstory_org()
    Settings.scarf_sh_pixel_id = get_env_scarf_sh_pixel_id()


if __name__ == "__main__":
    main()
