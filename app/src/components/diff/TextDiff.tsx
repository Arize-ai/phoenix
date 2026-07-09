import { parseDiffFromFile } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { useMemo } from "react";

import { Text, View } from "@phoenix/components";
import { useTheme } from "@phoenix/contexts";

export type TextDiffStyle = "unified" | "split";

export type TextDiffProps = {
  /**
   * The baseline (old) text to diff against
   */
  oldText: string;
  /**
   * The changed (new) text
   */
  newText: string;
  /**
   * A pseudo file name used to determine syntax highlighting (e.g. "prompt.txt", "config.json")
   * @default "text.txt"
   */
  fileName?: string;
  /**
   * Whether to render a unified or side-by-side (split) diff
   * @default "unified"
   */
  diffStyle?: TextDiffStyle;
};

/**
 * A git-like text diff view with added / deleted lines. Renders a unified or
 * side-by-side (split) diff of the two texts.
 */
export function TextDiff({
  oldText,
  newText,
  fileName = "text.txt",
  diffStyle = "unified",
}: TextDiffProps) {
  const { theme } = useTheme();

  const fileDiff = useMemo(() => {
    return parseDiffFromFile(
      { name: fileName, contents: oldText },
      { name: fileName, contents: newText }
    );
  }, [oldText, newText, fileName]);

  if (oldText === newText) {
    return (
      <View padding="size-200">
        <Text color="text-700" size="S">
          No changes
        </Text>
      </View>
    );
  }

  return (
    <FileDiff
      fileDiff={fileDiff}
      options={{
        diffStyle,
        disableFileHeader: true,
        theme: { light: "pierre-light", dark: "pierre-dark" },
        themeType: theme,
      }}
    />
  );
}
