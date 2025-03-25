import React from "react";
import { Navigate } from "react-router";

import { useProjectContext } from "@phoenix/contexts/ProjectContext";

export const ProjectIndexPage = () => {
  const defaultTab = useProjectContext((state) => state.defaultTab);
  console.log("defaultTab", defaultTab);
  return <Navigate to={defaultTab} replace />;
};
