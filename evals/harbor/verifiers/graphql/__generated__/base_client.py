from typing import Any, Optional, Protocol, TypeVar, cast

import httpx
from pydantic import BaseModel as PydanticBaseModel
from pydantic_core import to_jsonable_python

from .base_model import UNSET
from .exceptions import (
    GraphQLClientGraphQLMultiError,
    GraphQLClientHttpError,
    GraphQLClientInvalidResponseError,
)


class Response(Protocol):
    status_code: int

    def json(self, **kwargs: Any) -> Any: ...


class HttpClient(Protocol):
    def post(
        self,
        url: Any | str,
        json: Any | None = None,
        data: Any | None = None,
        files: Any | None = None,
        headers: Any | None = None,
        **kwargs: Any,
    ) -> Response: ...

    def close(self) -> None: ...


Self = TypeVar("Self", bound="BaseClient")


class BaseClient:
    def __init__(
        self,
        url: str = "",
        headers: Optional[dict[str, str]] = None,
        http_client: Optional[HttpClient] = None,
    ) -> None:
        self.url = url
        self.headers = headers

        self.http_client = http_client if http_client else httpx.Client(headers=headers)

    def __enter__(self: Self) -> Self:
        return self

    def __exit__(
        self,
        exc_type: object,
        exc_val: object,
        exc_tb: object,
    ) -> None:
        self.http_client.close()

    def execute(
        self,
        query: str,
        operation_name: Optional[str] = None,
        variables: Optional[dict[str, Any]] = None,
        **kwargs: Any,
    ) -> Response:
        processed_variables = (
            self._convert_dict_to_json_serializable(variables) if variables else {}
        )
        return self._execute_json(
            query=query,
            operation_name=operation_name,
            variables=processed_variables,
            **kwargs,
        )

    def get_data(self, response: Response) -> dict[str, Any]:
        if not (200 <= response.status_code <= 299):
            raise GraphQLClientHttpError(
                status_code=response.status_code, response=response
            )

        try:
            response_json = response.json()
        except ValueError as exc:
            raise GraphQLClientInvalidResponseError(response=response) from exc

        if (not isinstance(response_json, dict)) or (
            "data" not in response_json and "errors" not in response_json
        ):
            raise GraphQLClientInvalidResponseError(response=response)

        data = response_json.get("data")
        errors = response_json.get("errors")

        if errors:
            raise GraphQLClientGraphQLMultiError.from_errors_dicts(
                errors_dicts=errors, data=data
            )

        return cast(dict[str, Any], data)

    def _convert_dict_to_json_serializable(
        self, dict_: dict[str, Any]
    ) -> dict[str, Any]:
        return {
            key: self._convert_value(value)
            for key, value in dict_.items()
            if value is not UNSET
        }

    def _convert_value(self, value: Any) -> Any:
        if isinstance(value, PydanticBaseModel):
            return value.model_dump(by_alias=True, exclude_unset=True)
        if isinstance(value, list):
            return [self._convert_value(item) for item in value]
        return value

    def _execute_json(
        self,
        query: str,
        operation_name: Optional[str],
        variables: dict[str, Any],
        **kwargs: Any,
    ) -> Response:
        return self.http_client.post(
            url=self.url,
            json=to_jsonable_python(
                {
                    "query": query,
                    "operationName": operation_name,
                    "variables": variables,
                }
            ),
            **kwargs,
        )
