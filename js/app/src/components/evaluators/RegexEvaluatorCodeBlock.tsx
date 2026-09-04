import { Card, Flex } from "@phoenix/components";
import { CodeLanguageRadioGroup } from "@phoenix/components/code";
import { CodeBlock } from "@phoenix/components/CodeBlock";
import { usePreferencesContext } from "@phoenix/contexts";

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
  const { programmingLanguage, setProgrammingLanguage } = usePreferencesContext(
    (state) => ({
      programmingLanguage: state.programmingLanguage,
      setProgrammingLanguage: state.setProgrammingLanguage,
    })
  );
  return (
    <Card
      title="Code"
      extra={
        <Flex gap="size-100" alignItems="center">
          <CodeLanguageRadioGroup
            language={programmingLanguage}
            onChange={setProgrammingLanguage}
            size="S"
          />
        </Flex>
      }
    >
      <CodeBlock
        language={programmingLanguage}
        value={programmingLanguage === "Python" ? PYTHON_CODE : TYPESCRIPT_CODE}
      />
    </Card>
  );
};
