/**
 * Offline stand-in for jev used by tests and by `OXLINT_JEV_MODE=mock`.
 * Answers come from a JSON file keyed by file basename then question key;
 * anything unlisted gets a neutral answer that never produces a finding.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import type { Answer, SystemOneRequest, SystemOneResponse } from "./types.js";

type MockFile = Record<string, Record<string, Answer>>;

let loaded: MockFile | undefined;
function mockFile(): MockFile {
  if (loaded) return loaded;
  const file = process.env.OXLINT_JEV_MOCK_FILE;
  loaded = file ? (JSON.parse(readFileSync(file, "utf8")) as MockFile) : {};
  return loaded;
}

export function mockAnswers(
  request: SystemOneRequest,
  filename: string
): SystemOneResponse {
  const perFile = mockFile()[path.basename(filename)] ?? {};
  const answers: Record<string, Answer> = {};
  for (const [key, question] of Object.entries(request.questions)) {
    const given = perFile[key];
    if (given) {
      answers[key] = given;
      continue;
    }
    if (question.type === "noul") answers[key] = { type: "noul", noul: 0.5 };
    else if (question.type === "choice") {
      const options = Object.keys(question.criteria);
      const first = options[0] ?? "";
      answers[key] = {
        type: "choice",
        choice: first,
        confidence: 0,
        probabilities: Object.fromEntries(
          options.map((o) => [o, 1 / options.length])
        ),
      };
    } else
      answers[key] = {
        type: "score",
        score: 0,
        confidence: 0,
        probabilities: {},
      };
  }
  return {
    model: "mock",
    answers,
    usage: { input_tokens: 0, output_tokens: 0 },
  };
}
