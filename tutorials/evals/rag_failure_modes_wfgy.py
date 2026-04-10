"""
Tutorial: RAG failure-mode evaluation with a WFGY-style checklist.

This script runs a tiny FAQ-style RAG demo and then asks an LLM to score
the run on:
- "retrieval_relevance"   (0..3)
- "answer_hallucination"  (0..3)
plus a short free-form comment.

The scoring rubric is adapted from the open-source WFGY 16-problem
ProblemMap (MIT licensed) as a lightweight example of incident-style
RAG diagnostics.

The goal is to show how you can attach simple, human-readable
"failure labels" to each RAG run, which can later be logged,
visualized, or combined with Phoenix evals.
"""

# If you are running this inside a notebook (for example, Colab) and want
# a single cell to install dependencies, you can uncomment the line below.
# In the Phoenix repo this line should stay commented out.
# !pip install -q "openai>=1.58.1" "pandas>=2.0.0"

import os
import json
import getpass
import textwrap

from openai import OpenAI
import pandas as pd


# ---- 1. Ask for API key at runtime -----------------------------------------
# The API key is requested interactively so that it is never hard-coded
# into the file. This makes the example safe to commit to a public repo.
api_key = getpass.getpass("Enter your OpenAI API key: ")
os.environ["OPENAI_API_KEY"] = api_key

client = OpenAI()


# ---- 2. Tiny fake knowledge base for a RAG demo ----------------------------
# In a real application this would be a vector store or document collection.
# Here we keep it as three short FAQ entries for clarity.
KB = {
    "faq_1": (
        "We accept credit cards and PayPal for subscription payments. "
        "We do not support cryptocurrency payments such as Bitcoin."
    ),
    "faq_2": (
        "You can manage or cancel your subscription from the billing page "
        "in your account settings at any time."
    ),
    "faq_3": (
        "Our support team usually replies within 24 hours on business days."
    ),
}


def simple_retriever(query: str):
    """
    Extremely naive retriever used only for this tutorial.

    For demonstration purposes it ignores the query and always returns the
    same two FAQ entries (faq_1 and faq_2). This keeps the example focused
    on how we score failure modes, rather than on retrieval quality itself.
    """
    retrieved_ids = ["faq_1", "faq_2"]
    contexts = [KB[_id] for _id in retrieved_ids]
    return retrieved_ids, contexts


# ---- 3. Run a toy RAG pipeline --------------------------------------------
# We simulate a single RAG request: a user asking about Bitcoin payments.
query = "Can I pay my subscription with Bitcoin?"

# Retrieve a couple of FAQ entries and join them into a single context block.
retrieved_ids, contexts = simple_retriever(query)
rag_context = "\n\n".join(contexts)

# Ask the model to answer strictly from the provided context.
answer_completion = client.chat.completions.create(
    model="gpt-4o-mini",
    temperature=0.0,
    messages=[
        {
            "role": "system",
            "content": (
                "You are a support agent. Answer using ONLY the provided "
                "knowledge base. If the answer is not in the knowledge base, "
                "say you do not know."
            ),
        },
        {
            "role": "user",
            "content": (
                "Knowledge base:\n"
                f"{rag_context}\n\n"
                f"Question: {query}"
            ),
        },
    ],
)

answer = answer_completion.choices[0].message.content.strip()


# ---- 4. Ask the LLM to score this RAG run (WFGY-style) --------------------
# Here we reuse an LLM as a grader. It looks at:
#   - the original user question
#   - the retrieved context
#   - the model answer
# and then assigns two integer scores plus a short comment.
#
# The two scores are aligned with the WFGY ProblemMap philosophy:
#   - retrieval_relevance: how good the retrieved context was
#   - answer_hallucination: how grounded the answer was in that context
#
# This is intentionally coarse-grained, so it can be used as a quick
# "incident tag" for each run, not as a full evaluation framework.
eval_prompt = textwrap.dedent(
    f"""
    You are evaluating a Retrieval-Augmented Generation (RAG) answer.

    [Question]
    {query}

    [Retrieved context]
    {rag_context}

    [Answer]
    {answer}

    Return a JSON object with the following fields:

    - "retrieval_relevance": integer from 0 to 3
      0 = retrieved context is irrelevant or missing
      1 = weakly related
      2 = mostly relevant
      3 = highly relevant and sufficient

    - "answer_hallucination": integer from 0 to 3
      0 = answer is fully grounded in the retrieved context
      1 = minor speculation but still mostly grounded
      2 = noticeable hallucination or missing key facts
      3 = severe hallucination, conflicts with the context or makes things up

    - "comment": one short English sentence explaining what went well
      or what went wrong in this RAG run.

    Return only valid JSON. Do not add any extra text.
    """
).strip()

eval_completion = client.chat.completions.create(
    model="gpt-4o-mini",
    temperature=0.0,
    response_format={"type": "json_object"},
    messages=[
        {
            "role": "system",
            "content": "You are a strict RAG evaluator that only returns valid JSON.",
        },
        {
            "role": "user",
            "content": eval_prompt,
        },
    ],
)

scores = json.loads(eval_completion.choices[0].message.content)


# ---- 5. Pack everything into a small dataframe summary ---------------------
# For convenience we put all fields into a single-row dataframe so that it can
# be printed as a markdown table, logged, or later ingested by Phoenix.
result_df = pd.DataFrame(
    [
        {
            "query": query,
            "retrieved_ids": ",".join(retrieved_ids),
            "answer": answer,
            "retrieval_relevance": scores.get("retrieval_relevance"),
            "answer_hallucination": scores.get("answer_hallucination"),
            "comment": scores.get("comment"),
        }
    ]
)

print("\n===== RAG run with WFGY-style diagnostics =====\n")
print(result_df.to_markdown(index=False))
