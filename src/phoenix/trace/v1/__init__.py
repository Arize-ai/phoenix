import json
from datetime import datetime, timezone
from itertools import chain
from typing import (
    Any,
    Dict,
    Iterable,
    Iterator,
    Mapping,
    Optional,
    SupportsFloat,
    Tuple,
    Union,
    cast,
)
from uuid import UUID

from google.protobuf.json_format import MessageToDict
from google.protobuf.struct_pb2 import Struct
from google.protobuf.timestamp_pb2 import Timestamp
from google.protobuf.wrappers_pb2 import BoolValue, BytesValue, FloatValue, StringValue

import phoenix.trace.v1.trace_pb2 as pb
from phoenix.trace.schemas import (
    Span,
    SpanContext,
    SpanEvent,
    SpanException,
    SpanKind,
    SpanStatusCode,
)
from phoenix.trace.semantic_conventions import (
    DOCUMENT_CONTENT,
    DOCUMENT_ID,
    DOCUMENT_METADATA,
    DOCUMENT_SCORE,
    EMBEDDING_EMBEDDINGS,
    EMBEDDING_MODEL_NAME,
    EMBEDDING_TEXT,
    EMBEDDING_VECTOR,
    EXCEPTION_ESCAPED,
    EXCEPTION_MESSAGE,
    EXCEPTION_STACKTRACE,
    EXCEPTION_TYPE,
    INPUT_MIME_TYPE,
    INPUT_VALUE,
    OUTPUT_MIME_TYPE,
    OUTPUT_VALUE,
    RETRIEVAL_DOCUMENTS,
    MimeType,
)


def encode(span: Span) -> pb.Span:
    _attributes: Mapping[str, Any] = dict(span.attributes)
    retrieval, _attributes = _excise_retrieval(_attributes)
    embedding, _attributes = _excise_embedding(_attributes)
    input, _attributes = _excise_input(_attributes)
    output, _attributes = _excise_output(_attributes)
    status = pb.Span.Status(message=_maybe_str(span.status_message))
    if span.status_code is SpanStatusCode.ERROR:
        status.code = pb.Span.Status.Code.ERROR
    elif span.status_code is SpanStatusCode.OK:
        status.code = pb.Span.Status.Code.OK
    parent_span_id = BytesValue(value=span.parent_id.bytes) if span.parent_id else None
    pb_span = pb.Span(
        start_time=_as_timestamp(span.start_time),
        end_time=_maybe_timestamp(span.end_time),
        status=status,
        name=span.name,
        kind=span.span_kind.value,
        context=pb.Span.Context(
            trace_id=span.context.trace_id.bytes,
            span_id=span.context.span_id.bytes,
        ),
        parent_span_id=parent_span_id,
        attributes=_maybe_struct(_attributes),
        input=input,
        output=output,
        retrieval=retrieval,
        embedding=embedding,
    )
    for event in span.events:
        if event.name == "exception":
            pb_span.exceptions.append(
                _encode_exception(
                    cast(SpanException, event),
                ),
            )
        else:
            pb_span.events.append(
                _encode_event(event),
            )
    return pb_span


def decode(
    pb_span: pb.Span,
) -> Span:
    trace_id = UUID(bytes=pb_span.context.trace_id)
    span_id = UUID(bytes=pb_span.context.span_id)
    parent_id = (
        UUID(bytes=pb_span.parent_span_id.value) if pb_span.HasField("parent_span_id") else None
    )
    start_time = pb_span.start_time.ToDatetime(timezone.utc)
    end_time = pb_span.end_time.ToDatetime(timezone.utc) if pb_span.HasField("end_time") else None
    attributes = MessageToDict(pb_span.attributes)
    if pb_span.HasField("input"):
        attributes.update(_decode_input(pb_span.input))
    if pb_span.HasField("output"):
        attributes.update(_decode_output(pb_span.output))
    if pb_span.HasField("retrieval"):
        attributes.update(_decode_retrieval(pb_span.retrieval))
    if pb_span.HasField("embedding"):
        attributes.update(_decode_embedding(pb_span.embedding))
    events = sorted(
        chain(
            map(_decode_event, pb_span.events),
            map(_decode_exception, pb_span.exceptions),
        ),
        key=lambda event: event.timestamp,
    )
    status_code = SpanStatusCode.UNSET
    if pb_span.status.code == pb.Span.Status.Code.OK:
        status_code = SpanStatusCode.OK
    elif pb_span.status.code == pb.Span.Status.Code.ERROR:
        status_code = SpanStatusCode.ERROR
    return Span(
        name=pb_span.name,
        context=SpanContext(trace_id=trace_id, span_id=span_id),
        parent_id=parent_id,
        span_kind=SpanKind(pb_span.kind.upper()),
        start_time=start_time,
        end_time=end_time,
        attributes=attributes,
        status_code=status_code,
        status_message=pb_span.status.message.value,
        conversation=None,
        events=events,
    )


def _excise_input(
    attributes: Mapping[str, Any],
) -> Tuple[Optional[pb.Span.IOValue], Dict[str, Any]]:
    _attributes = dict(attributes)
    if not (
        _attributes.keys()
        & {
            INPUT_VALUE,
            INPUT_MIME_TYPE,
        }
    ):
        return None, _attributes
    input_value: Optional[str] = _attributes.pop(INPUT_VALUE, None)
    assert input_value is None or isinstance(
        input_value, str
    ), f"{INPUT_VALUE} must be str, found {type(input_value)}"
    input_mime_type: Optional[MimeType] = _attributes.pop(INPUT_MIME_TYPE, None)
    assert input_mime_type is None or isinstance(
        input_mime_type, MimeType
    ), f"{INPUT_MIME_TYPE} must be MimeType, found {type(input_mime_type)}"
    return (
        _encode_io_value(
            input_value or "",
            input_mime_type,
        ),
        _attributes,
    )


def _excise_output(
    attributes: Mapping[str, Any],
) -> Tuple[Optional[pb.Span.IOValue], Dict[str, Any]]:
    _attributes = dict(attributes)
    if not (
        _attributes.keys()
        & {
            OUTPUT_VALUE,
            OUTPUT_MIME_TYPE,
        }
    ):
        return None, _attributes
    output_value: Optional[str] = _attributes.pop(OUTPUT_VALUE, None)
    assert output_value is None or isinstance(
        output_value, str
    ), f"{OUTPUT_VALUE} must be str, found {type(output_value)}"
    output_mime_type: Optional[MimeType] = _attributes.pop(OUTPUT_MIME_TYPE, None)
    assert output_mime_type is None or isinstance(
        output_mime_type, MimeType
    ), f"{OUTPUT_MIME_TYPE} must be MimeType, found {type(output_mime_type)}"
    return (
        _encode_io_value(
            output_value or "",
            output_mime_type,
        ),
        _attributes,
    )


def _excise_retrieval(
    attributes: Mapping[str, Any],
) -> Tuple[Optional[pb.Retrieval], Dict[str, Any]]:
    _attributes = dict(attributes)
    if not (
        _attributes.keys()
        & {
            RETRIEVAL_DOCUMENTS,
        }
    ):
        return None, _attributes
    documents: Optional[Iterable[Mapping[str, Any]]] = _attributes.pop(RETRIEVAL_DOCUMENTS, None)
    assert documents is None or isinstance(
        documents, Iterable
    ), f"{RETRIEVAL_DOCUMENTS} must be Iterable, found {type(documents)}"
    return (
        _encode_retrieval(documents=() if documents is None else documents),
        _attributes,
    )


def _excise_embedding(
    attributes: Mapping[str, Any],
) -> Tuple[Optional[pb.Embedding], Dict[str, Any]]:
    _attributes = dict(attributes)
    if not (
        _attributes.keys()
        & {
            EMBEDDING_EMBEDDINGS,
            EMBEDDING_MODEL_NAME,
        }
    ):
        return None, _attributes
    embeddings: Optional[Iterable[Mapping[str, Any]]] = _attributes.pop(EMBEDDING_EMBEDDINGS, None)
    assert embeddings is None or isinstance(
        embeddings, Iterable
    ), f"{EMBEDDING_EMBEDDINGS} must be Mapping, found {type(embeddings)}"
    model_name: Optional[str] = _attributes.pop(EMBEDDING_MODEL_NAME, None)
    assert model_name is None or isinstance(
        model_name, str
    ), f"{EMBEDDING_MODEL_NAME} must be str, found {type(model_name)}"
    return (
        _encode_embedding(
            embeddings=embeddings or (),
            model_name=model_name,
        ),
        _attributes,
    )


def _encode_event(
    span_event: SpanEvent,
) -> pb.Span.Event:
    timestamp = Timestamp()
    timestamp.FromDatetime(span_event.timestamp)
    attributes = None
    if span_event.attributes:
        attributes = Struct()
        attributes.update(span_event.attributes)
    pb_span_event = pb.Span.Event(
        name=span_event.name,
        timestamp=timestamp,
        attributes=attributes,
    )
    return pb_span_event


def _decode_event(
    pb_span_event: pb.Span.Event,
) -> SpanEvent:
    return SpanEvent(
        name=pb_span_event.name,
        timestamp=pb_span_event.timestamp.ToDatetime(timezone.utc),
        attributes=MessageToDict(pb_span_event.attributes),
    )


def _encode_exception(
    span_exception: SpanException,
) -> pb.Span.Exception:
    timestamp = Timestamp()
    timestamp.FromDatetime(span_exception.timestamp)
    _attributes: Dict[str, Any] = dict(span_exception.attributes)
    exception_message: Optional[str] = _attributes.pop(EXCEPTION_MESSAGE, None)
    assert exception_message is None or isinstance(
        exception_message, str
    ), f"{EXCEPTION_MESSAGE} must be str, found {type(exception_message)}"
    exception_type: Optional[str] = _attributes.pop(EXCEPTION_TYPE, None)
    assert exception_type is None or isinstance(
        exception_type, str
    ), f"{EXCEPTION_TYPE} must be str, found {type(exception_type)}"
    exception_escaped: Optional[bool] = _attributes.pop(EXCEPTION_ESCAPED, None)
    assert exception_escaped is None or isinstance(
        exception_escaped, bool
    ), f"{EXCEPTION_ESCAPED} must be bool, found {type(exception_escaped)}"
    exception_stacktrace: Optional[str] = _attributes.pop(EXCEPTION_STACKTRACE, None)
    assert exception_stacktrace is None or isinstance(
        exception_stacktrace, str
    ), f"{EXCEPTION_STACKTRACE} must be str, found {type(exception_stacktrace)}"
    pb_span_exception = pb.Span.Exception(
        timestamp=timestamp,
        message=_maybe_str(exception_message),
        type=_maybe_str(exception_type),
        escaped=_maybe_bool(exception_escaped),
        stacktrace=_maybe_str(exception_stacktrace),
        attributes=_maybe_struct(_attributes),
    )
    return pb_span_exception


def _decode_exception(
    pb_span_exception: pb.Span.Exception,
) -> SpanException:
    exception_message = (
        pb_span_exception.message.value if pb_span_exception.HasField("message") else None
    )
    exception_type = pb_span_exception.type.value if pb_span_exception.HasField("type") else None
    exception_escaped = (
        pb_span_exception.escaped.value if pb_span_exception.HasField("escaped") else None
    )
    exception_stacktrace = (
        pb_span_exception.stacktrace.value if pb_span_exception.HasField("stacktrace") else None
    )
    span_exception = SpanException(
        timestamp=pb_span_exception.timestamp.ToDatetime(timezone.utc),
        message=exception_message or "",
        exception_type=exception_type,
        exception_escaped=exception_escaped,
        exception_stacktrace=exception_stacktrace,
    )
    span_exception.attributes.update(
        MessageToDict(
            pb_span_exception.attributes,
        ),
    )
    return span_exception


def _decode_input(
    pb_io_value: pb.Span.IOValue,
) -> Iterator[Tuple[str, Union[str, MimeType]]]:
    return zip(
        (INPUT_VALUE, INPUT_MIME_TYPE),
        _decode_io_value(pb_io_value),
    )


def _decode_output(
    pb_io_value: pb.Span.IOValue,
) -> Iterator[Tuple[str, Union[str, MimeType]]]:
    return zip(
        (OUTPUT_VALUE, OUTPUT_MIME_TYPE),
        _decode_io_value(pb_io_value),
    )


def _encode_io_value(
    io_value: str,
    mime_type: Optional[MimeType],
) -> pb.Span.IOValue:
    if mime_type is MimeType.JSON:
        struct = Struct()
        if io_value:
            struct.update(json.loads(io_value))
        return pb.Span.IOValue(json_value=struct)
    return pb.Span.IOValue(string_value=io_value)


def _decode_io_value(
    pb_io_value: pb.Span.IOValue,
) -> Iterator[Union[str, MimeType]]:
    if pb_io_value.WhichOneof("kind") == "json_value":
        yield json.dumps(MessageToDict(pb_io_value.json_value))
        yield MimeType.JSON
    else:
        yield pb_io_value.string_value


def _encode_retrieval(
    documents: Iterable[Mapping[str, Any]],
) -> pb.Retrieval:
    return pb.Retrieval(
        documents=map(
            _encode_retrieval_document,
            documents,
        ),
    )


def _decode_retrieval(
    pb_retrieval: pb.Retrieval,
) -> Iterator[Tuple[str, Any]]:
    yield (
        RETRIEVAL_DOCUMENTS,
        [
            dict(_decode_retrieval_document(pb_retrieval_document))
            for pb_retrieval_document in pb_retrieval.documents
        ],
    )


def _encode_retrieval_document(
    document: Mapping[str, Any],
) -> pb.Retrieval.Document:
    _attributes: Dict[str, Any] = dict(document)
    document_id: Optional[str] = _attributes.pop(DOCUMENT_ID, None)
    assert document_id is None or isinstance(
        document_id, str
    ), f"{DOCUMENT_ID} must be str, found {type(document_id)}"
    document_score: Optional[float] = _attributes.pop(DOCUMENT_SCORE, None)
    assert document_score is None or isinstance(
        document_score, SupportsFloat
    ), f"{DOCUMENT_SCORE} must be float, found {type(document_score)}"
    document_content: Optional[str] = _attributes.pop(DOCUMENT_CONTENT, None)
    assert document_content is None or isinstance(
        document_content, str
    ), f"{DOCUMENT_CONTENT} must be str, found {type(document_content)}"
    document_metadata: Optional[Mapping[str, Any]] = _attributes.pop(DOCUMENT_METADATA, None)
    assert document_metadata is None or isinstance(
        document_metadata, Mapping
    ), f"{DOCUMENT_METADATA} must be Mapping, found {type(document_metadata)}"
    return pb.Retrieval.Document(
        id=_maybe_str(document_id),
        score=_maybe_float(document_score),
        content=_maybe_str(document_content),
        metadata=_maybe_struct(document_metadata),
        attributes=_maybe_struct(_attributes),
    )


def _decode_retrieval_document(
    pb_document: pb.Retrieval.Document,
) -> Iterator[Tuple[str, Any]]:
    if pb_document.HasField("id"):
        yield DOCUMENT_ID, pb_document.id.value
    if pb_document.HasField("score"):
        yield DOCUMENT_SCORE, pb_document.score.value
    if pb_document.HasField("content"):
        yield DOCUMENT_CONTENT, pb_document.content.value
    if pb_document.HasField("metadata"):
        yield DOCUMENT_METADATA, MessageToDict(pb_document.metadata)
    if pb_document.HasField("attributes"):
        yield from MessageToDict(pb_document.attributes).items()


def _encode_embedding(
    embeddings: Iterable[Mapping[str, Any]],
    model_name: Optional[str],
) -> pb.Embedding:
    return pb.Embedding(
        model_name=_maybe_str(model_name),
        embeddings=map(_encode_embedding_embedding, embeddings),
    )


def _decode_embedding(
    pb_embedding: pb.Embedding,
) -> Iterator[Tuple[str, Any]]:
    if pb_embedding.HasField("model_name"):
        yield EMBEDDING_MODEL_NAME, pb_embedding.model_name.value
    yield (
        EMBEDDING_EMBEDDINGS,
        [
            dict(_decode_embedding_embedding(pb_embedding_embedding))
            for pb_embedding_embedding in pb_embedding.embeddings
        ],
    )


def _encode_embedding_embedding(
    embedding: Mapping[str, Any],
) -> pb.Embedding.Embedding:
    _attributes = dict(embedding)
    vector: Optional[Iterable[float]] = _attributes.pop(EMBEDDING_VECTOR, None)
    assert vector is None or isinstance(
        vector, Iterable
    ), f"{EMBEDDING_VECTOR} must be Iterable, found {type(vector)}"
    embedding_text: Optional[str] = _attributes.pop(EMBEDDING_TEXT, None)
    assert embedding_text is None or isinstance(
        embedding_text, str
    ), f"{EMBEDDING_TEXT} must be str, found {type(embedding_text)}"
    return pb.Embedding.Embedding(
        vector=() if vector is None else vector,
        text=_maybe_str(embedding_text),
        attributes=_maybe_struct(_attributes),
    )


def _decode_embedding_embedding(
    pb_embedding_embedding: pb.Embedding.Embedding,
) -> Iterator[Tuple[str, Any]]:
    yield EMBEDDING_VECTOR, list(pb_embedding_embedding.vector)
    if pb_embedding_embedding.HasField("text"):
        yield EMBEDDING_TEXT, pb_embedding_embedding.text.value
    if pb_embedding_embedding.HasField("attributes"):
        yield from MessageToDict(pb_embedding_embedding.attributes).items()


def _maybe_str(obj: Optional[str]) -> Optional[StringValue]:
    return None if not obj else StringValue(value=obj)


def _maybe_float(obj: Optional[float]) -> Optional[FloatValue]:
    return None if obj is None else FloatValue(value=obj)


def _maybe_bool(obj: Optional[bool]) -> Optional[BoolValue]:
    return None if obj is None else BoolValue(value=obj)


def _as_timestamp(obj: datetime) -> Timestamp:
    timestamp = Timestamp()
    timestamp.FromDatetime(obj)
    return timestamp


def _maybe_timestamp(obj: Optional[datetime]) -> Optional[Timestamp]:
    return _as_timestamp(obj) if obj else None


def _as_struct(obj: Mapping[str, Any]) -> Struct:
    struct = Struct()
    struct.update(obj)
    return struct


def _maybe_struct(obj: Optional[Mapping[str, Any]]) -> Optional[Struct]:
    return _as_struct(obj) if obj else None
