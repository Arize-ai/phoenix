import { useMemo } from "react";

type TextType = "string" | "json";
/**
 * A hook that takes in text, detects if it is a JSON string, and formats it
 * @param text
 * @returns formatted text
 */
export function usePrettyText(text: string): {
  text: string;
  textType: TextType;
} {
  return useMemo(() => {
    try {
      const parsed = JSON.parse(text);
      return { text: JSON.stringify(parsed, null, 2), textType: "json" };
    } catch (_e) {
      return { text, textType: "string" };
    }
  }, [text]);
}
