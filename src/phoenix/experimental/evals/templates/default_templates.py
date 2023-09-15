RAG_RELEVANCY_PROMPT_RAILS = ["relevant", "irrelevant"]
RAG_RELEVANCY_PROMPT_TEMPLATE_STR = """
You are comparing a reference text to a question and trying to determine if the reference text
contains information relevant to answering the question. Here is the data:
    [BEGIN DATA]
    ************
    [Question]: {query}
    ************
    [Reference text]: {reference}
    [END DATA]

Compare the Question above to the Reference text. You must determine whether the Reference text
contains information that can answer the Question. Please focus on whether the very specific
question can be answered by the information in the Reference text.
Your response must be single word, either "relevant" or "irrelevant",
and should not contain any text or characters aside from that word.
"irrelevant" means that the reference text does not contain an answer to the Question.
"relevant" means the reference text contains an answer to the Question.
"""

HALLUCINATION_PROMPT_RAILS = ["factual", "hallucinated"]
HALLUCINATION_PROMPT_TEMPLATE_STR = """
In this task, you will be presented with a query, a reference text and an answer. The answer is
generated to the question based on the reference text. The answer may contain false information, you
must use the reference text to determine if the answer to the question contains false information,
if the answer is a hallucination of facts. Your objective is to determine whether the reference text
contains factual information and is not a hallucination. A 'hallucination' in this context refers to
an answer that is not based on the reference text or assumes information that is not available in
the reference text. Your response should be a single word: either "factual" or "hallucinated", and
it should not include any other text or characters. "hallucinated" indicates that the answer
provides factually inaccurate information to the query based on the reference text. "factual"
indicates that the answer to the question is correct relative to the reference text, and does not
contain made up information. Please read the query and reference text carefully before determining
your response.

    # Query: {query}
    # Reference text: {reference}
    # Answer: {response}
    Is the answer above factual or hallucinated based on the query and reference text?
"""

QA_PROMPT_TEMPLATE_STR = """
You are given a question, an answer and reference text. You must determine whether the
given answer correctly answers the question based on the reference text. Here is the data:
    [BEGIN DATA]
    ************
    [Question]: {question}
    ************
    [Reference]: {context}
    ************
    [Answer]: {sampled_answer}
    [END DATA]
Your response must be a single word, either "correct" or "incorrect",
and should not contain any text or characters aside from that word.
"correct" means that the question is correctly and fully answered by the answer.
"incorrect" means that the question is not correctly or only partially answered by the
answer.
"""
# The prompt output map is used to map 1) to provide rails to the llm in order to constrain
# the llm's outputs to the expected values. 2) golden dataset ground truth boolean values
# to the llm output
QA_PROMPT_OUTPUT_RAILS_MAP = {True: "correct", False: "incorrect"}

SUMMARIZATION_PROMPT_TEMPLATE_STR = """
    You are comparing the summary text and it's original document and trying to determine
    if the summary is good. Here is the data:
    [BEGIN DATA]
    ************
    [Summary]: {summary}
    ************
    [Original Document]: {document}
    [END DATA]
    Compare the Summary above to the Original Document and determine if the Summary is
    comprehensive, concise, coherent, and independent relative to the Original Document.
    Your response must be a string, either Good or Bad, and should not contain any text
    or characters aside from that. Bad means that the Summary is not comprehensive, concise,
    coherent, and independent relative to the Original Document. Good means the Summary
    is comprehensive, concise, coherent, and independent relative to the Original Document.
"""
# The prompt output map is used to map 1) to provide rails to the llm in order to constrain
# the llm's outputs to the expected values. 2) golden dataset ground truth boolean values
# to the llm output
SUMMARIZATION_PROMPT_OUTPUT_MAP = {True: "Good", False: "Bad"}
