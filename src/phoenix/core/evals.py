import weakref
from collections import defaultdict
from queue import SimpleQueue
from threading import RLock, Thread
from types import MethodType
from typing import DefaultDict, Dict, List, Optional
from uuid import UUID

import numpy as np
from typing_extensions import TypeAlias

import phoenix.trace.v1 as pb
from phoenix.trace.schemas import SpanID, TraceID

END_OF_QUEUE = None  # sentinel value for queue termination

EvaluationName: TypeAlias = str
DocumentPosition: TypeAlias = int


class Evals:
    def __init__(self) -> None:
        self._queue: "SimpleQueue[Optional[pb.Evaluation]]" = SimpleQueue()
        weakref.finalize(self, self._queue.put, END_OF_QUEUE)
        self._lock = RLock()
        self._start_consumer()
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
        self._document_evaluations_by_span_id: DefaultDict[
            SpanID, DefaultDict[EvaluationName, Dict[DocumentPosition, pb.Evaluation]]
        ] = defaultdict(lambda: defaultdict(dict))

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
            span_id = UUID(document_retrieval_id.span_id)
            document_position = document_retrieval_id.document_position
            self._document_evaluations_by_span_id[span_id][name][document_position] = evaluation
        elif subject_id_kind == "span_id":
            span_id = UUID(subject_id.span_id)
            self._evaluations_by_span_id[span_id][name] = evaluation
            self._span_evaluations_by_name[name][span_id] = evaluation
        elif subject_id_kind == "trace_id":
            trace_id = UUID(subject_id.trace_id)
            self._evaluations_by_span_id[trace_id][name] = evaluation
            self._trace_evaluations_by_name[name][trace_id] = evaluation
        else:
            raise ValueError(f"unrecognized subject_id type: {type(subject_id_kind)}")

    def get_span_evaluation_names(self) -> List[EvaluationName]:
        with self._lock:
            return list(self._span_evaluations_by_name.keys())

    def get_evaluations_by_span_id(self, span_id: SpanID) -> List[pb.Evaluation]:
        with self._lock:
            return list(self._evaluations_by_span_id[span_id].values())

    def get_document_evaluations_by_span_id(self, span_id: SpanID) -> List[pb.Evaluation]:
        all_evaluations: List[pb.Evaluation] = []
        with self._lock:
            for evaluations in self._document_evaluations_by_span_id[span_id].values():
                all_evaluations.extend(evaluations.values())
        return all_evaluations

    def get_document_evaluations(
        self, span_id: SpanID, evaluation_name: str, num_documents: int
    ) -> List[Optional[pb.Evaluation]]:
        relevance_evaluations: List[Optional[pb.Evaluation]] = [None] * num_documents
        with self._lock:
            evaluations = self._document_evaluations_by_span_id[span_id][evaluation_name]
        for document_position, document_relevance in evaluations.items():
            if document_position < len(relevance_evaluations):
                relevance_evaluations[document_position] = document_relevance
        return relevance_evaluations

    def get_document_evaluation_scores(
        self, span_id: SpanID, evaluation_name: str, num_documents: int
    ) -> List[Optional[float]]:
        scores: List[Optional[float]] = [np.nan] * num_documents
        with self._lock:
            evaluations = self._document_evaluations_by_span_id[span_id][evaluation_name]
        for document_position, document_relevance in evaluations.items():
            result = document_relevance.result
            if result.HasField("score") and document_position < len(scores):
                scores[document_position] = document_relevance.result.score.value
        return scores
