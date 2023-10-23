# Evaluation conventions
# a sub-category of conventions that maps to the evaluation of the different types of spans
# and traces. evaluation attributes differ from other attributes in that they rely on evaluators
# that are run on the spans to generate the evaluation results.

EVAL_DOCUMENT_RELEVANCY = "eval.document_relevancy"
"""
Attached to a document within a retriever span. An Int value of 1 or
0 indicating whether the document is relevant to the input query.
"""

EVAL_DOCUMENTS_RELEVANCY_PERCENT = "eval.documents_relevancy_percent"
"""
Span level attribute denoting the percentage of relevant documents that were
outputted by the span (typically a retriever).
"""

EVAL_DOCUMENTS_PRECISION = "eval.documents_precision"
"""
The precision of a retriever.
This is the percentage of relevant documents over the total
"""

EVAL_DOCUMENTS_PRECISION_AT_K = "eval.documents_precision_at_k"
"""
An K dimensional array of precision values for each K in the range [1, K].
This value would be computed on top of the document_relevancy attribute of each document.
E.x. a relevancy of [0, 1, 1, 0, 1] would result in a precision_at_k of [0, 0.5, 0.66, 0.5, 0.6]
"""
