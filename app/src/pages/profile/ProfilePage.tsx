import { useEffect } from "react";
import { css } from "@emotion/react";

import { Flex } from "@phoenix/components";
import { useViewer } from "@phoenix/contexts/ViewerContext";

import { ViewerAPIKeys } from "./ViewerAPIKeys";
import { ViewerPreferences } from "./ViewerPreferences";
import { ViewerProfileCard } from "./ViewerProfileCard";

const profilePageCSS = css`
  overflow-y: auto;
  height: 100%;
`;

const profilePageInnerCSS = css`
  padding: var(--ac-global-dimension-size-400);
  max-width: 800px;
  min-width: 500px;
  box-sizing: border-box;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
`;

export function ProfilePage() {
  const { viewer, refetchViewer } = useViewer();

  useEffect(() => {
    refetchViewer();
  }, [refetchViewer]);

  return (
    <main css={profilePageCSS}>
      <title>Profile - Phoenix</title>
      <div css={profilePageInnerCSS}>
        <Flex direction="column" gap="size-200">
          {viewer && <ViewerProfileCard />}
          <ViewerPreferences />
          {viewer && <ViewerAPIKeys viewer={viewer} />}
        </Flex>
      </div>
    </main>
  );
}
