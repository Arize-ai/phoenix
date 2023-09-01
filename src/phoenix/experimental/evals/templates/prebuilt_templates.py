RAG_RELEVANCY_PROMPT_TEMPLATE_STR = """
    You are comparing a reference text to a question and trying to determine if the reference text contains
    information relevant to answering the question. Here is the data:
    [BEGIN DATA]
    ************
    [Question]: {query}
    ************
    [Reference text]: {reference}
    [END DATA]

    Compare the Question above to the Reference text. You must determine whether the Reference text contains
    information that can answer the Question. Please focus on whether the very specific question can be
    answered by the information in the Reference text.
    Your response must be single word, either "relevant" or "irrelevant",
    and should not contain any text or characters aside from that word.
    "irrelevant" means that the reference text does not contain an answer to the Question.
    "relevant" means the reference text contains an answer to the Question.
"""
