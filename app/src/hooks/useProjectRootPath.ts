import { useLocation, useParams } from "react-router";

/**
 * Returns the root path for a project url
 * @example
 * "/projects/123/spans/456" -> "/projects/123"
 * @returns the root path for a project
 */
export const useProjectRootPath = () => {
  const { projectId } = useParams();
  if (!projectId) {
    throw new Error("projectId is required");
  }
  const location = useLocation();
  const rootPath = location.pathname
    .split("/")
    .slice(0, location.pathname.split("/").indexOf(projectId) + 1)
    .join("/");
  const tab = location.pathname.split(rootPath)[1].split("/")[1];
  return { rootPath, tab };
};
