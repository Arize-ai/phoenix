import { css } from "@emotion/react";

import { Alert, Icon, Icons } from "@phoenix/components";

const basename = window.Config.basename;

export function RestAPIPage() {
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        height: 100%;
      `}
    >
      <Alert variant="info" banner icon={<Icon svg={<Icons.InfoFilled />} />}>
        These APIs are under active development and are subject to change.
      </Alert>
      <iframe
        title="REST API documentation"
        src={`${basename}/docs`}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          backgroundColor: "white",
        }}
      />
    </div>
  );
}
