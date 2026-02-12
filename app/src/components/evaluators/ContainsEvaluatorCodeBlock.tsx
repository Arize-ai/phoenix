import { Card, Flex } from "@phoenix/components";
import { CodeLanguageRadioGroup } from "@phoenix/components/code";
import { CodeBlock } from "@phoenix/components/CodeBlock";
import { usePreferencesContext } from "@phoenix/contexts";

const PYTHON_CODE = `
def contains(
  text: str,
  words: str,
  case_sensitive: bool = False,
  require_all: bool = False,
) -> bool:
  words = [word.strip() for word in words.split(",") if word.strip()]
  match_fn = all if require_all else any
  if case_sensitive:
    return match_fn(word in text for word in words)
  else:
    return match_fn(word.lower() in text.lower() for word in words)
`.trim();

const TYPESCRIPT_CODE = `
function contains(
  text: string,
  words: string,
  caseSensitive: boolean = false,
  requireAll: boolean = false,
): boolean {
  const wordList = words.split(",").map((w) => w.trim()).filter(Boolean);
  const matchFn = requireAll ? wordList.every.bind(wordList) : wordList.some.bind(wordList);
  if (caseSensitive) {
    return matchFn((word) => text.includes(word));
  }
  return matchFn((word) => text.toLowerCase().includes(word.toLowerCase()));
}
`.trim();

export const ContainsEvaluatorCodeBlock = () => {
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
