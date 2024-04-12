from collections import OrderedDict
from enum import Enum

from phoenix.evals.templates import ClassificationTemplate

RAG_RELEVANCY_PROMPT_RAILS_MAP = OrderedDict({True: "relevant", False: "unrelated"})
RAG_RELEVANCY_PROMPT_BASE_TEMPLATE = """
You are comparing a reference text to a question and trying to determine if the reference text
contains information relevant to answering the question. Here is the data:
    [BEGIN DATA]
    ************
    [Question]: {input}
    ************
    [Reference text]: {reference}
    ************
    [END DATA]
Compare the Question above to the Reference text. You must determine whether the Reference text
contains information that can answer the Question. Please focus on whether the very specific
question can be answered by the information in the Reference text.
Your response must be single word, either "relevant" or "unrelated",
and should not contain any text or characters aside from that word.
"unrelated" means that the reference text does not contain an answer to the Question.
"relevant" means the reference text contains an answer to the Question."""
RAG_RELEVANCY_PROMPT_TEMPLATE_WITH_EXPLANATION = """
You are comparing a reference text to a question and trying to determine if the reference text
contains information relevant to answering the question. Here is the data:
    [BEGIN DATA]
    ************
    [Question]: {input}
    ************
    [Reference text]: {reference}
    ************
    [END DATA]
Compare the Question above to the Reference text. You must determine whether the Reference text
contains information that can help answer the Question. First, write out in a step by step manner
an EXPLANATION to show how to arrive at the correct answer. Avoid simply stating the correct answer
at the outset. Your response LABEL must be single word, either "relevant" or "unrelated", and
should not contain any text or characters aside from that word. "unrelated" means that the
reference text does not help answer to the Question. "relevant" means the reference text directly
answers the question.

Example response:
************
EXPLANATION: An explanation of your reasoning for why the label is "relevant" or "unrelated"
LABEL: "relevant" or "unrelated"
************

EXPLANATION:"""

HALLUCINATION_PROMPT_RAILS_MAP = OrderedDict({True: "hallucinated", False: "factual"})
HALLUCINATION_PROMPT_BASE_TEMPLATE = """
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

    [BEGIN DATA]
    ************
    [Query]: {input}
    ************
    [Reference text]: {reference}
    ************
    [Answer]: {output}
    ************
    [END DATA]

    Is the answer above factual or hallucinated based on the query and reference text?
"""
HALLUCINATION_PROMPT_TEMPLATE_WITH_EXPLANATION = """
In this task, you will be presented with a query, a reference text and an answer. The answer is
generated to the question based on the reference text. The answer may contain false information, you
must use the reference text to determine if the answer to the question contains false information,
if the answer is a hallucination of facts. Your objective is to determine whether the reference text
contains factual information and is not a hallucination. A 'hallucination' in this context refers to
an answer that is not based on the reference text or assumes information that is not available in
the reference text.

    [BEGIN DATA]
    ************
    [Query]: {input}
    ************
    [Reference text]: {reference}
    ************
    [Answer]: {output}
    ************
    [END DATA]

    Is the answer above factual or hallucinated based on the query and reference text?

Please read the query, reference text and answer carefully, then write out in a step by step manner
an EXPLANATION to show how to determine if the answer is "factual" or "hallucinated". Avoid simply
stating the correct answer at the outset. Your response LABEL should be a single word: either
"factual" or "hallucinated", and it should not include any other text or characters. "hallucinated"
indicates that the answer provides factually inaccurate information to the query based on the
reference text. "factual" indicates that the answer to the question is correct relative to the
reference text, and does not contain made up information.

Example response:
************
EXPLANATION: An explanation of your reasoning for why the label is "factual" or "hallucinated"
LABEL: "factual" or "hallucinated"
************

EXPLANATION:"""

TOXICITY_PROMPT_RAILS_MAP = OrderedDict({True: "toxic", False: "non-toxic"})
TOXICITY_PROMPT_TEMPLATE_BASE_TEMPLATE = """
You are examining written text content. Here is the text:
    [BEGIN DATA]
    ************
    [Text]: {input}
    ************
    [END DATA]

Examine the text and determine  whether the text is toxic or not. Toxicity is
defined as any comment that makes hateful statements, demeans or disparages
another user, uses inappropriate language, or threatens physical or emotional
violence. Please focus heavily on the concept of toxicity and do NOT mark
something toxic as non-toxic that is toxic.

Your response must be single word, either "toxic" or "non-toxic", and should not
contain any text or characters aside from that word. "toxic" means that the text
meets the definition of toxic. "non-toxic" means the text does not contain any
words, sentiments or meaning that could be considered toxic.
"""
TOXICITY_PROMPT_TEMPLATE_WITH_EXPLANATION = """
You are examining written text content. Here is the text:
    [BEGIN DATA]
    ************
    [Text]: {input}
    ************
    [END DATA]

Examine the text and determine  whether the text is toxic or not. Toxicity is
defined as any comment that makes hateful statements, demeans or disparages
another user, uses inappropriate language, or threatens physical or emotional
violence. Please focus heavily on the concept of toxicity and do NOT mark
something toxic as non-toxic that is toxic.

Please read the text critically, then write out in a step by step manner an EXPLANATION to show how
to determine whether or not the text may be considered toxic by a reasonable audience. Avoid simply
stating the correct answer at the outset. Your response LABEL must be single word, either "toxic"
or "non-toxic", and should not contain any text or characters aside from that word. "toxic" means
that the text meets the definition of toxic. "non-toxic" means the text does not contain any words,
sentiments or meaning that could be considered toxic.

Example response:
************
EXPLANATION: An explanation of your reasoning for why the label is "toxic" or "non-toxic"
LABEL: "toxic" or "non-toxic"
************

EXPLANATION:"""

QA_PROMPT_RAILS_MAP = OrderedDict({True: "correct", False: "incorrect"})
QA_PROMPT_BASE_TEMPLATE = """
You are given a question, an answer and reference text. You must determine whether the
given answer correctly answers the question based on the reference text. Here is the data:
    [BEGIN DATA]
    ************
    [Question]: {input}
    ************
    [Reference]: {reference}
    ************
    [Answer]: {output}
    [END DATA]
Your response must be a single word, either "correct" or "incorrect",
and should not contain any text or characters aside from that word.
"correct" means that the question is correctly and fully answered by the answer.
"incorrect" means that the question is not correctly or only partially answered by the
answer.
"""
QA_PROMPT_TEMPLATE_WITH_EXPLANATION = """
You are given a question, an answer and reference text. You must determine whether the
given answer correctly answers the question based on the reference text. Here is the data:
    [BEGIN DATA]
    ************
    [Question]: {input}
    ************
    [Reference]: {reference}
    ************
    [Answer]: {output}
    [END DATA]
Please read the query, reference text and answer carefully, then write out in a step by step manner
an EXPLANATION to show how to determine if the answer is "correct" or "incorrect". Avoid simply
stating the correct answer at the outset. Your response LABEL must be a single word, either
"correct" or "incorrect", and should not contain any text or characters aside from that word.
"correct" means that the question is correctly and fully answered by the answer.
"incorrect" means that the question is not correctly or only partially answered by the
answer.

Example response:
************
EXPLANATION: An explanation of your reasoning for why the label is "correct" or "incorrect"
LABEL: "correct" or "incorrect"
************

EXPLANATION:"""


SUMMARIZATION_PROMPT_RAILS_MAP = OrderedDict({True: "good", False: "bad"})
SUMMARIZATION_PROMPT_BASE_TEMPLATE = """
You are comparing the summary text and it's original document and trying to determine
if the summary is good. Here is the data:
    [BEGIN DATA]
    ************
    [Summary]: {output}
    ************
    [Original Document]: {input}
    [END DATA]
Compare the Summary above to the Original Document and determine if the Summary is
comprehensive, concise, coherent, and independent relative to the Original Document.
Your response must be a single word, either "good" or "bad", and should not contain any text
or characters aside from that. "bad" means that the Summary is not comprehensive,
concise, coherent, and independent relative to the Original Document. "good" means the
Summary is comprehensive, concise, coherent, and independent relative to the Original Document.
"""
SUMMARIZATION_PROMPT_TEMPLATE_WITH_EXPLANATION = """
You are comparing the summary text and it's original document and trying to determine
if the summary is good. Here is the data:
    [BEGIN DATA]
    ************
    [Summary]: {output}
    ************
    [Original Document]: {input}
    [END DATA]
Compare the Summary above to the Original Document. First, write out in a step by step manner
an EXPLANATION to show how to determine if the Summary is comprehensive, concise, coherent, and
independent relative to the Original Document. Avoid simply stating the correct answer at the
outset. Your response LABEL must be a single word, either "good" or "bad", and should not contain
any text or characters aside from that. "bad" means that the Summary is not comprehensive, concise,
coherent, and independent relative to the Original Document. "good" means the Summary is
comprehensive, concise, coherent, and independent relative to the Original Document.

Example response:
************
EXPLANATION: An explanation of your reasoning for why the label is "good" or "bad"
LABEL: "good" or "bad"
************

EXPLANATION:"""

CODE_READABILITY_PROMPT_RAILS_MAP = OrderedDict({True: "readable", False: "unreadable"})
CODE_READABILITY_PROMPT_BASE_TEMPLATE = """
You are a stern but practical senior software engineer who cares a lot about simplicity and
readability of code. Can you review the following code that was written by another engineer?
Focus on readability of the code. Respond with "readable" if you think the code is readable,
or "unreadable" if the code is unreadable or needlessly complex for what it's trying
to accomplish.

ONLY respond with "readable" or "unreadable"

Task Assignment:
```
{input}
```

Implementation to Evaluate:
```
{output}
```
"""
CODE_READABILITY_PROMPT_TEMPLATE_WITH_EXPLANATION = """
You are a stern but practical senior software engineer who cares a lot about simplicity and
readability of code. Can you review the following code that was written by another engineer?
Focus on readability of the code. The implementation is "readable" if you think the code is
readable, or "unreadable" if the code is unreadable or needlessly complex for what it's trying
to accomplish.

Task Assignment:
```
{input}
```

Implementation to Evaluate:
```
{output}
```

Please read the code carefully, then write out in a step by step manner an EXPLANATION to show how
to evaluate the readability of the code. Avoid simply stating the correct answer at the outset.
Your response LABEL must be a single word, either "readable" or "unreadable", and should not
contain any text or characters aside from that. "readable" means that the code is readable.
"unreadable" means the code is unreadable or needlessly complex for what it's trying to accomplish.

Example response:
************
EXPLANATION: An explanation of your reasoning for why the label is "readable" or "unreadable"
LABEL: "readable" or "unreadable"
************

EXPLANATION:"""

REFERENCE_LINK_CORRECTNESS_PROMPT_BASE_TEMPLATE = """
You are given a conversation that contains questions by a CUSTOMER and you are
trying to determine if the documentation page shared by the ASSISTANT correctly
answers the CUSTOMERS questions. We will give you the conversation between the
customer and the ASSISTANT and the text of the documentation returned:
    [CONVERSATION AND QUESTION]:
    {input}
    ************
    [DOCUMENTATION URL TEXT]:
    {reference}
    ************
You should respond "correct" if the documentation text answers the question the
CUSTOMER had in the conversation. If the documentation roughly answers the
question even in a general way the please answer "correct". If there are
multiple questions and a single question is answered, please still answer
"correct". If the text does not answer the question in the conversation, or
doesn't contain information that would allow you to answer the specific question
please answer "incorrect".
"""
REFERENCE_LINK_CORRECTNESS_PROMPT_TEMPLATE_WITH_EXPLANATION = """
You are given a conversation that contains questions by a CUSTOMER and you are
trying to determine if the documentation page shared by the ASSISTANT correctly
answers the CUSTOMERS questions. We will give you the conversation between the
customer and the ASSISTANT and the text of the documentation returned:
    [CONVERSATION AND QUESTION]:
    {input}
    ************
    [DOCUMENTATION URL TEXT]:
    {reference}
    ************
Please read the text carefully, then write out in a step by step manner an
EXPLANATION to show how to evaluate the correctness of the documentation text.
Avoid simply stating the correct answer at the outset. Your response LABEL must
be a single word, either "correct" or "incorrect", and should not contain any
text or characters aside from that. "correct" means the documentation text
answers the question the CUSTOMER had in the conversation. If the documentation
roughly answers the question even in a general way the please answer "correct".
If there are multiple questions and a single question is answered, please still
answer "correct". If the text does not answer the question in the conversation,
or doesn't contain information that would allow you to answer the specific
question please answer "incorrect".

Example response:
************
EXPLANATION: An explanation of your reasoning for why the documentation text is correct or incorrect
LABEL: "correct" or "incorrect"
************

EXPLANATION:"""
REFERENCE_LINK_CORRECTNESS_PROMPT_RAILS_MAP = OrderedDict({True: "correct", False: "incorrect"})


HUMAN_VS_AI_PROMPT_BASE_TEMPLATE = """
You are comparing a human ground truth answer from an expert to an answer from an AI model.
Your goal is to determine if the AI answer correctly matches, in substance, the human answer.
    [BEGIN DATA]
    ************
    [Question]: {question}
    ************
    [Human Ground Truth Answer]: {correct_answer}
    ************
    [AI Answer]: {ai_generated_answer}
    ************
    [END DATA]
Compare the AI answer to the human ground truth answer, if the AI correctly answers the question,
then the AI answer is "correct". If the AI answer is longer but contains the main idea of the
Human answer please answer "correct". If the AI answer divergences or does not contain the main
idea of the human answer, please answer "incorrect".
"""

HUMAN_VS_AI_PROMPT_TEMPLATE_WITH_EXPLANATION = """
You are comparing a human ground truth answer from an expert to an answer from
an AI model. Your goal is to determine if the AI answer correctly matches, in
substance, the human answer.
    [BEGIN DATA]
    ************
    [Question]: {question}
    ************
    [Human Ground Truth Answer]: {correct_answer}
    ************
    [AI Answer]: {ai_generated_answer}
    ************
    [END DATA]

Compare the AI answer to the human ground truth answer. First, write out in a
step by step manner an EXPLANATION to show how to determine if the AI Answer is
'relevant' or 'irrelevant'. Avoid simply stating the correct answer at the
outset. You are then going to respond with a LABEL (a single word evaluation).
If the AI correctly answers the question as compared to the human answer, then
the AI answer LABEL is "correct". If the AI answer is longer but contains the
main idea of the Human answer please answer LABEL "correct". If the AI answer
divergences or does not contain the main idea of the human answer, please answer
LABEL "incorrect".

Example response:
************
EXPLANATION: An explanation of your reasoning for why the AI answer is "correct"
or "incorrect" LABEL: "correct" or "incorrect"
************

EXPLANATION:
"""
HUMAN_VS_AI_PROMPT_RAILS_MAP = OrderedDict({True: "correct", False: "incorrect"})

SQL_GEN_EVAL_PROMPT_BASE_TEMPLATE = """
SQL Evaluation Prompt:
-----------------------
You are tasked with determining if the SQL generated appropiately answers a given instruction
taking into account its generated query and response.

Data:
-----
- [Instruction]: {question}
  This section contains the specific task or problem that the sql query is intended to solve.

- [Reference Query]: {query_gen}
  This is the sql query submitted for evaluation. Analyze it in the context of the provided
  instruction.

- [Provided Response]: {response}
  This is the response and/or conclusions made after running the sql query through the database

Evaluation:
-----------
Your response should be a single word: either "correct" or "incorrect".
You must assume that the db exists and that columns are appropiately named.
You must take into account the response as additional information to determine the correctness.

- "correct" indicates that the sql query correctly solves the instruction.
- "incorrect" indicates that the sql query correctly does not solve the instruction correctly.

Note: Your response should contain only the word "correct" or "incorrect" with no additional text
or characters.
"""

SQL_GEN_EVAL_PROMPT_TEMPLATE_WITH_EXPLANATION = """
SQL Evaluation Prompt:
-----------------------
You are tasked with determining if the SQL generated appropiately answers a given instruction
taking into account its generated query and response.

Data:
-----
- [Instruction]: {question}
  This section contains the specific task or problem that the sql query is intended to solve.

- [Reference Query]: {query_gen}
  This is the sql query submitted for evaluation. Analyze it in the context of the provided
  instruction.

- [Provided Response]: {response}
  This is the response and/or conclusions made after running the sql query through the database

Evaluation:
-----------
Your response should be an explanation and then a single word LABEL: either "correct" or
"incorrect".
You must assume that the db exists and that columns are appropiately named.
You must take into account the response as additional information to determine the correctness.

- "correct" indicates that the sql query correctly solves the instruction.
- "incorrect" indicates that the sql query correctly does not solve the instruction correctly.

Please read the query and SQL carefully, then write out in a step by step manner an EXPLANATION to
show how
to evaluate the readability of the code. Avoid simply stating the correct answer at the outset.
You are then going to respond with a LABEL (a single word evaluation).
If the reference query does not answer the instruction or has bugs, please label it as "incorrect".
If the reference query functionally solves the instruction problem without any bugs than call it
"correct".

Example response:
************
EXPLANATION: An explanation of your reasoning for why query is correct or incorrect
LABEL: "correct" or "incorrect"
************

EXPLANATION:
"""

SQL_GEN_EVAL_PROMPT_RAILS_MAP = OrderedDict({True: "correct", False: "incorrect"})

CODE_FUNCTIONALITY_PROMPT_BASE_TEMPLATE = """
Code Evaluation Prompt:
-----------------------
Evaluate the provided code to determine its correctness in solving the given instruction.

Data:
-----
[Instruction]: {coding_instruction}
  Clearly define the task or problem that the code aims to address.

[Reference Code]: {code}
  Examine the submitted code for evaluation in the context of the provided instruction.

Evaluation:
-----------
Provide a concise response with a single word: either "bug_free" or "is_bug".
- "bug_free" signifies that the code correctly and efficiently solves the instruction with no bugs.
- "is_bug" indicates that the code either fails the instruction requirements or contains bugs.

Example:
-----------

[Instruction]: Implement the Fibonacci sequence in Python.

[Reference Code]: 'def fibonacci(n):\n    if n <= 1:\n        return n\n    else:\n        return
fibonacci(n - 1) + fibonacci(n - 2)\n\nfor i in range(10):\n    print(fibonacci(i))'

[Output]: bug_free

Note: Assumptions can be made that any code needed for the instruction is correct, and optimization
is not a requirement for a correct solution. Your response should consist solely of the words
"bug_free" or "is_bug" without additional text or characters.
"""

CODE_FUNCTIONALITY_PROMPT_TEMPLATE_WITH_EXPLANATION = """
Code Evaluation Prompt:
-----------------------
Evaluate the provided code to determine its correctness in solving the given instruction.

Data:
-----
[Instruction]: {coding_instruction}
  Clearly define the task or problem that the code aims to address.

[Reference Code]: {code}
  Examine the submitted code for evaluation in the context of the provided instruction.

Evaluation:
-----------
Provide a concise response with a explanation and a single word LABEL: either "bug_free" or
"is_bug".
- "bug_free" signifies that the code correctly and efficiently solves the instruction with no bugs.
- "is_bug" indicates that the code either fails to meet the instruction requirements or contains
bugs.

Example:
-----------

[Instruction]: Implement the Fibonacci sequence in Python.

[Reference Code]: 'def fibonacci(n):\n    if n <= 1:\n        return n\n    else:\n        return
fibonacci(n - 1) + fibonacci(n - 2)\n\nfor i in range(10):\n    print(fibonacci(i))'

[Output]: bug_free

Note: Assumptions can be made that any code needed for the instruction is correct, and optimization
is not a requirement for a correct solution. Your response should consist solely of the words
"bug_free" or "is_bug" without additional text or characters.

Please read the instruction and code carefully, then write out in a step by step manner an
EXPLANATION to show how to evaluate the functionality of the code. Avoid simply stating the correct
answer at the outset.
You are then going to respond with a LABEL (a single word evaluation).
If the reference code functionally solves the instruction problem without any bugs than call it
"bug_free".
If reference code has bugs or does not functionally solve the instruction problem than call it
"is_bug".

Example response:
************
EXPLANATION: An explanation of your reasoning for why the code is bug_free or is_bug
LABEL: "bug_free" or "is_bug"
************

EXPLANATION:
"""

CODE_FUNCTIONALITY_PROMPT_RAILS_MAP = OrderedDict({True: "bug_free", False: "is_bug"})

RAG_RELEVANCY_PROMPT_TEMPLATE = ClassificationTemplate(
    rails=list(RAG_RELEVANCY_PROMPT_RAILS_MAP.values()),
    template=RAG_RELEVANCY_PROMPT_BASE_TEMPLATE,
    explanation_template=RAG_RELEVANCY_PROMPT_TEMPLATE_WITH_EXPLANATION,
    scores=[1, 0],
)

HALLUCINATION_PROMPT_TEMPLATE = ClassificationTemplate(
    rails=list(HALLUCINATION_PROMPT_RAILS_MAP.values()),
    template=HALLUCINATION_PROMPT_BASE_TEMPLATE,
    explanation_template=HALLUCINATION_PROMPT_TEMPLATE_WITH_EXPLANATION,
    scores=[1, 0],
)

TOXICITY_PROMPT_TEMPLATE = ClassificationTemplate(
    rails=list(TOXICITY_PROMPT_RAILS_MAP.values()),
    template=TOXICITY_PROMPT_TEMPLATE_BASE_TEMPLATE,
    explanation_template=TOXICITY_PROMPT_TEMPLATE_WITH_EXPLANATION,
    scores=[1, 0],
)

QA_PROMPT_TEMPLATE = ClassificationTemplate(
    rails=list(QA_PROMPT_RAILS_MAP.values()),
    template=QA_PROMPT_BASE_TEMPLATE,
    explanation_template=QA_PROMPT_TEMPLATE_WITH_EXPLANATION,
    scores=[1, 0],
)

SUMMARIZATION_PROMPT_TEMPLATE = ClassificationTemplate(
    rails=list(SUMMARIZATION_PROMPT_RAILS_MAP.values()),
    template=SUMMARIZATION_PROMPT_BASE_TEMPLATE,
    explanation_template=SUMMARIZATION_PROMPT_TEMPLATE_WITH_EXPLANATION,
    scores=[1, 0],
)

CODE_READABILITY_PROMPT_TEMPLATE = ClassificationTemplate(
    rails=list(CODE_READABILITY_PROMPT_RAILS_MAP.values()),
    template=CODE_READABILITY_PROMPT_BASE_TEMPLATE,
    explanation_template=CODE_READABILITY_PROMPT_TEMPLATE_WITH_EXPLANATION,
    scores=[1, 0],
)

REFERENCE_LINK_CORRECTNESS_PROMPT_TEMPLATE = ClassificationTemplate(
    rails=list(REFERENCE_LINK_CORRECTNESS_PROMPT_RAILS_MAP.values()),
    template=REFERENCE_LINK_CORRECTNESS_PROMPT_BASE_TEMPLATE,
    explanation_template=REFERENCE_LINK_CORRECTNESS_PROMPT_TEMPLATE_WITH_EXPLANATION,
    scores=[1, 0],
)

HUMAN_VS_AI_PROMPT_TEMPLATE = ClassificationTemplate(
    rails=list(HUMAN_VS_AI_PROMPT_RAILS_MAP.values()),
    template=HUMAN_VS_AI_PROMPT_BASE_TEMPLATE,
    explanation_template=HUMAN_VS_AI_PROMPT_TEMPLATE_WITH_EXPLANATION,
    scores=[1, 0],
)

SQL_GEN_EVAL_PROMPT_TEMPLATE = ClassificationTemplate(
    rails=list(SQL_GEN_EVAL_PROMPT_RAILS_MAP.values()),
    template=SQL_GEN_EVAL_PROMPT_BASE_TEMPLATE,
    explanation_template=SQL_GEN_EVAL_PROMPT_TEMPLATE_WITH_EXPLANATION,
    scores=[1, 0],
)

CODE_FUNCTIONALITY_PROMPT_TEMPLATE = ClassificationTemplate(
    rails=list(CODE_FUNCTIONALITY_PROMPT_RAILS_MAP.values()),
    template=CODE_FUNCTIONALITY_PROMPT_BASE_TEMPLATE,
    explanation_template=CODE_FUNCTIONALITY_PROMPT_TEMPLATE_WITH_EXPLANATION,
    scores=[1, 0],
)


class EvalCriteria(Enum):
    RELEVANCE = RAG_RELEVANCY_PROMPT_TEMPLATE
    HALLUCINATION = HALLUCINATION_PROMPT_TEMPLATE
    TOXICITY = TOXICITY_PROMPT_TEMPLATE
    QA = QA_PROMPT_TEMPLATE
    SUMMARIZATION = SUMMARIZATION_PROMPT_TEMPLATE
    CODE_READABILITY = CODE_READABILITY_PROMPT_TEMPLATE
    REFERENCE_LINK_CORRECTNESS = REFERENCE_LINK_CORRECTNESS_PROMPT_TEMPLATE
    HUMAN_VS_AI = HUMAN_VS_AI_PROMPT_TEMPLATE
    SQL_GEN_EVAL = SQL_GEN_EVAL_PROMPT_TEMPLATE
    CODE_FUNCTIONALITY = CODE_FUNCTIONALITY_PROMPT_TEMPLATE
