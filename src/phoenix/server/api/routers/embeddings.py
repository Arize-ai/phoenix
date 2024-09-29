from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from starlette.exceptions import HTTPException
from starlette.requests import Request

from phoenix.server.bearer_auth import is_authenticated


def create_embeddings_router(authentication_enabled: bool) -> APIRouter:
    """
    Instantiates a router for the embeddings API.
    """
    router = APIRouter(dependencies=[Depends(is_authenticated)] if authentication_enabled else [])

    @router.get("/exports")
    async def download_exported_file(request: Request, filename: str) -> FileResponse:
        file = request.app.state.export_path / (filename + ".parquet")
        if not file.is_file():
            raise HTTPException(status_code=404)
        return FileResponse(
            path=file,
            filename=file.name,
            media_type="application/x-octet-stream",
        )

    return router
