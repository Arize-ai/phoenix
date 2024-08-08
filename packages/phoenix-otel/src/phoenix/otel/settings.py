# subpackage/settings.py

import os
from typing import Optional

# Environment variables specific to the subpackage
ENV_PHOENIX_COLLECTOR_ENDPOINT = "PHOENIX_COLLECTOR_ENDPOINT"
ENV_PHOENIX_PROJECT_NAME = "PHOENIX_PROJECT_NAME"


def get_env_collector_endpoint() -> Optional[str]:
    return os.getenv(ENV_PHOENIX_COLLECTOR_ENDPOINT)


def get_env_project_name() -> str:
    return os.getenv(ENV_PHOENIX_PROJECT_NAME, "default")
