import React from "react";

import { Switch } from "@arizeai/components";

import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

/**
 * Enable / Disable auto refresh for projects
 */
export function ProjectsAutoRefreshToggle() {
  const autoRefreshEnabled = usePreferencesContext(
    (state) => state.projectsAutoRefreshEnabled
  );
  const setAutoRefreshEnabled = usePreferencesContext(
    (state) => state.setProjectAutoRefreshEnabled
  );

  return (
    <Switch
      labelPlacement="start"
      isSelected={autoRefreshEnabled}
      onChange={() => {
        setAutoRefreshEnabled(!autoRefreshEnabled);
      }}
    >
      Auto-Refresh
    </Switch>
  );
}
