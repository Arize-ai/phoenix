import { Outlet, useLoaderData, useParams } from "react-router";
import invariant from "tiny-invariant";

import { ProjectProvider } from "@phoenix/contexts/ProjectContext";

import { projectLoader } from "./projectLoader";

export function ProjectRoot() {
  const loaderData = useLoaderData<typeof projectLoader>();
  invariant(loaderData, "loaderData is required");
  const { projectId } = useParams();
  invariant(projectId, "Project ID is required");
  return (
    <ProjectProvider projectId={projectId}>
      <title>{`${loaderData.project.name} - Project - Phoenix`}</title>
      <Outlet />
    </ProjectProvider>
  );
}
