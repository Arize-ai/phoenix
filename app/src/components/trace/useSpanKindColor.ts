import { useTheme } from "@phoenix/contexts";

/**
 * A function that returns the appropriate color for a span kind
 * as defined by openinference
 */
export function useSpanKindColor({ spanKind }: { spanKind: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  let color = isDark
    ? "--ac-global-color-grey-600"
    : "--ac-global-color-grey-200";
  switch (spanKind) {
    case "llm":
      color = isDark
        ? "--ac-global-color-orange-1000"
        : "--ac-global-color-orange-500";
      break;
    case "prompt":
      color = isDark
        ? "--ac-global-color-orange-1100"
        : "--ac-global-color-orange-400";
      break;
    case "chain":
      color = isDark
        ? "--ac-global-color-blue-1000"
        : "--ac-global-color-blue-500";
      break;
    case "retriever":
      color = isDark
        ? "--ac-global-color-seafoam-1000"
        : "--ac-global-color-seafoam-500";
      break;
    case "embedding":
      color = isDark
        ? "--ac-global-color-indigo-1000"
        : "--ac-global-color-indigo-500";
      break;
    case "agent":
      color = isDark
        ? "--ac-global-color-grey-600"
        : "--ac-global-color-grey-300";
      break;
    case "tool":
      color = isDark
        ? "--ac-global-color-yellow-1200"
        : "--ac-global-color-yellow-500";
      break;
    case "reranker":
      color = isDark
        ? "--ac-global-color-celery-1000"
        : "--ac-global-color-celery-500";
      break;
    case "evaluator":
      color = isDark
        ? "--ac-global-color-indigo-1000"
        : "--ac-global-color-indigo-500";
      break;
    case "guardrail":
      color = isDark
        ? "--ac-global-color-fuchsia-1200"
        : "--ac-global-color-fuchsia-500";
      break;
  }
  return `var(${color})`;
}
