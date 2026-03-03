from .auth import create_auth_router
from .chat import create_chat_router
from .oauth2 import router as oauth2_router
from .v1 import create_v1_router

__all__ = [
    "create_chat_router",
    "create_auth_router",
    "create_v1_router",
    "oauth2_router",
]
