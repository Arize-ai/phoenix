import { css } from "@emotion/react";

import {
  CopyToClipboardButton,
  SegmentedControl,
  SegmentedControlItem,
} from "@phoenix/components";
import { embeddedCopyButtonCSS } from "@phoenix/components/core/copy/styles";
import { usePreferencesContext } from "@phoenix/contexts";
import { packageManagersByLanguage } from "@phoenix/store/preferencesStore";
import type { PackageManager, ProgrammingLanguage } from "@phoenix/types/code";
import { isPackageManager } from "@phoenix/types/code";
import { classNames } from "@phoenix/utils/classNames";

import { BashBlock } from "./BashBlock";
import { codeBlockWithCopyCSS, copyableSurfaceCSS } from "./styles";

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
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  overflow: hidden;
  // Painted on the outer block so the header and code area read as one
  // surface. The copy button lives in the header, so the inner code shell's
  // own :has() hover never fires.
  ${copyableSurfaceCSS}
  ${embeddedCopyButtonCSS}

  .package-manager-command__header {
    padding: var(--global-dimension-size-100);
    padding-bottom: 0;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  // The shell paints its own copy of the surface color; make it transparent so
  // this block's single surface (and its hover state) shows through.
  .package-manager-command__code {
    background-color: transparent;
  }
`;

type PackageManagerCommandBlockProps = {
  language: ProgrammingLanguage;
  packages: readonly string[];
  className?: string;
};

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
        <SegmentedControl
          aria-label="Package manager"
          selectedKey={selectedPackageManager}
          size="S"
          onSelectionChange={(nextKey) => {
            if (isPackageManager(nextKey)) {
              setPackageManager(language, nextKey);
            }
          }}
        >
          {packageManagerOptions.map((packageManager) => (
            <SegmentedControlItem
              key={packageManager}
              id={packageManager}
              aria-label={packageManager}
            >
              {packageManager}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        <CopyToClipboardButton text={selectedCommand} />
      </div>
      <div className="package-manager-command__code" css={codeBlockWithCopyCSS}>
        <BashBlock value={selectedCommand} />
      </div>
    </div>
  );
}
