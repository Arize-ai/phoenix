import { Navigate, useLocation } from "react-router";

import { useProjectContext } from "@phoenix/contexts/ProjectContext";

export const ProjectIndexPage = () => {
  const defaultTab = useProjectContext((state) => state.defaultTab);
  const location = useLocation();
  return (
    <Navigate
      to={{
        pathname: defaultTab,
        search: location.search,
        hash: location.hash,
      }}
      replace
    />
  );
};
