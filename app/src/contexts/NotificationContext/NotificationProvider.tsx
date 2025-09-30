import { PropsWithChildren, useMemo } from "react";
import { UNSTABLE_ToastQueue as ToastQueue } from "react-aria-components";
import { flushSync } from "react-dom";

import { ToastRegion } from "@phoenix/components";
import {
  NotificationContext,
  NotificationParams,
} from "@phoenix/contexts/NotificationContext/NotificationContext";

const createToastQueue = (
  ...args: ConstructorParameters<typeof ToastQueue<NotificationParams>>
) => new ToastQueue<NotificationParams>(...args);

export const NotificationProvider = ({
  children,
}: PropsWithChildren): JSX.Element => {
  const queue = useMemo(
    () =>
      createToastQueue({
        // Wrap state updates in a CSS view transition.
        wrapUpdate(fn) {
          if ("startViewTransition" in document) {
            // @ts-expect-error this will error until we upgrade our version of typescript
            document?.startViewTransition(() => {
              flushSync(fn);
            });
          } else {
            fn();
          }
        },
      }),
    []
  );
  return (
    <NotificationContext.Provider value={{ queue }}>
      <ToastRegion queue={queue} />
      {children}
    </NotificationContext.Provider>
  );
};
