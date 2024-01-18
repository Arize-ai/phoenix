import logging
import weakref
from collections import defaultdict
from datetime import datetime, timezone
from queue import SimpleQueue
from threading import RLock, Thread
from types import MethodType
from typing import DefaultDict, Dict, List, Optional, Set, Tuple

import numpy as np
from google.protobuf.json_format import MessageToDict
from pandas import DataFrame, Index, MultiIndex
from typing_extensions import TypeAlias, assert_never

import phoenix.trace.v1 as pb
from phoenix.trace.schemas import SpanID, TraceID
from phoenix.trace.span_evaluations import DocumentEvaluations, Evaluations, SpanEvaluations

logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())

END_OF_QUEUE = None  # sentinel value for queue termination

EvaluationName: TypeAlias = str
DocumentPosition: TypeAlias = int


class Evals:
    def __init__(self) -> None:
        self._queue: "SimpleQueue[Optional[pb.Evaluation]]" = SimpleQueue()
        weakref.finalize(self, self._queue.put, END_OF_QUEUE)
        self._lock = RLock()
        self._trace_evaluations_by_name: DefaultDict[
            EvaluationName, Dict[TraceID, pb.Evaluation]
        ] = defaultdict(dict)
        self._evaluations_by_trace_id: DefaultDict[
            TraceID, Dict[EvaluationName, pb.Evaluation]
        ] = defaultdict(dict)
        self._span_evaluations_by_name: DefaultDict[
            EvaluationName, Dict[SpanID, pb.Evaluation]
        ] = defaultdict(dict)
        self._evaluations_by_span_id: DefaultDict[
            SpanID, Dict[EvaluationName, pb.Evaluation]
        ] = defaultdict(dict)
        self._span_evaluation_labels: DefaultDict[EvaluationName, Set[str]] = defaultdict(set)
        self._document_evaluations_by_span_id: DefaultDict[
            SpanID, DefaultDict[EvaluationName, Dict[DocumentPosition, pb.Evaluation]]
        ] = defaultdict(lambda: defaultdict(dict))
        self._document_evaluations_by_name: DefaultDict[
            EvaluationName, DefaultDict[SpanID, Dict[DocumentPosition, pb.Evaluation]]
        ] = defaultdict(lambda: defaultdict(dict))
        self._last_updated_at: Optional[datetime] = None
        self._start_consumer()

    def put(self, evaluation: pb.Evaluation) -> None:
        self._queue.put(evaluation)

    def _start_consumer(self) -> None:
        Thread(
            target=MethodType(
                self.__class__._consume_evaluations,
                weakref.proxy(self),
            ),
            daemon=True,
        ).start()

    def _consume_evaluations(self) -> None:
        while (item := self._queue.get()) is not END_OF_QUEUE:
            with self._lock:
                self._process_evaluation(item)

    def _process_evaluation(self, evaluation: pb.Evaluation) -> None:
        subject_id = evaluation.subject_id
        name = evaluation.name
        subject_id_kind = subject_id.WhichOneof("kind")
        if subject_id_kind == "document_retrieval_id":
            document_retrieval_id = subject_id.document_retrieval_id
            span_id = SpanID(document_retrieval_id.span_id)
            document_position = document_retrieval_id.document_position
            self._document_evaluations_by_span_id[span_id][name][document_position] = evaluation
            self._document_evaluations_by_name[name][span_id][document_position] = evaluation
        elif subject_id_kind == "span_id":
            span_id = SpanID(subject_id.span_id)
            self._evaluations_by_span_id[span_id][name] = evaluation
            self._span_evaluations_by_name[name][span_id] = evaluation
            if evaluation.result.HasField("label"):
                label = evaluation.result.label.value
                self._span_evaluation_labels[name].add(label)
        elif subject_id_kind == "trace_id":
            trace_id = TraceID(subject_id.trace_id)
            self._evaluations_by_trace_id[trace_id][name] = evaluation
            self._trace_evaluations_by_name[name][trace_id] = evaluation
        elif subject_id_kind is None:
            logger.warning(
                f"discarding evaluation with missing subject_id: {MessageToDict(evaluation)}"
            )
        else:
            assert_never(subject_id_kind)
        self._last_updated_at = datetime.now(timezone.utc)

    @property
    def last_updated_at(self) -> Optional[datetime]:
        return self._last_updated_at

    def get_span_evaluation(self, span_id: SpanID, name: str) -> Optional[pb.Evaluation]:
        with self._lock:
            span_evaluations = self._evaluations_by_span_id.get(span_id)
            return span_evaluations.get(name) if span_evaluations else None

    def get_span_evaluation_names(self) -> List[EvaluationName]:
        with self._lock:
            return list(self._span_evaluations_by_name)

    def get_document_evaluation_names(
        self,
        span_id: Optional[SpanID] = None,
    ) -> List[EvaluationName]:
        with self._lock:
            if span_id is None:
                return list(self._document_evaluations_by_name)
            document_evaluations = self._document_evaluations_by_span_id.get(span_id)
            return list(document_evaluations) if document_evaluations else []

    def get_span_evaluation_labels(self, name: EvaluationName) -> Tuple[str, ...]:
        with self._lock:
            labels = self._span_evaluation_labels.get(name)
            return tuple(labels) if labels else ()

    def get_span_evaluation_span_ids(self, name: EvaluationName) -> Tuple[SpanID, ...]:
        with self._lock:
            span_evaluations = self._span_evaluations_by_name.get(name)
            return tuple(span_evaluations.keys()) if span_evaluations else ()

    def get_evaluations_by_span_id(self, span_id: SpanID) -> List[pb.Evaluation]:
        with self._lock:
            evaluations = self._evaluations_by_span_id.get(span_id)
            return list(evaluations.values()) if evaluations else []

    def get_document_evaluation_span_ids(self, name: EvaluationName) -> Tuple[SpanID, ...]:
        with self._lock:
            document_evaluations = self._document_evaluations_by_name.get(name)
            return tuple(document_evaluations.keys()) if document_evaluations else ()

    def get_document_evaluations_by_span_id(self, span_id: SpanID) -> List[pb.Evaluation]:
        all_evaluations: List[pb.Evaluation] = []
        with self._lock:
            document_evaluations = self._document_evaluations_by_span_id.get(span_id)
            if not document_evaluations:
                return all_evaluations
            for evaluations in document_evaluations.values():
                all_evaluations.extend(evaluations.values())
        return all_evaluations

    def get_document_evaluation_scores(
        self,
        span_id: SpanID,
        evaluation_name: str,
        num_documents: int,
    ) -> List[float]:
        # num_documents is needed as argument because the document position values
        # are not checked during ingestion: e.g. if there exists a position value
        # of one trillion, we would not want to create a result that large.
        scores: List[float] = [np.nan] * num_documents
        with self._lock:
            document_evaluations = self._document_evaluations_by_span_id.get(span_id)
            if not document_evaluations:
                return scores
            evaluations = document_evaluations.get(evaluation_name)
            if not evaluations:
                return scores
            for document_position, evaluation in evaluations.items():
                result = evaluation.result
                if result.HasField("score") and document_position < num_documents:
                    scores[document_position] = result.score.value
        return scores

    def export_evaluations(self) -> List[Evaluations]:
        evaluations: List[Evaluations] = []
        evaluations.extend(self._export_span_evaluations())
        evaluations.extend(self._export_document_evaluations())
        return evaluations

    def _export_span_evaluations(self) -> List[SpanEvaluations]:
        span_evaluations = []
        with self._lock:
            span_evaluations_by_name = tuple(self._span_evaluations_by_name.items())
        for eval_name, _span_evaluations_by_id in span_evaluations_by_name:
            span_ids = []
            rows = []
            with self._lock:
                span_evaluations_by_id = tuple(_span_evaluations_by_id.items())
            for span_id, pb_eval in span_evaluations_by_id:
                span_ids.append(span_id)
                rows.append(MessageToDict(pb_eval.result))
            dataframe = DataFrame(rows, index=Index(span_ids, name="context.span_id"))
            span_evaluations.append(SpanEvaluations(eval_name, dataframe))
        return span_evaluations

    def _export_document_evaluations(self) -> List[DocumentEvaluations]:
        evaluations = []
        with self._lock:
            document_evaluations_by_name = tuple(self._document_evaluations_by_name.items())
        for eval_name, _document_evaluations_by_id in document_evaluations_by_name:
            span_ids = []
            document_positions = []
            rows = []
            with self._lock:
                document_evaluations_by_id = tuple(_document_evaluations_by_id.items())
            for span_id, _document_evaluations_by_position in document_evaluations_by_id:
                with self._lock:
                    document_evaluations_by_position = sorted(
                        _document_evaluations_by_position.items()
                    )  # ensure the evals are sorted by document position
                for document_position, pb_eval in document_evaluations_by_position:
                    span_ids.append(span_id)
                    document_positions.append(document_position)
                    rows.append(MessageToDict(pb_eval.result))
            dataframe = DataFrame(
                rows,
                index=MultiIndex.from_arrays(
                    (span_ids, document_positions),
                    names=("context.span_id", "document_position"),
                ),
            )
            evaluations.append(DocumentEvaluations(eval_name, dataframe))
        return evaluations
