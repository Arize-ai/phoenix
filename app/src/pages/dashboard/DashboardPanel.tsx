import { forwardRef } from "react";
import { css } from "@emotion/react";

import { Heading, View } from "@phoenix/components";

interface DashboardPanelHeaderProps {
  title: string;
}

function DashboardPanelHeader({ title }: DashboardPanelHeaderProps) {
  return (
    <div
      css={css`
        padding: var(--ac-global-dimension-size-100)
          var(--ac-global-dimension-size-200);
        border-bottom: 1px solid var(--ac-global-color-grey-200);
      `}
      className="dashboard-panel-header"
    >
      <Heading>{title}</Heading>
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
      backgroundColor="grey-50"
      ref={ref}
    >
      <DashboardPanelHeader title={title} />
      {children}
    </View>
  );
});
