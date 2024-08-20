from datetime import timedelta

from fastapi import APIRouter, Form, Request, Response
from starlette.status import HTTP_204_NO_CONTENT, HTTP_401_UNAUTHORIZED
from typing_extensions import Annotated

from phoenix.auth import (
    FailedLoginError,
    validate_login_credentials,
)

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
        try:
            await validate_login_credentials(session=session, email=email, password=password)
        except FailedLoginError:
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
