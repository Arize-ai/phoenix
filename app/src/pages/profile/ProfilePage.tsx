import { useEffect } from "react";
import { css } from "@emotion/react";

import { Flex } from "@phoenix/components";
import { useViewer } from "@phoenix/contexts/ViewerContext";

import { ViewerAPIKeys } from "./ViewerAPIKeys";
import { ViewerPreferences } from "./ViewerPreferences";
import { ViewerProfileCard } from "./ViewerProfileCard";

const profilePageCSS = css`
  overflow-y: auto;
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

  if (!viewer) {
    return null;
  }

  return (
    <main css={profilePageCSS}>
      <div css={profilePageInnerCSS}>
        <Flex direction="column" gap="size-200">
          <ViewerProfileCard />
          <ViewerPreferences />
          <ViewerAPIKeys viewer={viewer} />
        </Flex>
      </div>
    </main>
  );
}
