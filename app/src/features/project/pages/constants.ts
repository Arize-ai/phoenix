export const PROJECT_TABS = ["traces", "spans", "sessions", "metrics"] as const;

export type ProjectTab = (typeof PROJECT_TABS)[number];

/**
 * The default number of items to show in a table.
 * A typical big screen can only show less than 30 items at a time.
 */
export const DEFAULT_PAGE_SIZE = 30;

export const isProjectTab = (tab: string): tab is ProjectTab => {
  return PROJECT_TABS.includes(tab as ProjectTab);
};
