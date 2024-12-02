import React from "react";
import { css } from "@emotion/react";

import { Button, Icon, Icons } from "@arizeai/components";

import { Loading } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

export function PlaygroundRunButton() {
  const runPlaygroundInstances = usePlaygroundContext(
    (state) => state.runPlaygroundInstances
  );
  const cancelPlaygroundInstances = usePlaygroundContext(
    (state) => state.cancelPlaygroundInstances
  );
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );
  return (
    <Button
      variant="primary"
      icon={
        !isRunning ? (
          <Icon svg={<Icons.PlayCircleOutline />} />
        ) : (
          <div
            css={css`
              margin-right: var(--ac-global-dimension-static-size-50);
              & > * {
                height: 1em;
                width: 1em;
                font-size: 1.3rem;
              }
            `}
          >
            <Loading size="S" />
          </div>
        )
      }
      size="compact"
      onClick={() => {
        if (isRunning) {
          cancelPlaygroundInstances();
        } else {
          runPlaygroundInstances();
        }
      }}
    >
      {isRunning ? "Cancel" : "Run"}
    </Button>
  );
}
