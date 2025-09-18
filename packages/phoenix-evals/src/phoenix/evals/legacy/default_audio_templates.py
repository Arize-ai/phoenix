from phoenix.evals.legacy.templates import (
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

The classified emotion must be one of the following:
['anger', 'happiness', 'excitement', 'sadness', 'neutral', 'frustration', 'fear', 'surprise',
'disgust', 'other']

IMPORTANT: Choose the most dominant emotion expressed in the audio. Neutral should only be used when
no other emotion is clearly present, do your best to avoid this label.

************

Here is the audio to classify:

"""

EMOTION_AUDIO_BASE_TEMPLATE_PT_2 = """{audio}"""

EMOTION_AUDIO_BASE_TEMPLATE_PT_3 = """
RESPONSE FORMAT:

Provide a single word from the list above representing the detected emotion.

************

EXAMPLE RESPONSE: excitement

************

Analyze the audio and respond in this format.
"""

EMOTION_AUDIO_EXPLANATION_TEMPLATE_PT_1 = """
You are an AI system designed to classify emotions in audio files.

### TASK:
First, explain in a step-by-step manner how the provided audio file based on these characteristics
and how they indicate the emotion of the speaker:
- Tone: General tone of the speaker (e.g., cheerful, tense, calm).
- Pitch: Level and variability of the pitch (e.g., high, low, monotone).
- Pace: Speed of speech (e.g., fast, slow, steady).
- Volume: Loudness of the speech (e.g., loud, soft, moderate).
- Intensity: Emotional strength or expression (e.g., subdued, sharp, exaggerated).

Then, classify the primary emotion. The classified emotion must be one of the following:
['anger', 'happiness', 'excitement', 'sadness', 'neutral', 'frustration', 'fear', 'surprise',
'disgust', 'other']

IMPORTANT: Choose the most dominant emotion expressed in the audio. Neutral should only be used when
no other emotion is clearly present, do your best to avoid this label.

************

Here is the audio to classify:
"""

EMOTION_AUDIO_EXPLANATION_TEMPLATE_PT_3 = """
EXAMPLE RESPONSE FORMAT:

************

EXPLANATION: An explanation of your reasoning based on the tone, pitch, pace, volume, and intensity
    of the audio.
LABEL: "excitement"

************

Analyze the audio and respond in the format shown above.
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
            template=EMOTION_AUDIO_EXPLANATION_TEMPLATE_PT_1,
        ),
        PromptPartTemplate(
            content_type=PromptPartContentType.AUDIO,
            template=EMOTION_AUDIO_BASE_TEMPLATE_PT_2,
        ),
        PromptPartTemplate(
            content_type=PromptPartContentType.TEXT,
            template=EMOTION_AUDIO_EXPLANATION_TEMPLATE_PT_3,
        ),
    ],
)
"""
A template for evaluating the emotion of an audio sample. It return
an emotion and provides a detailed explanation template
to assist users in articulating their judgment on code readability.
"""
