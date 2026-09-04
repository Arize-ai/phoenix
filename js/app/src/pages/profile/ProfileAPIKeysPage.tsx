import { useViewer } from "@phoenix/contexts/ViewerContext";

import { ViewerAPIKeys } from "./ViewerAPIKeys";

export function ProfileAPIKeysPage() {
  const { viewer } = useViewer();

  return viewer ? <ViewerAPIKeys viewer={viewer} /> : null;
}
