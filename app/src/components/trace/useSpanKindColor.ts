import { useTheme } from "@phoenix/contexts";

/**
 * A function that returns the appropriate color for a span kind
 * as defined by openinference
 */
export function useSpanKindColor({ spanKind }: { spanKind: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  let color = isDark
    ? "--global-color-gray-600"
    : "--global-color-gray-200";
  switch (spanKind) {
    case "llm":
      color = isDark
        ? "--global-color-orange-1000"
        : "--global-color-orange-500";
      break;
    case "prompt":
      color = isDark
        ? "--global-color-orange-1100"
        : "--global-color-orange-400";
      break;
    case "chain":
      color = isDark
        ? "--global-color-blue-1000"
        : "--global-color-blue-500";
      break;
    case "retriever":
      color = isDark
        ? "--global-color-seafoam-1000"
        : "--global-color-seafoam-500";
      break;
    case "embedding":
      color = isDark
        ? "--global-color-indigo-1000"
        : "--global-color-indigo-500";
      break;
    case "agent":
      color = isDark
        ? "--global-color-gray-600"
        : "--global-color-gray-300";
      break;
    case "tool":
      color = isDark
        ? "--global-color-yellow-1200"
        : "--global-color-yellow-500";
      break;
    case "reranker":
      color = isDark
        ? "--global-color-celery-1000"
        : "--global-color-celery-500";
      break;
    case "evaluator":
      color = isDark
        ? "--global-color-indigo-1000"
        : "--global-color-indigo-500";
      break;
    case "guardrail":
      color = isDark
        ? "--global-color-fuchsia-1200"
        : "--global-color-fuchsia-500";
      break;
  }
  return `var(${color})`;
}
