# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import ClassificationEvaluatorConfig, PromptMessage

SENTIMENT_CLASSIFICATION_EVALUATOR_CONFIG = ClassificationEvaluatorConfig(
    name="sentiment",
    description="Classify the sentiment a user expresses in a message as positive, negative, or neutral.",
    optimization_direction="neutral",
    messages=[
        PromptMessage(
            role="user",
            content='You are an expert evaluator labeling the sentiment the user expresses in their latest message.\n\nSentiment is how the user feels, as revealed by what they say. Judge the user\'s own expressed affect, not the assistant\'s tone and not whether the topic is inherently pleasant or unpleasant. Use the conversation only to resolve what the latest user message refers to.\n\n<rubric>\n\nPOSITIVE - The latest user message expresses a clearly good feeling the user holds, such as:\n\n- Satisfaction, happiness, relief, or enthusiasm about an outcome, answer, product, service, or their own situation\n- Praise or appreciation that goes beyond a routine courtesy, such as "this is exactly what I needed" or "I\'m thrilled this finally works"\n\nNEGATIVE - The latest user message expresses a clearly bad feeling the user holds, such as:\n\n- Frustration, annoyance, disappointment, anger, sadness, or anxiety\n- Dissatisfaction or complaint about an outcome, product, service, or their own situation, such as "my order still hasn\'t arrived" or "this is a mess"\n\nNEUTRAL - The latest user message carries no clear affect. This includes:\n\n- A plain question, request, instruction, or statement of fact, even about an unpleasant topic. A calm question about a refund or a cancellation is neutral\n- A terse answer such as "no", "the second one", or "skip"\n- Ordinary courtesy on its own, such as "thanks", "hello", or "please" with no further feeling expressed\n- A message whose sentiment cannot be determined from the text\n\n</rubric>\n\nJudge only sentiment the user actually expresses. Do not infer a feeling from the topic alone, from the assistant\'s behavior, or from how you imagine the user might feel. A negative topic stated without affect is neutral. A routine "thank you" is neutral, not positive. Sentiment is not friction: a user can be negative about their situation while raising no objection to the assistant, and can push back on the assistant while expressing no particular feeling.\n\nWhen the message mixes feelings, label the sentiment that dominates it. When the evidence is weak or ambiguous, choose neutral.\n\n<data>\n\n<conversation_before_user_message>\n{{conversation}}\n</conversation_before_user_message>\n\n<latest_user_message>\n{{user_message}}\n</latest_user_message>\n\n</data>\n\nReason through what feeling, if any, the user expresses in the latest message. Then classify it as positive, negative, or neutral.',
        )
    ],
    choices={"positive": 1.0, "neutral": 0.0, "negative": -1.0},
    substitutions=None,
    labels=[],
)
