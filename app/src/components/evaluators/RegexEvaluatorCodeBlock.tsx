import React, { useState } from "react";

import { Card, Flex } from "@phoenix/components";
import { CodeLanguageRadioGroup } from "@phoenix/components/code";
import { CodeBlock } from "@phoenix/components/CodeBlock";
import { ProgrammingLanguage } from "@phoenix/types/code";

const PYTHON_CODE = `
import re

def regex_match(
  pattern: str,
  text: str,
  full_match: bool = False,
) -> bool:
  if full_match:
    return re.fullmatch(pattern, text) is not None
  else:
    return re.search(pattern, text) is not None
`.trim();

const TYPESCRIPT_CODE = `
function regexMatch(
  pattern: string,
  text: string,
  fullMatch: boolean = false,
): boolean {
  const regex = new RegExp(fullMatch ? \`^\${pattern}$\` : pattern);
  return regex.test(text);
}
`.trim();

export const RegexEvaluatorCodeBlock = () => {
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
