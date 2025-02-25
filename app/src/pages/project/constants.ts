export const PROJECT_TABS = ["traces", "spans", "sessions"] as const;

export type ProjectTab = (typeof PROJECT_TABS)[number];

export const isProjectTab = (tab: string): tab is ProjectTab => {
  return PROJECT_TABS.includes(tab as ProjectTab);
};
