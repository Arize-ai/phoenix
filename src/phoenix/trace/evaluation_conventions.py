# Evaluation conventions

# a sub-category of semantic conventions that maps to the evaluation of the different types of spans
# and traces. evaluation attributes differ from other attributes in that they rely on evaluators
# that are run on the spans to generate the evaluation results.


EVAL_DOCUMENT_RELEVANCIES = "eval.document_relevancies"
"""
A list of relevancies for the documents of a retriever span. An Int value of 1 or
0 indicates whether the document is relevant to the input query.
"""

EVAL_DOCUMENTS_PRECISION = "eval.documents_precision"
"""
The precision of a retriever.
This is the proportion (expressed as a value between 0 and 1) of relevant documents over the total.
"""

EVAL_DOCUMENTS_PRECISION_AT_K_TEMPLATE = "eval.documents_precision_at_{k}"
"""
The prefix given to an evaluation metric that captures the precision of a
retriever up to K. E.x. you would have eval.documents_precision_at_1,
eval.documents_precision_at_2, etc. This value would be computed on top of the
document_relevancy attribute of each document.
"""
