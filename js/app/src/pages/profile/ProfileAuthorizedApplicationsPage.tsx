import { useViewer } from "@phoenix/contexts/ViewerContext";

import { AuthorizedApplicationsCard } from "./AuthorizedApplicationsCard";

export function ProfileAuthorizedApplicationsPage() {
  const { viewer } = useViewer();

  return viewer ? <AuthorizedApplicationsCard viewer={viewer} /> : null;
}
