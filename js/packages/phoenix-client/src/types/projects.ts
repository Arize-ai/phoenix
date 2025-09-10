/**
 * A project can be identified by its projectId or projectName
 * In the case of a projectName, the name must be url encodable
 */
export type ProjectSelector = { projectId: string } | { projectName: string };
