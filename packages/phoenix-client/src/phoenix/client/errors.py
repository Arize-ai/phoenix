import httpx


class PhoenixClientError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)


def check_response_for_errors(response: httpx.Response) -> None:
    if response.status_code >= 400:
        raise PhoenixClientError(response.text)
