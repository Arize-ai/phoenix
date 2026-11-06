# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import ClassificationEvaluatorConfig, PromptMessage

REFUSAL_CLASSIFICATION_EVALUATOR_CONFIG = ClassificationEvaluatorConfig(
    name="refusal",
    description="Detect when an LLM refuses or declines to answer a query.",
    optimization_direction="neutral",
    messages=[
        PromptMessage(
            role="user",
            content='You are an expert evaluator that detects when an LLM refuses, declines, or avoids answering a user query. Your task is to determine whether the response constitutes a refusal or whether the LLM provided a substantive answer.\n\n<rubric>\n\nREFUSED - The response contains any form of refusal, deflection, or avoidance, including but not limited to:\n\n- Explicit refusals (e.g., "I can\'t help with that", "I\'m unable to answer")\n- Scope disclaimers (e.g., "That\'s outside my area of expertise", "I\'m just a chatbot that handles X")\n- Lack-of-information responses (e.g., "I don\'t have that information", "Nothing in the search results addresses that")\n- Safety or policy refusals (e.g., "I\'m not able to provide that kind of advice")\n- Redirections without answering (e.g., "You should ask a professional about that")\n- Apologetic non-answers (e.g., "I\'m sorry, but I can\'t assist with that request")\n- Partial refusals where the LLM acknowledges the question but ultimately does not provide an answer\n\n\nANSWERED - The response provides a substantive answer to the query, even if:\n\n- The answer is incorrect, incomplete, or low quality\n- The answer includes caveats or disclaimers alongside a genuine attempt to respond\n- The answer is speculative or hedged but still addresses the question\n- The answer acknowledges limitations but still provides relevant information\n\n</rubric>\n\nIMPORTANT: This evaluation is purely about whether a refusal occurred, not whether the refusal was appropriate. A refusal to an out-of-scope question is still a refusal. An incorrect answer to a simple question is still an answer.\n\n<data>\n\n<input>\n{{input}}\n</input>\n\n<output>\n{{output}}\n</output>\n\n</data>\n\nCarefully read the input and output. Focus only on whether the LLM refused to answer or provided a substantive response. Do not evaluate correctness, helpfulness, or quality.\n\nDid the LLM refuse to answer or did it provide an answer?',
        )
    ],
    choices={"refused": 1.0, "answered": 0.0},
    substitutions=None,
    labels=[],
)
