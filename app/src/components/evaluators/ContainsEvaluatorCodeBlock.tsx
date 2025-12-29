import React, { useState } from "react";

import { Card, Flex } from "@phoenix/components";
import { CodeLanguageRadioGroup } from "@phoenix/components/code";
import { CodeBlock } from "@phoenix/components/CodeBlock";
import { ProgrammingLanguage } from "@phoenix/types/code";

const PYTHON_CODE = `
def contains(
  text: str,
  words: str,
  case_sensitive: bool = False,
) -> bool:
  words = [word.strip() for word in words.split(",")]
  if case_sensitive:
    return any(word in text for word in words)
  else:
    return any(word.lower() in text.lower() for word in words)
`.trim();

const TYPESCRIPT_CODE = `
function contains(
  text: string,
  words: string,
  caseSensitive: boolean = false,
): boolean {
  words = words.split(",").map((word) => word.trim());
  if (caseSensitive) {
    return words.some((word) => text.includes(word));
  }
  return words.some((word) => text.toLowerCase().includes(word.toLowerCase()));
}
`.trim();

export const ContainsEvaluatorCodeBlock = () => {
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
