import { css } from "@emotion/react";
import type { Key } from "react";

import {
  CopyToClipboardButton,
  ToggleButton,
  ToggleButtonGroup,
} from "@phoenix/components";
import { usePreferencesContext } from "@phoenix/contexts";
import type { PackageManager, ProgrammingLanguage } from "@phoenix/types/code";
import { isPackageManager } from "@phoenix/types/code";
import { classNames } from "@phoenix/utils/classNames";

import { BashBlock } from "./BashBlock";
import { codeBlockWithCopyCSS } from "./styles";

/**
 * One selectable command preset for the package manager toggle.
 */
type InstallCommandOption = {
  /**
   * The package manager represented by this option.
   */
  packageManager: PackageManager;
  /**
   * The full command string copied/rendered when selected.
   */
  command: string;
};

function assertPackages(packages: readonly string[]) {
  if (packages.length === 0) {
    throw new Error("Expected at least one package");
  }
}

function getTypeScriptInstallCommandOptions(
  packages: readonly string[]
): InstallCommandOption[] {
  assertPackages(packages);
  const dependencyList = packages.join(" ");
  return [
    {
      packageManager: "npm",
      command: `npm install ${dependencyList}`,
    },
    {
      packageManager: "pnpm",
      command: `pnpm add ${dependencyList}`,
    },
    {
      packageManager: "bun",
      command: `bun add ${dependencyList}`,
    },
  ];
}

function getPythonInstallCommandOptions(
  packages: readonly string[]
): InstallCommandOption[] {
  assertPackages(packages);
  const dependencyList = packages.join(" ");
  return [
    {
      packageManager: "pip",
      command: `pip install ${dependencyList}`,
    },
    {
      packageManager: "uv",
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
  const { selectedPackageManager, setPackageManager } = usePreferencesContext(
    (state) => ({
      selectedPackageManager: state.packageManagerByLanguage[language],
      setPackageManager: state.setPackageManager,
    })
  );
  const installCommandOptions: readonly InstallCommandOption[] =
    language === "TypeScript"
      ? getTypeScriptInstallCommandOptions(packages)
      : getPythonInstallCommandOptions(packages);
  const selectedCommand =
    installCommandOptions.find(
      (installCommandOption) =>
        installCommandOption.packageManager === selectedPackageManager
    )?.command ??
    installCommandOptions[0]?.command ??
    "";

  return (
    <div
      className={classNames("package-manager-command", className)}
      css={packageManagerCommandBlockCSS}
    >
      <div className="package-manager-command__header">
        <ToggleButtonGroup
          aria-label="Package manager"
          selectedKeys={[selectedPackageManager]}
          disallowEmptySelection
          size="S"
          className="package-manager-command__toggle-group"
          onSelectionChange={(selection) => {
            const nextKey = getSelectedKey(selection);
            if (nextKey == null) {
              return;
            }
            if (isPackageManager(nextKey)) {
              setPackageManager(language, nextKey);
            }
          }}
        >
          {installCommandOptions.map((installCommandOption) => (
            <ToggleButton
              key={installCommandOption.packageManager}
              id={installCommandOption.packageManager}
              aria-label={installCommandOption.packageManager}
              className="package-manager-command__toggle"
            >
              {installCommandOption.packageManager}
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
