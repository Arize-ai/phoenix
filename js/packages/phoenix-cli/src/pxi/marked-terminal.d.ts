// Minimal local declaration for `marked-terminal`.
//
// The published `@types/marked-terminal` (v6) is pinned to an older API and
// types `markedTerminal` as returning a `Renderer`, which is incompatible with
// `marked`'s `use(extension: MarkedExtension)` signature. We only consume the
// `markedTerminal` extension factory, so we declare just that surface here.
declare module "marked-terminal" {
  import type { MarkedExtension } from "marked";

  export type TerminalRendererOptions = {
    width?: number;
    reflowText?: boolean;
    tab?: number;
    showSectionPrefix?: boolean;
    unescape?: boolean;
    emoji?: boolean;
    [styleName: string]: unknown;
  };

  export function markedTerminal(
    options?: TerminalRendererOptions,
    highlightOptions?: Record<string, unknown>
  ): MarkedExtension;
}
