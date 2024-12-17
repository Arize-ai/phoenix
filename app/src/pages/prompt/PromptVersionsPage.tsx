import React from "react";

import { usePromptIdLoader } from "./usePromptIdLoader";

export function PromptVersionsPage() {
  usePromptIdLoader();
  return <div>versions</div>;
}
