import { useEffect, useState } from "react";
import { format } from "d3-format";

import { Counter } from "@phoenix/components";

export function GitHubStarCount() {
  const [starCount, setStarCountText] = useState<string>("--");

  useEffect(() => {
    // Only fetch star count if external resources are allowed
    if (!window.Config.allowExternalResources) {
      return;
    }
    
    fetch("https://api.github.com/repos/Arize-ai/phoenix")
      .then((response) => response.json())
      .then((data) => {
        setStarCountText(format(".2s")(data.stargazers_count));
      })
      .catch(() => {
        // Silently fail if external resources are blocked
      });
  }, []);

  return <Counter>{starCount}</Counter>;
}
