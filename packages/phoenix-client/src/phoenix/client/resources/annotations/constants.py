from typing import get_args

from .types import AnnotatorKind

VALID_ANNOTATOR_KINDS: frozenset[AnnotatorKind] = frozenset(get_args(AnnotatorKind))
