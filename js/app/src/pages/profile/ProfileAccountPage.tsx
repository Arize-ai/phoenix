import { useViewer } from "@phoenix/contexts/ViewerContext";

import { ViewerProfileCard } from "./ViewerProfileCard";

export function ProfileAccountPage() {
  const { viewer } = useViewer();

  return viewer ? <ViewerProfileCard /> : null;
}
