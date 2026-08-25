import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";
import invariant from "tiny-invariant";

import { Card, Empty, View } from "@phoenix/components";
import { CodeEvaluatorSourceCodeBlock } from "@phoenix/components/evaluators/CodeEvaluatorSourceCodeBlock";
import type { CodeProjectEvaluatorDetails_projectEvaluator$key } from "@phoenix/pages/project/evaluators/__generated__/CodeProjectEvaluatorDetails_projectEvaluator.graphql";
import { LanguageWithIcon } from "@phoenix/pages/settings/sandboxes/utils";

/**
 * The source a code project evaluator runs, mirroring the Source Code card on
 * the code dataset evaluator details page.
 */
export function CodeProjectEvaluatorDetails({
  projectEvaluatorRef,
}: {
  projectEvaluatorRef: CodeProjectEvaluatorDetails_projectEvaluator$key;
}) {
  const projectEvaluator = useFragment(
    graphql`
      fragment CodeProjectEvaluatorDetails_projectEvaluator on ProjectEvaluator {
        evaluator {
          kind
          ... on CodeEvaluator {
            language
            currentVersion {
              sourceCode
            }
          }
        }
      }
    `,
    projectEvaluatorRef
  );
  const evaluator = projectEvaluator.evaluator;
  if (evaluator.kind !== "CODE") {
    throw new Error(
      "CodeProjectEvaluatorDetails called for non-code evaluator"
    );
  }
  invariant(evaluator.language, "code evaluator language is required");
  const sourceCode = evaluator.currentVersion?.sourceCode;

  return (
    <Card
      title="Source Code"
      extra={<LanguageWithIcon language={evaluator.language} />}
    >
      {sourceCode ? (
        <CodeEvaluatorSourceCodeBlock
          language={evaluator.language}
          sourceCode={sourceCode}
        />
      ) : (
        // currentVersion can be null (e.g. fixtures, backfills) — render an
        // empty state rather than throwing.
        <View padding="size-200">
          <Empty message="This code evaluator has no current version yet." />
        </View>
      )}
    </Card>
  );
}
