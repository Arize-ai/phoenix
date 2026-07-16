export const EMPTY_SESSION_DISPLAY_NAME = "New chat";

export function getSessionDisplayName({ title }: { title: string }): string {
  return title || EMPTY_SESSION_DISPLAY_NAME;
}
