from enum import Enum


class AnnotationSource(str, Enum):
    API = "API"
    APP = "APP"


class AnnotationTimeRangeField(str, Enum):
    ANNOTATION_CREATED_AT = "ANNOTATION_CREATED_AT"
    SOURCE_START_TIME = "SOURCE_START_TIME"


class AnnotatorKind(str, Enum):
    LLM = "LLM"
    HUMAN = "HUMAN"
    CODE = "CODE"


class AnthropicOutputConfigEffort(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    XHIGH = "XHIGH"
    MAX = "MAX"


class AnthropicThinkingDisplay(str, Enum):
    SUMMARIZED = "SUMMARIZED"
    OMITTED = "OMITTED"


class AuthMethod(str, Enum):
    LOCAL = "LOCAL"
    OAUTH2 = "OAUTH2"
    LDAP = "LDAP"


class DatasetColumn(str, Enum):
    createdAt = "createdAt"
    name = "name"


class DatasetEvaluatorColumn(str, Enum):
    name = "name"
    kind = "kind"
    createdAt = "createdAt"
    updatedAt = "updatedAt"


class DatasetEvaluatorFilterColumn(str, Enum):
    name = "name"


class DatasetExampleField(str, Enum):
    INPUT = "INPUT"
    OUTPUT = "OUTPUT"
    METADATA = "METADATA"


class DatasetFilterColumn(str, Enum):
    name = "name"


class DatasetVersionColumn(str, Enum):
    createdAt = "createdAt"


class DecisionFilterColumn(str, Enum):
    name = "name"


class DecisionTemplateFormat(str, Enum):
    MUSTACHE = "MUSTACHE"
    F_STRING = "F_STRING"


class EvalAttr(str, Enum):
    score = "score"
    label = "label"


class EvaluationTarget(str, Enum):
    SPAN = "SPAN"
    TRACE = "TRACE"
    SESSION = "SESSION"


class EvaluatorColumn(str, Enum):
    name = "name"
    kind = "kind"
    createdAt = "createdAt"
    updatedAt = "updatedAt"


class EvaluatorFilterColumn(str, Enum):
    name = "name"


class EvaluatorKind(str, Enum):
    LLM = "LLM"
    CODE = "CODE"
    BUILTIN = "BUILTIN"
    DECISION = "DECISION"


class ExperimentColumn(str, Enum):
    sequenceNumber = "sequenceNumber"
    createdAt = "createdAt"


class ExperimentRunMetric(str, Enum):
    latencyMs = "latencyMs"


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


class InternetAccessChoice(str, Enum):
    ALLOW = "ALLOW"
    DENY = "DENY"


class Language(str, Enum):
    PYTHON = "PYTHON"
    TYPESCRIPT = "TYPESCRIPT"


class ModelProvider(str, Enum):
    OPENAI = "OPENAI"
    AZURE_OPENAI = "AZURE_OPENAI"
    ANTHROPIC = "ANTHROPIC"
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


class ModelType(str, Enum):
    LLM = "LLM"
    DECISION = "DECISION"


class OpenAIApiType(str, Enum):
    CHAT_COMPLETIONS = "CHAT_COMPLETIONS"
    RESPONSES = "RESPONSES"


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


class ProjectColumn(str, Enum):
    name = "name"
    endTime = "endTime"


class ProjectEvaluatorFilterColumn(str, Enum):
    name = "name"


class ProjectFilterColumn(str, Enum):
    name = "name"


class ProjectSessionAnnoAttr(str, Enum):
    score = "score"
    label = "label"


class ProjectSessionColumn(str, Enum):
    startTime = "startTime"
    endTime = "endTime"
    tokenCountTotal = "tokenCountTotal"
    numTraces = "numTraces"
    costTotal = "costTotal"


class PromptFilterColumn(str, Enum):
    name = "name"


class PromptMessageRole(str, Enum):
    USER = "USER"
    SYSTEM = "SYSTEM"
    AI = "AI"
    TOOL = "TOOL"


class PromptTemplateFormat(str, Enum):
    MUSTACHE = "MUSTACHE"
    F_STRING = "F_STRING"
    NONE = "NONE"


class SortDir(str, Enum):
    asc = "asc"
    desc = "desc"


class SpanAnnotationColumn(str, Enum):
    createdAt = "createdAt"
    name = "name"


class SpanColumn(str, Enum):
    startTime = "startTime"
    endTime = "endTime"
    latencyMs = "latencyMs"
    tokenCountTotal = "tokenCountTotal"
    tokenCountPrompt = "tokenCountPrompt"
    tokenCountCompletion = "tokenCountCompletion"
    cumulativeTokenCountTotal = "cumulativeTokenCountTotal"
    cumulativeTokenCountPrompt = "cumulativeTokenCountPrompt"
    cumulativeTokenCountCompletion = "cumulativeTokenCountCompletion"
    cumulativeTokenCostTotal = "cumulativeTokenCostTotal"
    tokenCostTotal = "tokenCostTotal"


class TimeBinScale(str, Enum):
    MINUTE = "MINUTE"
    HOUR = "HOUR"
    DAY = "DAY"
    WEEK = "WEEK"
    MONTH = "MONTH"
    YEAR = "YEAR"


class TokenKind(str, Enum):
    PROMPT = "PROMPT"
    COMPLETION = "COMPLETION"


class TraceAnnotationColumn(str, Enum):
    createdAt = "createdAt"
    name = "name"


class UserRoleInput(str, Enum):
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"
    VIEWER = "VIEWER"
