import { PropsWithChildren, useState } from "react";

import { PointCloudContext } from "@phoenix/contexts/PointCloudContext/PointCloudContext";
import {
  createPointCloudStore,
  type PointCloudProps,
  type PointCloudStore,
} from "@phoenix/store";

export function PointCloudProvider({
  children,
  ...props
}: PropsWithChildren<Partial<PointCloudProps>>) {
  const [store] = useState<PointCloudStore>(() => createPointCloudStore(props));

  return (
    <PointCloudContext.Provider value={store}>
      {children}
    </PointCloudContext.Provider>
  );
}
