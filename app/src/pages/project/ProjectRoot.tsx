import { Outlet, useParams } from "react-router";
import invariant from "tiny-invariant";

import { ProjectProvider } from "@phoenix/contexts/ProjectContext";

export function ProjectRoot() {
  const { projectId } = useParams();
  invariant(projectId, "Project ID is required");
  return (
    <ProjectProvider projectId={projectId}>
      <Outlet />
    </ProjectProvider>
  );
}
