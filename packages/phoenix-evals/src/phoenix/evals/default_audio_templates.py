from phoenix.evals.templates import (
    ClassificationTemplate,
    PromptPartContentType,
    PromptPartTemplate,
)

EMOTION_AUDIO_BASE_TEMPLATE_PT_1 = """
You are an AI system designed to classify emotions in audio files.

### TASK:
Analyze the provided audio file and classify the primary emotion based on these characteristics:
- Tone: General tone of the speaker (e.g., cheerful, tense, calm).
- Pitch: Level and variability of the pitch (e.g., high, low, monotone).
- Pace: Speed of speech (e.g., fast, slow, steady).
- Volume: Loudness of the speech (e.g., loud, soft, moderate).
- Intensity: Emotional strength or expression (e.g., subdued, sharp, exaggerated).

************

Here is the base64 encoded audio string:

"""

EMOTION_AUDIO_BASE_TEMPLATE_PT_2 = """{audio}"""

EMOTION_AUDIO_BASE_TEMPLATE_PT_3 = """
************

POSSIBLE EMOTIONS:
['anger', 'happiness', 'excitement', 'sadness', 'neutral', 'frustration', 'fear', 'surprise',
'disgust', 'other']
IMPORTANT: Choose the most dominant emotion expressed in the audio. Neutral should only be used when
no other emotion is clearly present, do your best to avoid this label.

************

RESPONSE FORMAT:

Provide a single word from the list above representing the detected emotion.

EXAMPLE RESPONSE: excitement

Analyze the audio and respond in this format.

************

"""

EMOTION_AUDIO_BASE_TEMPLATE_EXPLANATION = """

Write out in a step by step manner
an EXPLANATION to show how you determined the emotion of the audio considering the tone, pitch,
pace, volume, and intensity.

EXAMPLE RESPONSE:
1. Tone: The tone was enthusiastic and high-energy.
2. Pitch: The pitch was elevated and varied significantly.
3. Pace: The pace was fast, consistent with excitement.
4. Volume: The volume was loud and dynamic.
5. Intensity: The delivery was expressive and emotionally charged.
6. Conclusion: Based on these features, the primary emotion is 'excitement.'

************

EXPLANATION:
"""

EMOTION_AUDIO_RAILS = [
    "anger",
    "happiness",
    "excitement",
    "sadness",
    "neutral",
    "frustration",
    "fear",
    "surprise",
    "disgust",
    "other",
]

EMOTION_PROMPT_TEMPLATE = ClassificationTemplate(
    rails=EMOTION_AUDIO_RAILS,
    template=[
        PromptPartTemplate(
            content_type=PromptPartContentType.TEXT,
            template=EMOTION_AUDIO_BASE_TEMPLATE_PT_1,
        ),
        PromptPartTemplate(
            content_type=PromptPartContentType.AUDIO,
            template=EMOTION_AUDIO_BASE_TEMPLATE_PT_2,
        ),
        PromptPartTemplate(
            content_type=PromptPartContentType.TEXT,
            template=EMOTION_AUDIO_BASE_TEMPLATE_PT_3,
        ),
    ],
    explanation_template=[
        PromptPartTemplate(
            content_type=PromptPartContentType.TEXT,
            template=EMOTION_AUDIO_BASE_TEMPLATE_PT_1,
        ),
        PromptPartTemplate(
            content_type=PromptPartContentType.AUDIO,
            template=EMOTION_AUDIO_BASE_TEMPLATE_PT_2,
        ),
        PromptPartTemplate(
            content_type=PromptPartContentType.TEXT,
            template=EMOTION_AUDIO_BASE_TEMPLATE_PT_3,
        ),
        PromptPartTemplate(
            content_type=PromptPartContentType.TEXT,
            template=EMOTION_AUDIO_BASE_TEMPLATE_EXPLANATION,
        ),
    ],
)
"""
A template for evaluating the emotion of an audio sample. It return
an emotion and provides a detailed explanation template
to assist users in articulating their judgment on code readability.
"""
