import type { ViewStyleProps } from "@phoenix/components/core/types";

type ChatMessageStyles = Pick<
  ViewStyleProps,
  "backgroundColor" | "borderColor"
>;

const CHAT_MESSAGE_STYLES: ChatMessageStyles = {
  backgroundColor: "default",
  borderColor: "default",
};

export function useChatMessageStyles(_role: string): ChatMessageStyles {
  return CHAT_MESSAGE_STYLES;
}
