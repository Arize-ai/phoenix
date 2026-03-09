import { css } from "@emotion/react";
import type { Key } from "react";
import { useState } from "react";

import {
  CopyToClipboardButton,
  ToggleButton,
  ToggleButtonGroup,
} from "@phoenix/components";
import type { ProgrammingLanguage } from "@phoenix/types/code";
import { classNames } from "@phoenix/utils/classNames";

import { BashBlock } from "./BashBlock";
import { codeBlockWithCopyCSS } from "./styles";

type PackageManagerCommandOption = {
  id: string;
  label: string;
  command: string;
};

function assertPackages(packages: readonly string[]) {
  if (packages.length === 0) {
    throw new Error("Expected at least one package");
  }
}

function getTypeScriptInstallCommandOptions(
  packages: readonly string[]
): PackageManagerCommandOption[] {
  assertPackages(packages);
  const dependencyList = packages.join(" ");
  return [
    {
      id: "npm",
      label: "npm",
      command: `npm install ${dependencyList}`,
    },
    {
      id: "pnpm",
      label: "pnpm",
      command: `pnpm add ${dependencyList}`,
    },
    {
      id: "bun",
      label: "bun",
      command: `bun add ${dependencyList}`,
    },
  ];
}

function getPythonInstallCommandOptions(
  packages: readonly string[]
): PackageManagerCommandOption[] {
  assertPackages(packages);
  const dependencyList = packages.join(" ");
  return [
    {
      id: "pip",
      label: "pip",
      command: `pip install ${dependencyList}`,
    },
    {
      id: "uv",
      label: "uv",
      command: `uv add ${dependencyList}`,
    },
  ];
}

const packageManagerCommandBlockCSS = css`
  border-radius: var(--global-rounding-small);
  border: 1px solid var(--global-border-color-light);
  overflow: hidden;

  .package-manager-command__header {
    padding: var(--global-dimension-size-100);
    padding-bottom: 0;
    background: var(--code-mirror-editor-background-color);
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .package-manager-command__toggle-group {
    gap: var(--global-dimension-size-50);
  }

  .package-manager-command__toggle {
    border: none;
    border-radius: var(--global-rounding-small) !important;
    background: transparent;
    color: var(--global-color-gray-500);
    height: 26px;
  }

  .package-manager-command__toggle[data-selected="true"] {
    background: var(--global-color-gray-300);
    color: var(--global-color-gray-800);
    // fix layout shift caused by margin-left: -1px in ToggleButtonGroup
    margin: 0 !important;
    &:hover {
      background: var(--global-color-gray-400);
      color: var(--global-color-gray-900);
    }
  }
`;

type PackageManagerCommandBlockProps = {
  language: ProgrammingLanguage;
  packages: readonly string[];
  className?: string;
};

function getInitialSelectedKey(
  options: readonly PackageManagerCommandOption[]
): string {
  if (options.length === 0) {
    throw new Error("Expected at least one package manager option");
  }
  return options[0].id;
}

function getSelectedKey(selection: Set<Key> | "all"): string | null {
  if (selection === "all" || selection.size === 0) {
    return null;
  }
  return String(selection.keys().next().value);
}

export function PackageManagerCommandBlock({
  language,
  packages,
  className,
}: PackageManagerCommandBlockProps) {
  const options: readonly PackageManagerCommandOption[] =
    language === "TypeScript"
      ? getTypeScriptInstallCommandOptions(packages)
      : getPythonInstallCommandOptions(packages);
  const [selectedKey, setSelectedKey] = useState(() =>
    getInitialSelectedKey(options)
  );
  const selectedCommand =
    options.find((option) => option.id === selectedKey)?.command ??
    options[0]?.command ??
    "";

  return (
    <div
      className={classNames("package-manager-command", className)}
      css={packageManagerCommandBlockCSS}
    >
      <div className="package-manager-command__header">
        <ToggleButtonGroup
          aria-label="Package manager"
          selectedKeys={[selectedKey]}
          disallowEmptySelection
          size="S"
          className="package-manager-command__toggle-group"
          onSelectionChange={(selection) => {
            const nextKey = getSelectedKey(selection);
            if (nextKey == null) {
              return;
            }
            if (options.some((option) => option.id === nextKey)) {
              setSelectedKey(nextKey);
            }
          }}
        >
          {options.map((option) => (
            <ToggleButton
              key={option.id}
              id={option.id}
              aria-label={option.label}
              className="package-manager-command__toggle"
            >
              {option.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <CopyToClipboardButton text={selectedCommand} />
      </div>
      <div css={codeBlockWithCopyCSS}>
        <BashBlock value={selectedCommand} />
      </div>
    </div>
  );
}
