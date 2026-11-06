import { Card, Flex } from "@phoenix/components";
import { CodeLanguageRadioGroup } from "@phoenix/components/code";
import { CodeBlock } from "@phoenix/components/CodeBlock";
import { usePreferencesContext } from "@phoenix/contexts";

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
