import type { componentsV1 } from "@arizeai/phoenix-client";

export type OutputFormat = "pretty" | "json" | "raw";

type DecisionVersion = componentsV1["schemas"]["DecisionVersion"];
type DecisionQuestion = DecisionVersion["questions"][number];

export interface FormatDecisionOutputOptions {
  /**
   * Decision version to format.
   */
  decisionVersion: DecisionVersion;
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

export function formatDecisionOutput({
  decisionVersion,
  format,
}: FormatDecisionOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(decisionVersion);
  }
  if (selected === "json") {
    return JSON.stringify(decisionVersion, null, 2);
  }
  return formatDecisionPretty(decisionVersion);
}

function formatDecisionPretty(decisionVersion: DecisionVersion): string {
  const lines = [
    `┌─ Decision: ${decisionVersion.decision_name} (version ${decisionVersion.version_number})`,
    `│`,
    `│  Version ID: ${decisionVersion.id}`,
    `│  Model: ${decisionVersion.model_provider} / ${decisionVersion.model_name}`,
    `│  Template Format: ${decisionVersion.template_format}`,
  ];
  if (decisionVersion.tag_names.length > 0) {
    lines.push(`│  Tags: ${decisionVersion.tag_names.join(", ")}`);
  }
  if (decisionVersion.description) {
    lines.push(`│  Description: ${decisionVersion.description}`);
  }
  lines.push(
    `│  Variables: ${decisionVersion.variables.length > 0 ? decisionVersion.variables.join(", ") : "(none)"}`
  );
  lines.push(`│`, ...formatState(decisionVersion.state));
  lines.push(`│`, `│  Questions:`);
  for (const question of decisionVersion.questions) {
    lines.push(...formatQuestion(question));
  }
  lines.push(`└─`);
  return lines.join("\n");
}

function formatState(state: DecisionVersion["state"]): string[] {
  const text =
    state.type === "text"
      ? state.template
      : JSON.stringify(state.template, null, 2);
  return [
    `│  State (${state.type}):`,
    ...text.split("\n").map((line) => `│    ${line}`),
  ];
}

function formatQuestion(question: DecisionQuestion): string[] {
  const lines = [
    `│    ${question.name} (${question.type})`,
    ...question.instructions.split("\n").map((line) => `│      ${line}`),
  ];
  switch (question.type) {
    case "predicate":
      if (question.criteria?.true) {
        lines.push(`│      true: ${question.criteria.true}`);
      }
      if (question.criteria?.false) {
        lines.push(`│      false: ${question.criteria.false}`);
      }
      break;
    case "choice":
      for (const choice of question.choices) {
        lines.push(
          `│      - ${choice.value}${choice.description ? `: ${choice.description}` : ""}`
        );
      }
      break;
    case "scale":
      question.levels.forEach((level, index) => {
        lines.push(
          `│      ${index}. ${level.label}${level.description ? `: ${level.description}` : ""}`
        );
      });
      break;
    default:
      // A question type newer than this CLI: show what it is rather than drop it.
      lines.push(
        `│      (question type '${(question as { type: string }).type}' is not supported by this version of px; upgrade @arizeai/phoenix-cli)`
      );
  }
  return lines;
}
