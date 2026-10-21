import { css } from "@emotion/react";

import { ContextualHelp, Text } from "@phoenix/components";

const statFieldListCSS = (fillHeight: boolean) => css`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--global-dimension-size-200);
  align-content: start;
  margin: 0;
  height: ${fillHeight ? "100%" : "auto"};

  dt,
  dd {
    margin: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  dd {
    font-variant-numeric: tabular-nums;
  }

  .project-evaluator-stat-fields__field {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-25);
    min-width: 0;
  }

  .project-evaluator-stat-fields__label {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-25);
    min-width: 0;
    .project-evaluator-stat-fields__label-text {
      display: block;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
`;

const statHelpTooltipCSS = css`
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
`;

export function StatFieldList({
  children,
  fillHeight = true,
}: React.PropsWithChildren<{ fillHeight?: boolean }>) {
  return <dl css={statFieldListCSS(fillHeight)}>{children}</dl>;
}

export function StatField({
  label,
  help,
  children,
}: {
  label: React.ReactNode;
  /** What the value means, behind an info tip beside the label. */
  help?: React.ReactNode;
  children: React.ReactNode;
}) {
  const labelContent =
    typeof label === "string" ? (
      <Text size="XS" color="text-700">
        {label}
      </Text>
    ) : (
      label
    );
  return (
    <div className="project-evaluator-stat-fields__field">
      <dt>
        {help ? (
          <div className="project-evaluator-stat-fields__label">
            <span className="project-evaluator-stat-fields__label-text">
              {labelContent}
            </span>
            <ContextualHelp
              variant="info"
              placement="top"
              css={statHelpTooltipCSS}
            >
              {help}
            </ContextualHelp>
          </div>
        ) : (
          labelContent
        )}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
