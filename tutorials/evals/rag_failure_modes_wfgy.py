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
"""

# If you are running this inside a notebook (e.g. Colab) and want a
# single cell to install dependencies, you can uncomment the line below:
# !pip install -q "openai>=1.58.1" "pandas>=2.0.0"

import os
import json
import getpass
import textwrap

from openai import OpenAI
import pandas as pd


# ---- 1. Ask for API key at runtime ----
api_key = getpass.getpass("Enter your OpenAI API key: ")
os.environ["OPENAI_API_KEY"] = api_key

client = OpenAI()


# ---- 2. Tiny fake knowledge base for a RAG demo ----
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
    Extremely naive retriever.

    For demonstration purposes only. It ignores the query and always
    returns faq_1 and faq_2 so that the failure mode is controlled by
    the answer logic and the evaluator rubric, not by the retriever.
    """
    retrieved_ids = ["faq_1", "faq_2"]
    contexts = [KB[_id] for _id in retrieved_ids]
    return retrieved_ids, contexts


# ---- 3. Run a toy RAG pipeline ----
query = "Can I pay my subscription with Bitcoin?"

retrieved_ids, contexts = simple_retriever(query)
rag_context = "\n\n".join(contexts)

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


# ---- 4. Ask the LLM to score this RAG run (WFGY-style) ----
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
      or wrong.

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


# ---- 5. Pack everything into a small dataframe summary ----
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
