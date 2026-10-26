import { parseDiffFromFile } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { useMemo } from "react";
import { useFragment } from "react-relay";

import { useTheme } from "@phoenix/contexts";

import type { DecisionDefinitionCard_version$key } from "./__generated__/DecisionDefinitionCard_version.graphql";
import {
  decisionDefinitionCardFragment,
  decisionDefinitionToText,
} from "./DecisionDefinitionCard";

/**
 * A unified diff of two decision versions' definitions
 */
export function DecisionVersionDiffView({
  current,
  previous,
}: {
  current: DecisionDefinitionCard_version$key;
  previous: DecisionDefinitionCard_version$key;
}) {
  const { theme } = useTheme();
  const currentDefinition = useFragment<DecisionDefinitionCard_version$key>(
    decisionDefinitionCardFragment,
    current
  );
  const previousDefinition = useFragment<DecisionDefinitionCard_version$key>(
    decisionDefinitionCardFragment,
    previous
  );
  const fileDiff = useMemo(
    () =>
      parseDiffFromFile(
        {
          name: "decision.json",
          contents: decisionDefinitionToText(previousDefinition),
        },
        {
          name: "decision.json",
          contents: decisionDefinitionToText(currentDefinition),
        }
      ),
    [currentDefinition, previousDefinition]
  );
  return (
    <FileDiff
      fileDiff={fileDiff}
      options={{
        diffStyle: "unified",
        disableFileHeader: true,
        theme: { light: "pierre-light", dark: "pierre-dark" },
        themeType: theme,
      }}
    />
  );
}
