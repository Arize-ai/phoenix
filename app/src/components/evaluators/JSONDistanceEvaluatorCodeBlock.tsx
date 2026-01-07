import React, { useState } from "react";

import { Card, Flex } from "@phoenix/components";
import { CodeLanguageRadioGroup } from "@phoenix/components/code";
import { CodeBlock } from "@phoenix/components/CodeBlock";
import { ProgrammingLanguage } from "@phoenix/types/code";

const PYTHON_CODE = `
import json
from typing import Any

def json_diff_count(expected: Any, actual: Any) -> int:
  if type(expected) is not type(actual):
    return 1
  if isinstance(expected, dict) and isinstance(actual, dict):
    diff = 0
    all_keys = set(expected.keys()) | set(actual.keys())
    for key in all_keys:
      if key not in expected or key not in actual:
        diff += 1
      else:
        diff += json_diff_count(expected[key], actual[key])
    return diff
  if isinstance(expected, list) and isinstance(actual, list):
    diff = abs(len(expected) - len(actual))
    for i in range(min(len(expected), len(actual))):
      diff += json_diff_count(expected[i], actual[i])
    return diff
  return 0 if expected == actual else 1

def json_distance(expected: str, actual: str) -> int:
  return json_diff_count(json.loads(expected), json.loads(actual))
`.trim();

const TYPESCRIPT_CODE = `
function jsonDiffCount(expected: unknown, actual: unknown): number {
  if (typeof expected !== typeof actual) {
    return 1;
  }
  if (
    typeof expected === "object" &&
    expected !== null &&
    typeof actual === "object" &&
    actual !== null
  ) {
    if (Array.isArray(expected) && Array.isArray(actual)) {
      let diff = Math.abs(expected.length - actual.length);
      for (let i = 0; i < Math.min(expected.length, actual.length); i++) {
        diff += jsonDiffCount(expected[i], actual[i]);
      }
      return diff;
    }
    if (!Array.isArray(expected) && !Array.isArray(actual)) {
      const exp = expected as Record<string, unknown>;
      const act = actual as Record<string, unknown>;
      const allKeys = new Set([...Object.keys(exp), ...Object.keys(act)]);
      let diff = 0;
      for (const key of allKeys) {
        if (!(key in exp) || !(key in act)) {
          diff += 1;
        } else {
          diff += jsonDiffCount(exp[key], act[key]);
        }
      }
      return diff;
    }
    return 1;
  }
  return expected === actual ? 0 : 1;
}

function jsonDistance(expected: string, actual: string): number {
  return jsonDiffCount(JSON.parse(expected), JSON.parse(actual));
}
`.trim();

export const JSONDistanceEvaluatorCodeBlock = () => {
  const [language, setLanguage] = useState<ProgrammingLanguage>("Python");
  return (
    <Card
      title="Code"
      extra={
        <Flex gap="size-100" alignItems="center">
          <CodeLanguageRadioGroup
            language={language}
            onChange={setLanguage}
            size="S"
          />
        </Flex>
      }
    >
      <CodeBlock
        language={language}
        value={language === "Python" ? PYTHON_CODE : TYPESCRIPT_CODE}
      />
    </Card>
  );
};
