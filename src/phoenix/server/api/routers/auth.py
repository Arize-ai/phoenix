import asyncio
from datetime import timedelta

from fastapi import APIRouter, Form, Request, Response
from sqlalchemy import select
from starlette.status import HTTP_204_NO_CONTENT, HTTP_401_UNAUTHORIZED
from typing_extensions import Annotated

from phoenix.auth import is_valid_password
from phoenix.db import models

router = APIRouter(include_in_schema=False)

PHOENIX_ACCESS_TOKEN_COOKIE_NAME = "phoenix-access-token"
PHOENIX_ACCESS_TOKEN_COOKIE_MAX_AGE_IN_SECONDS = int(timedelta(days=31).total_seconds())


@router.post("/login")
async def login(
    request: Request,
    email: Annotated[str, Form()],
    password: Annotated[str, Form()],
) -> Response:
    async with request.app.state.db() as session:
        if (
            user := await session.scalar(select(models.User).where(models.User.email == email))
        ) is None or (password_hash := user.password_hash) is None:
            return Response(status_code=HTTP_401_UNAUTHORIZED)
    loop = asyncio.get_running_loop()
    if not await loop.run_in_executor(
        executor=None,
        func=lambda: is_valid_password(
            password=password, salt=request.app.state.get_secret(), password_hash=password_hash
        ),
    ):
        return Response(status_code=HTTP_401_UNAUTHORIZED)
    response = Response(status_code=HTTP_204_NO_CONTENT)
    response.set_cookie(
        key=PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
        value="token",  # todo: compute access token
        secure=True,
        httponly=True,
        samesite="strict",
        max_age=PHOENIX_ACCESS_TOKEN_COOKIE_MAX_AGE_IN_SECONDS,
    )
    return response


@router.post("/logout")
async def logout() -> Response:
    response = Response(status_code=HTTP_204_NO_CONTENT)
    response.delete_cookie(key=PHOENIX_ACCESS_TOKEN_COOKIE_NAME)
    return response
