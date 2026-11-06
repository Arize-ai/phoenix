import { Text } from "ink";
import React from "react";

import { formatMarkdownForTerminal } from "./markdown";

/**
 * Renders markdown text as styled terminal output inside an Ink `<Text>`.
 *
 * Modeled on the `ink-markdown` component
 * (https://github.com/cameronhunter/ink-markdown, MIT). That package is
 * published as CommonJS and `require()`s Ink internally, which is incompatible
 * with Ink 6 (pure ESM with top-level await — `require()` throws
 * `ERR_REQUIRE_ASYNC_MODULE`). We keep its API — `<Markdown>{text}</Markdown>` —
 * but render through {@link formatMarkdownForTerminal}, which uses the current
 * `marked` + `marked-terminal` API and preserves our width-aware table layout.
 */
export function Markdown({
  children,
  phoenixBaseUrl,
}: {
  children: string;
  phoenixBaseUrl?: string;
}) {
  const rendered = formatMarkdownForTerminal({
    text: children,
    phoenixBaseUrl,
  });
  return <Text>{rendered || " "}</Text>;
}
