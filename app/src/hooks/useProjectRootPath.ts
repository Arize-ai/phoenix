import { useLocation, useParams } from "react-router";

/**
 * Returns the root path for a project url and the tab segment directly after it
 * @example "/projects/123/spans/456" -> "/projects/123" and "spans"
 * @returns the root path for a project and the tab segment directly after it
 */
export const useProjectRootPath = () => {
  const { projectId } = useParams();
  if (!projectId) {
    throw new Error("projectId is required");
  }
  const location = useLocation();
  const pathParts = location.pathname.split("/");
  const projectIndex = pathParts.indexOf(projectId);
  if (projectIndex === -1) {
    throw new Error("projectId not found in path");
  }
  const rootPath = pathParts
    // take everything up to and including the projectId
    .slice(0, projectIndex + 1)
    .join("/");
  const tab = pathParts[projectIndex + 1];
  return { rootPath, tab };
};
