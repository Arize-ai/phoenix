import logging
import os
from pathlib import Path

import alembic.config

logger = logging.getLogger(__name__)


def migrate() -> None:
    """
    Runs migrations on the database.
    """
    config_path = os.path.normpath(str(Path(__file__).parent.resolve()) + os.sep + "alembic.ini")
    alembicArgs = [
        "--config",
        config_path,
        "--raiseerr",
        "upgrade",
        "head",
    ]
    alembic.config.main(argv=alembicArgs)
