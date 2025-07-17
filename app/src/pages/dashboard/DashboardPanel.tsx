import { forwardRef } from "react";
import { css } from "@emotion/react";

import { Heading, Text, View } from "@phoenix/components";

interface DashboardPanelHeaderProps {
  title: string;
  subtitle?: string;
}

function DashboardPanelHeader({ title, subtitle }: DashboardPanelHeaderProps) {
  return (
    <div
      css={css`
        padding: var(--ac-global-dimension-size-100)
          var(--ac-global-dimension-size-200);
        border-bottom: 1px solid var(--ac-global-color-grey-200);
        display: flex;
        flex-direction: row;
        gap: var(--ac-global-dimension-size-100);
      `}
      className="dashboard-panel-header"
    >
      <Heading>{title}</Heading>
      {subtitle && <Text>{subtitle}</Text>}
    </div>
  );
}

interface DashboardPanelProps extends DashboardPanelHeaderProps {
  children: React.ReactNode;
}

export const DashboardPanel = forwardRef(function DashboardPanel(
  { title, children }: DashboardPanelProps,
  ref: React.Ref<HTMLDivElement>
) {
  return (
    <View
      borderWidth="thin"
      borderColor="dark"
      borderRadius="medium"
      height="100%"
      width="100%"
      data-testid={`dashboard-panel`}
      backgroundColor="grey-75"
      ref={ref}
    >
      <DashboardPanelHeader title={title} />
      {children}
    </View>
  );
});
