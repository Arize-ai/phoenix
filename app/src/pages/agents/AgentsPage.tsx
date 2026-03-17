import { css } from "@emotion/react";
import { useState } from "react";

import { PageHeader, View } from "@phoenix/components";
import {
  AGENT_MODEL_LOCAL_STORAGE_KEY,
  Chat,
  DEFAULT_MODEL_MENU_VALUE,
  getAgentModelConfigFromLocalStorage,
  toAgentModelConfig,
  toModelMenuValue,
} from "@phoenix/components/agent";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import { prependBasename } from "@phoenix/utils/routingUtils";

export function AgentsPage() {
  const [menuValue, setMenuValue] = useState<ModelMenuValue>(() => {
    const config = getAgentModelConfigFromLocalStorage();
    return config ? toModelMenuValue(config) : DEFAULT_MODEL_MENU_VALUE;
  });

  const params = new URLSearchParams({
    model_name: menuValue.modelName,
    ...(menuValue.customProvider
      ? { provider_type: "custom", provider_id: menuValue.customProvider.id }
      : { provider_type: "builtin", provider: menuValue.provider }),
  });
  const chatApiUrl = prependBasename(`/chat?${params}`);

  const handleChange = (model: ModelMenuValue) => {
    setMenuValue(model);
    localStorage.setItem(
      AGENT_MODEL_LOCAL_STORAGE_KEY,
      JSON.stringify(toAgentModelConfig(model))
    );
  };

  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      `}
    >
      <View borderBottomColor="default" borderBottomWidth="thin">
        <PageHeader title="PXI" />
      </View>
      <Chat
        key={chatApiUrl}
        sessionId={null}
        chatApiUrl={chatApiUrl}
        modelMenuValue={menuValue}
        onModelChange={handleChange}
      />
    </div>
  );
}
