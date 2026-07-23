"""AI SDK data stream protocol message types."""

from pydantic import TypeAdapter

from ._ui_messages import (
    UICustomPart,
    UIDataPart,
    UIDynamicToolPart,
    UIFilePart,
    UIMessage,
    UIMessagePart,
    UIReasoningFilePart,
    UIReasoningPart,
    UISourceDocumentPart,
    UISourceUrlPart,
    UIStepStartPart,
    UITextPart,
    UIToolApproval,
    UIToolInvocationPart,
    UIToolInvocationState,
    UIToolPart,
)
from .phoenix_types import (
    AssistantMessageMetadata,
    AssistantMessageMetadataTraceIds,
    AssistantMessageMetadataUsage,
    AssistantMessageMetadataUsageTokenDetails,
    AssistantMessageMetadataUsageTokens,
    MessageMetadata,
    PhoenixUIMessage,
    TurnTraceContext,
    UserMessageMetadata,
)
from .provider_metadata import (
    ProviderMetadata,
    ToolCallCallbackProviderMetadata,
    ToolCallProviderMetadata,
    ToolExecutionEnvironment,
)

PhoenixUIMessageAdapter = TypeAdapter(PhoenixUIMessage)

__all__ = [
    "AssistantMessageMetadata",
    "AssistantMessageMetadataTraceIds",
    "AssistantMessageMetadataUsage",
    "AssistantMessageMetadataUsageTokenDetails",
    "AssistantMessageMetadataUsageTokens",
    "MessageMetadata",
    "PhoenixUIMessage",
    "PhoenixUIMessageAdapter",
    "ProviderMetadata",
    "ToolCallCallbackProviderMetadata",
    "ToolCallProviderMetadata",
    "ToolExecutionEnvironment",
    "TurnTraceContext",
    "UICustomPart",
    "UIDataPart",
    "UIDynamicToolPart",
    "UIFilePart",
    "UIMessage",
    "UIMessagePart",
    "UIReasoningFilePart",
    "UIReasoningPart",
    "UISourceDocumentPart",
    "UISourceUrlPart",
    "UIStepStartPart",
    "UITextPart",
    "UIToolApproval",
    "UIToolInvocationPart",
    "UIToolInvocationState",
    "UIToolPart",
    "UserMessageMetadata",
]
