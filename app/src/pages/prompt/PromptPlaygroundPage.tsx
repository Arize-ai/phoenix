import { useEffect } from "react";
import { useLoaderData, useNavigate, useParams } from "react-router";

import { promptPlaygroundLoader } from "@phoenix/pages/prompt/promptPlaygroundLoader";

export function PromptPlaygroundPage() {
  const { instanceWithPrompt } = useLoaderData<typeof promptPlaygroundLoader>();
  const navigate = useNavigate();
  const params = useParams();

  // Redirect to the playground page with prompt params in the URL
  useEffect(() => {
    const promptId = instanceWithPrompt.prompt?.id ?? params.promptId;
    if (promptId) {
      const searchParams = new URLSearchParams();
      searchParams.set("promptId", promptId);
      const versionId = instanceWithPrompt.prompt?.version;
      if (versionId) {
        searchParams.set("promptVersionId", versionId);
      }
      const tagName = instanceWithPrompt.prompt?.tag;
      if (tagName) {
        searchParams.set("promptTagName", tagName);
      }
      navigate(`/playground?${searchParams.toString()}`, { replace: true });
    } else {
      navigate("/playground", { replace: true });
    }
  }, [instanceWithPrompt.prompt, params.promptId, navigate]);

  return null;
}
