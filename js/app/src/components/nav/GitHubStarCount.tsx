import { useEffect, useState } from "react";

import { Counter } from "@phoenix/components";

export function GitHubStarCount() {
  const [starCount, setStarCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("https://api.github.com/repos/Arize-ai/phoenix")
      .then((response) => response.json())
      .then((data) => {
        setStarCount(data.stargazers_count);
      });
  }, []);

  return <Counter count={starCount} notation="compact" />;
}
