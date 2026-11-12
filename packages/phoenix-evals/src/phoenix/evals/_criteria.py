from typing import Dict, List, Optional, Union

from typing_extensions import NotRequired, TypedDict

__all__ = ["ClassificationCriterion"]


class ClassificationCriterion(TypedDict):
    """A single named classification question sent to a classification backend.

    This is the backend-level view of a criterion, shared by every backend that can answer
    classification questions (decision models and LLMs). The richer, evaluator-level
    ``Criterion`` lives in ``phoenix.evals.evaluators``; keeping this lighter type in a leaf
    module avoids a circular import (the backends sit below ``evaluators`` in the import graph)
    and keeps adapters decoupled from the evaluator layer's scoring concerns.

    Keys:
        name: Question name; becomes the key used to look the answer back up.
        labels: Either a list of label strings, or a dict mapping each label to a description.
        instructions: Optional per-question instructions (the criterion's description).
    """

    name: str
    labels: Union[List[str], Dict[str, str]]
    instructions: NotRequired[Optional[str]]
