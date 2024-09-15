from .auth import router as auth_router
from .embeddings import create_embeddings_router
from .oauth import router as oauth_router
from .v1 import create_v1_router

__all__ = [
    "auth_router",
    "create_embeddings_router",
    "create_v1_router",
    "oauth_router",
]
