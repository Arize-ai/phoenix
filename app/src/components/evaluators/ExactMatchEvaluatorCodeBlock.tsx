import React, { useState } from "react";

import { Card, Flex } from "@phoenix/components";
import { CodeLanguageRadioGroup } from "@phoenix/components/code";
import { CodeBlock } from "@phoenix/components/CodeBlock";
import { ProgrammingLanguage } from "@phoenix/types/code";

const PYTHON_CODE = `
def exact_match(
  expected: str,
  actual: str,
  case_sensitive: bool = True,
) -> bool:
  if case_sensitive:
    return expected == actual
  else:
    return expected.lower() == actual.lower()
`.trim();

const TYPESCRIPT_CODE = `
function exactMatch(
  expected: string,
  actual: string,
  caseSensitive: boolean = true,
): boolean {
  if (caseSensitive) {
    return expected === actual;
  }
  return expected.toLowerCase() === actual.toLowerCase();
}
`.trim();

export const ExactMatchEvaluatorCodeBlock = () => {
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
