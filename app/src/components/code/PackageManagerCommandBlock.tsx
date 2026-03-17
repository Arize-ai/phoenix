import { css } from "@emotion/react";
import type { Key } from "react";

import {
  CopyToClipboardButton,
  ToggleButton,
  ToggleButtonGroup,
} from "@phoenix/components";
import { usePreferencesContext } from "@phoenix/contexts";
import { packageManagersByLanguage } from "@phoenix/store/preferencesStore";
import type { PackageManager, ProgrammingLanguage } from "@phoenix/types/code";
import { isPackageManager } from "@phoenix/types/code";
import { classNames } from "@phoenix/utils/classNames";

import { BashBlock } from "./BashBlock";
import { codeBlockWithCopyCSS } from "./styles";

/**
 * Maps each package manager to its install command prefix.
 */
const installCommandByPackageManager: Record<PackageManager, string> = {
  npm: "npm install",
  pnpm: "pnpm add",
  bun: "bun add",
  pip: "pip install",
  uv: "uv add",
};

const packageManagerCommandBlockCSS = css`
  border-radius: var(--global-rounding-small);
  border: 1px solid var(--global-border-color-default);
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
  const packageManagerOptions = packageManagersByLanguage[language];
  const dependencyList = packages.join(" ");
  const selectedCommand = `${installCommandByPackageManager[selectedPackageManager]} ${dependencyList}`;

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
          {packageManagerOptions.map((packageManager) => (
            <ToggleButton
              key={packageManager}
              id={packageManager}
              aria-label={packageManager}
              className="package-manager-command__toggle"
            >
              {packageManager}
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
