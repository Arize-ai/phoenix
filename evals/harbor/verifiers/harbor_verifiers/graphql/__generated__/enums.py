from enum import Enum


class AnthropicOutputConfigEffort(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    XHIGH = "XHIGH"
    MAX = "MAX"


class AnthropicThinkingDisplay(str, Enum):
    SUMMARIZED = "SUMMARIZED"
    OMITTED = "OMITTED"


class EvaluatorKind(str, Enum):
    LLM = "LLM"
    CODE = "CODE"
    BUILTIN = "BUILTIN"


class GenerativeProviderKey(str, Enum):
    OPENAI = "OPENAI"
    ANTHROPIC = "ANTHROPIC"
    AZURE_OPENAI = "AZURE_OPENAI"
    GOOGLE = "GOOGLE"
    DEEPSEEK = "DEEPSEEK"
    XAI = "XAI"
    OLLAMA = "OLLAMA"
    AWS = "AWS"
    CEREBRAS = "CEREBRAS"
    FIREWORKS = "FIREWORKS"
    GROQ = "GROQ"
    MOONSHOT = "MOONSHOT"
    MINIMAX = "MINIMAX"
    PERPLEXITY = "PERPLEXITY"
    TOGETHER = "TOGETHER"
    ZAI = "ZAI"
    META = "META"
    TYPESAFE = "TYPESAFE"


class GoogleThinkingLevel(str, Enum):
    MINIMAL = "MINIMAL"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class Language(str, Enum):
    PYTHON = "PYTHON"
    TYPESCRIPT = "TYPESCRIPT"


class OpenAIReasoningEffort(str, Enum):
    NONE = "NONE"
    MINIMAL = "MINIMAL"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    XHIGH = "XHIGH"


class OptimizationDirection(str, Enum):
    MINIMIZE = "MINIMIZE"
    MAXIMIZE = "MAXIMIZE"
    NONE = "NONE"


class PromptMessageRole(str, Enum):
    USER = "USER"
    SYSTEM = "SYSTEM"
    AI = "AI"
    TOOL = "TOOL"


class PromptTemplateFormat(str, Enum):
    MUSTACHE = "MUSTACHE"
    F_STRING = "F_STRING"
    NONE = "NONE"
