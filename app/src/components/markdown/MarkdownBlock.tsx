import { css } from "@emotion/react";
import { code } from "@streamdown/code";
import type { SVGProps } from "react";
import { type IconMap, type PluginConfig, Streamdown } from "streamdown";

import { PrettyText } from "../utility";
import { useMarkdownMode } from "./MarkdownDisplayContext";
import { streamdownComponents } from "./streamdownComponents";
import { markdownCSS } from "./styles";
import type { MarkdownDisplayMode } from "./types";

// Cast needed because @streamdown/code compiles against shiki v3 types while
// streamdown's published .d.ts references a different shiki resolution. The
// runtime interface is identical.
const plugins: PluginConfig = {
  code: code as unknown as PluginConfig["code"],
};

// ---------------------------------------------------------------------------
// Icon overrides — match streamdown's code-block action icons to Phoenix's
// icon set so they look consistent with the table toolbar controls.
// ---------------------------------------------------------------------------

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function CopyIcon({ size, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 13V12C9 10.346 10.346 9 12 9H13V5.667C13 5.299 12.701 5 12.333 5H5.667C5.299 5 5 5.299 5 5.667V12.333C5 12.701 5.299 13 5.667 13H9ZM9 15H5.667C4.196 15 3 13.804 3 12.333V5.667C3 4.196 4.196 3 5.667 3H12.333C13.804 3 15 4.196 15 5.667V9H18C19.654 9 21 10.346 21 12V18C21 19.654 19.654 21 18 21H12C10.346 21 9 19.654 9 18V15ZM12 11C11.449 11 11 11.449 11 12V18C11 18.551 11.449 19 12 19H18C18.552 19 19 18.551 19 18V12C19 11.449 18.552 11 18 11H12Z"
      />
    </svg>
  );
}

function CheckIcon({ size, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      {...props}
    >
      <path d="M9.86 18a1 1 0 0 1-.73-.32l-4.86-5.17a1 1 0 1 1 1.46-1.37l4.12 4.39 8.41-9.2a1 1 0 1 1 1.48 1.34l-9.14 10a1 1 0 0 1-.73.33z" />
    </svg>
  );
}

function DownloadIcon({ size, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      {...props}
    >
      <rect x="4" y="18" width="16" height="2" rx="1" ry="1" />
      <rect
        x="3"
        y="17"
        width="4"
        height="2"
        rx="1"
        ry="1"
        transform="rotate(-90 5 18)"
      />
      <rect
        x="17"
        y="17"
        width="4"
        height="2"
        rx="1"
        ry="1"
        transform="rotate(-90 19 18)"
      />
      <path d="M12 15a1 1 0 0 1-.58-.18l-4-2.82a1 1 0 0 1-.24-1.39 1 1 0 0 1 1.4-.24L12 12.76l3.4-2.56a1 1 0 0 1 1.2 1.6l-4 3a1 1 0 0 1-.6.2z" />
      <path d="M12 13a1 1 0 0 1-1-1V4a1 1 0 0 1 2 0v8a1 1 0 0 1-1 1z" />
    </svg>
  );
}

const streamdownIcons: Partial<IconMap> = {
  CopyIcon,
  CheckIcon,
  DownloadIcon,
};

export function MarkdownBlock({
  children,
  mode,
  margin = "default",
}: {
  children: string;
  mode: MarkdownDisplayMode;
  margin?: "default" | "none";
}) {
  const spacingCSS =
    margin === "none"
      ? css`
          margin: 0;
        `
      : css`
          margin: var(--global-dimension-static-size-200);
        `;

  return mode === "markdown" ? (
    <div css={[markdownCSS, spacingCSS]}>
      <Streamdown
        components={streamdownComponents}
        controls={{ code: { copy: true, download: true }, table: false }}
        icons={streamdownIcons}
        linkSafety={{ enabled: false }}
        mode="static"
        plugins={plugins}
      >
        {children}
      </Streamdown>
    </div>
  ) : (
    <PrettyText preCSS={spacingCSS}>{children}</PrettyText>
  );
}

export function ConnectedMarkdownBlock({
  children,
  margin = "default",
}: {
  children: string;
  margin?: "default" | "none";
}) {
  const { mode } = useMarkdownMode();
  return (
    <MarkdownBlock mode={mode} margin={margin}>
      {children}
    </MarkdownBlock>
  );
}
