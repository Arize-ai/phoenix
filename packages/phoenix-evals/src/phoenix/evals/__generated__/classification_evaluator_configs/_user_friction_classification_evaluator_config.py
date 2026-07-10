# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import ClassificationEvaluatorConfig, PromptMessage

USER_FRICTION_CLASSIFICATION_EVALUATOR_CONFIG = ClassificationEvaluatorConfig(
    name="user_friction",
    description="Assess whether a user message expresses friction with an assistant's preceding behavior.",
    optimization_direction="minimize",
    messages=[
        PromptMessage(
            role="user",
            content='You are an expert evaluator labeling whether the latest user message expresses friction with an AI assistant\'s preceding behavior.\n\n<rubric>\n\nFRICTION - The latest user message contains one or more of these signals directed at the assistant\'s preceding behavior:\n\n- Correction: redirects or contradicts the assistant, identifies that it misunderstood, or asks it to undo, stop, or revert something it did\n- Retry: repeats or rephrases an earlier request because the assistant failed, errored, returned nothing useful, or did not complete it\n- Frustration: expresses negative affect about the assistant\'s behavior, such as annoyance, impatience, or disappointment\n- Challenge: questions an action the assistant took or announced that was unrequested, unexplained, or inappropriate. Asking why the assistant gave a recommendation or answer is not a challenge by itself\n\nNO_FRICTION - The latest user message does not express friction with the assistant. This includes:\n\n- A direct answer to a question or request for information from the assistant, even if the answer is terse or negative, such as "no", "skip", or "the second one"\n- A follow-up, refinement, or new constraint that builds on the preceding response without indicating it was wrong or unsatisfactory\n- A topic switch or new task\n- Acceptance or rejection of an optional proposal. Commands such as "don\'t do that" are no_friction when they directly answer whether the assistant should do it\n- Gratitude, greetings, acknowledgements, or other ordinary conversation\n- A changed preference that does not imply the assistant made an error\n- Curiosity or verification about a delivered answer, recommendation, or reasoning rather than a challenge to an action the assistant took\n- A first user message with no preceding assistant behavior to react to\n\nJudge only expressed friction. Do not infer dissatisfaction from silence, brevity, negative words alone, or the fact that the user asks for additional work. A genuine friction signal still counts when combined with praise or a new request.\n\nApply the no_friction cases before interpreting terse or negative wording as friction. A direct answer to an assistant question or optional proposal remains no_friction unless the user also explicitly indicates that the assistant misunderstood, failed, or acted improperly.\n\nWhen the evidence supports both labels or remains ambiguous, choose no_friction. Precision on the friction label is more important than recall.\n\n</rubric>\n\n<data>\n\n<conversation_before_user_message>\n{{conversation}}\n</conversation_before_user_message>\n\n<latest_user_message>\n{{user_message}}\n</latest_user_message>\n\n</data>\n\nReason through whether the latest user message reacts negatively to the assistant\'s preceding behavior. Then classify it as friction or no_friction.',
        )
    ],
    choices={"friction": 1.0, "no_friction": 0.0},
    substitutions=None,
    labels=[],
)
