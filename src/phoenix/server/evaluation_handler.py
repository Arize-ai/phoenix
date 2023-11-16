import gzip
from typing import Protocol

from starlette.endpoints import HTTPEndpoint
from starlette.requests import Request
from starlette.responses import Response
from starlette.status import HTTP_422_UNPROCESSABLE_ENTITY

import phoenix.trace.v1 as pb


class SupportsPutEvaluation(Protocol):
    def put(self, evaluation: pb.Evaluation) -> None:
        ...


class EvaluationHandler(HTTPEndpoint):
    queue: SupportsPutEvaluation

    async def post(self, request: Request) -> Response:
        try:
            content_type = request.headers.get("content-type")
            if content_type == "application/x-protobuf":
                body = await request.body()
                content_encoding = request.headers.get("content-encoding")
                if content_encoding == "gzip":
                    body = gzip.decompress(body)
                elif content_encoding is not None:
                    raise NotImplementedError(f"Unsupported content-encoding: {content_encoding}")
                evaluation = pb.Evaluation()
                evaluation.ParseFromString(body)
            else:
                raise NotImplementedError(f"Unsupported content-type: {content_type}")
        except NotImplementedError as e:
            return Response(str(e), status_code=HTTP_422_UNPROCESSABLE_ENTITY)
        except Exception:
            return Response(status_code=HTTP_422_UNPROCESSABLE_ENTITY)
        self.queue.put(evaluation)
        return Response()
