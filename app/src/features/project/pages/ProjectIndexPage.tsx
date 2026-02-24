import { Navigate } from "react-router";

import { useProjectContext } from "@phoenix/contexts/ProjectContext";

export const ProjectIndexPage = () => {
  const defaultTab = useProjectContext((state) => state.defaultTab);
  return <Navigate to={defaultTab} replace />;
};
