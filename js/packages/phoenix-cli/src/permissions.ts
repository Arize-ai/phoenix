type OperationEntry = {
  method: string;
  pathPattern: RegExp;
  scope: string;
};

export const OPERATION_MAP: OperationEntry[] = [
  // projects
  {
    method: "DELETE",
    pathPattern: /^\/v1\/projects\/[^/]+$/,
    scope: "projects.delete",
  },
  // spans
  {
    method: "DELETE",
    pathPattern: /^\/v1\/spans\/[^/]+$/,
    scope: "spans.delete",
  },
  // traces
  {
    method: "DELETE",
    pathPattern: /^\/v1\/traces\/[^/]+$/,
    scope: "traces.delete",
  },
  // sessions
  {
    method: "DELETE",
    pathPattern: /^\/v1\/sessions\/[^/]+$/,
    scope: "sessions.delete",
  },
  // datasets
  {
    method: "DELETE",
    pathPattern: /^\/v1\/datasets\/[^/]+$/,
    scope: "datasets.delete",
  },
  // experiments
  {
    method: "DELETE",
    pathPattern: /^\/v1\/experiments\/[^/]+$/,
    scope: "experiments.delete",
  },
  // prompts
  {
    method: "DELETE",
    pathPattern: /^\/v1\/prompts\/[^/]+$/,
    scope: "prompts.delete",
  },
  // annotation_configs
  {
    method: "DELETE",
    pathPattern: /^\/v1\/annotation_configs\/[^/]+$/,
    scope: "annotation_configs.delete",
  },
];
