import React from "react";
import { css } from "@emotion/react";

import { Alert, Icon, Icons, TabPane, Tabs } from "@arizeai/components";

const basename = window.Config.basename;
const iframeStyle = {
  width: "100%",
  height: "100%",
  border: "none",
  backgroundColor: "white",
};
export function APIsPage() {
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        height: 100%;
        .ac-tabs {
          flex: 1 1 auto;
        }
        .ac-tabs__pane-container,
        .ac-tabs__pane-container > div {
          flex: 1 1 auto;
          height: 100%;
        }
      `}
    >
      <Alert variant="info" banner icon={<Icon svg={<Icons.InfoFilled />} />}>
        These APIs are under active development and are subject to change.
      </Alert>
      <Tabs>
        <TabPane name="REST">
          {({ isSelected }) => {
            return (
              isSelected && (
                <iframe src={`${basename}/docs`} style={iframeStyle} />
              )
            );
          }}
        </TabPane>
        <TabPane name="GraphQL">
          {({ isSelected }) => {
            return (
              isSelected && (
                <iframe src={`${basename}/graphql`} style={iframeStyle} />
              )
            );
          }}
        </TabPane>
      </Tabs>
    </div>
  );
}
