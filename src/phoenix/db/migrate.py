import os
from pathlib import Path

import alembic.config


def migrate():
    current_dir = Path(__file__)
    path_to_alembic_ini = os.path.normpath(
        str(current_dir)
        + os.sep
        + os.pardir
        + os.sep
        + os.pardir
        + os.sep
        + os.pardir
        + os.sep
        + os.pardir
        + os.sep
        + "alembic.ini"
    )
    print("Path to alembic.ini: ", path_to_alembic_ini)
    alembicArgs = [
        "--config",
        path_to_alembic_ini,
        "--raiseerr",
        "upgrade",
        "head",
    ]
    alembic.config.main(argv=alembicArgs)
