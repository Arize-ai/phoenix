from enum import Enum


class ModelProvider(Enum):
    OPENAI = "OPENAI"
    AZURE_OPENAI = "AZURE_OPENAI"
    ANTHROPIC = "ANTHROPIC"
    GOOGLE = "GOOGLE"
    DEEPSEEK = "DEEPSEEK"
    XAI = "XAI"
    OLLAMA = "OLLAMA"
    AWS = "AWS"
