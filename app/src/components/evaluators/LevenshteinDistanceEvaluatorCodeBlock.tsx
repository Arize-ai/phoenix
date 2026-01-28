import { Card, Flex } from "@phoenix/components";
import { CodeLanguageRadioGroup } from "@phoenix/components/code";
import { CodeBlock } from "@phoenix/components/CodeBlock";
import { usePreferencesContext } from "@phoenix/contexts";

const PYTHON_CODE = `
def levenshtein_distance(
  expected: str,
  actual: str,
  case_sensitive: bool = True,
) -> int:
  s1 = expected if case_sensitive else expected.lower()
  s2 = actual if case_sensitive else actual.lower()
  if len(s1) < len(s2):
    s1, s2 = s2, s1
  if len(s2) == 0:
    return len(s1)
  previous_row = list(range(len(s2) + 1))
  for i, c1 in enumerate(s1):
    current_row = [i + 1]
    for j, c2 in enumerate(s2):
      insertions = previous_row[j + 1] + 1
      deletions = current_row[j] + 1
      substitutions = previous_row[j] + (c1 != c2)
      current_row.append(min(insertions, deletions, substitutions))
    previous_row = current_row
  return previous_row[-1]
`.trim();

const TYPESCRIPT_CODE = `
function levenshteinDistance(
  expected: string,
  actual: string,
  caseSensitive: boolean = true,
): number {
  let s1 = caseSensitive ? expected : expected.toLowerCase();
  let s2 = caseSensitive ? actual : actual.toLowerCase();
  if (s1.length < s2.length) {
    [s1, s2] = [s2, s1];
  }
  if (s2.length === 0) {
    return s1.length;
  }
  let previousRow = Array.from({ length: s2.length + 1 }, (_, i) => i);
  for (let i = 0; i < s1.length; i++) {
    const currentRow = [i + 1];
    for (let j = 0; j < s2.length; j++) {
      const insertions = previousRow[j + 1] + 1;
      const deletions = currentRow[j] + 1;
      const substitutions = previousRow[j] + (s1[i] !== s2[j] ? 1 : 0);
      currentRow.push(Math.min(insertions, deletions, substitutions));
    }
    previousRow = currentRow;
  }
  return previousRow[previousRow.length - 1];
}
`.trim();

export const LevenshteinDistanceEvaluatorCodeBlock = () => {
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
