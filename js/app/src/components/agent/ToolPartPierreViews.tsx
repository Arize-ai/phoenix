import { css } from "@emotion/react";
import { parseDiffFromFile } from "@pierre/diffs";
import { File, FileDiff } from "@pierre/diffs/react";

import { useTheme } from "@phoenix/contexts";

/**
 * Pierre-rendered views for tool part bodies: a syntax-highlighted single
 * file ({@link ToolPartFileView}) and a unified before/after diff
 * ({@link ToolPartDiffView}).
 *
 * Pierre's highlighter is heavy, so consumers should reach for the wrappers
 * in `LazyToolPartPierreViews` instead of importing this module directly.
 */

/**
 * Blends pierre's rendered surfaces into the tool part body background and
 * trims its default chrome to sit flush inside `.tool-part__body`.
 */
const PIERRE_TOOL_PART_UNSAFE_CSS = `
  pre, pre code, [data-line-type=context], [data-gutter], svg {
    background: var(--tool-call-body-background-color);
    stroke: unset;
    fill: unset;
  }

  [data-line-type] {
    border-right: none;
  }

  [data-code] {
    padding: 0;
    padding-bottom: var(--global-dimension-size-100)
  }

  [data-column-number] {
    padding-left: 1.5ch;
  }
`;

const toolPartPierreViewCSS = css`
  font-family: var(--global-font-family-sans);
  white-space: normal;
`;

const PIERRE_THEME = { light: "pierre-light", dark: "pierre-dark" } as const;

/**
 * A syntax-highlighted read-only file body (language inferred from
 * `fileName`) for tool part content such as the `execute_ui` script argument.
 */
export function ToolPartFileView({
  fileName,
  contents,
}: {
  fileName: string;
  contents: string;
}) {
  const { theme } = useTheme();
  return (
    <div className="tool-part-pierre-view" css={toolPartPierreViewCSS}>
      <File
        file={{ name: fileName, contents }}
        options={{
          disableFileHeader: true,
          theme: PIERRE_THEME,
          themeType: theme,
          unsafeCSS: PIERRE_TOOL_PART_UNSAFE_CSS,
        }}
      />
    </div>
  );
}

/**
 * A unified before/after diff for tool part content, e.g. the proposed change
 * staged by an approval operation. Both sides share `fileName` so pierre
 * renders an in-place modification with language-aware highlighting.
 */
export function ToolPartDiffView({
  fileName,
  before,
  after,
}: {
  fileName: string;
  before: string;
  after: string;
}) {
  const { theme } = useTheme();
  const fileDiff = parseDiffFromFile(
    { name: fileName, contents: before },
    { name: fileName, contents: after }
  );
  return (
    <div className="tool-part-pierre-view" css={toolPartPierreViewCSS}>
      <FileDiff
        fileDiff={fileDiff}
        data-background="transparent"
        options={{
          diffStyle: "unified",
          disableFileHeader: true,
          theme: PIERRE_THEME,
          themeType: theme,
          unsafeCSS: PIERRE_TOOL_PART_UNSAFE_CSS,
        }}
      />
    </div>
  );
}
