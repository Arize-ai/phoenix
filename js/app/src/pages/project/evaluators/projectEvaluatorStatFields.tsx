import { css } from "@emotion/react";

import { Text } from "@phoenix/components";

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
`;

export function StatFieldList({
  children,
  fillHeight = true,
}: React.PropsWithChildren<{ fillHeight?: boolean }>) {
  return <dl css={statFieldListCSS(fillHeight)}>{children}</dl>;
}

export function StatField({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="project-evaluator-stat-fields__field">
      <dt>
        {typeof label === "string" ? (
          <Text size="XS" color="text-700">
            {label}
          </Text>
        ) : (
          label
        )}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
