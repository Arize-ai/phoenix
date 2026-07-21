from .agents import create_agents_router
from .auth import create_auth_router
from .legacy_agents import create_legacy_agents_router
from .oauth2 import router as oauth2_router
from .oauth2_authorization_server import oauth2_router as oauth2_as_router
from .oauth2_authorization_server import router as oauth2_as_well_known_router
from .v1 import create_v1_router

__all__ = [
    "create_agents_router",
    "create_legacy_agents_router",
    "create_auth_router",
    "create_v1_router",
    "oauth2_as_router",
    "oauth2_as_well_known_router",
    "oauth2_router",
]
