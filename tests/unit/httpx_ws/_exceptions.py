import typing

import httpx
import wsproto


class HTTPXWSException(Exception):
    """
    Base exception class for HTTPX WS.
    """

    pass


class WebSocketUpgradeError(HTTPXWSException):
    """
    Raised when the initial connection didn't correctly upgrade to a WebSocket session.
    """

    def __init__(self, response: httpx.Response) -> None:
        self.response = response


class WebSocketDisconnect(HTTPXWSException):
    """
    Raised when the server closed the WebSocket session.

    Args:
        code:
            The integer close code to indicate why the connection has closed.
        reason:
            Additional reasoning for why the connection has closed.
    """

    def __init__(self, code: int = 1000, reason: typing.Optional[str] = None) -> None:
        self.code = code
        self.reason = reason or ""


class WebSocketInvalidTypeReceived(HTTPXWSException):
    """
    Raised when a event is not of the expected type.
    """

    def __init__(self, event: wsproto.events.Event) -> None:
        self.event = event


class WebSocketNetworkError(HTTPXWSException):
    """
    Raised when a network error occured,
    typically if the underlying stream has closed or timeout.
    """

    pass
