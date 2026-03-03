import { useState } from "react";

import { PageHeader, View } from "@phoenix/components";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import { ModelMenu } from "@phoenix/components/generative/ModelMenu";
import { prependBasename } from "@phoenix/utils/routingUtils";

import {
  AGENT_MODEL_LOCAL_STORAGE_KEY,
  DEFAULT_MODEL_MENU_VALUE,
  getAgentModelConfigFromLocalStorage,
  toAgentModelConfig,
  toModelMenuValue,
} from "./agentModelConfig";
import { Chat } from "./Chat";

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
    <>
      <View borderBottomColor="dark" borderBottomWidth="thin">
        <PageHeader
          title="PXI"
          extra={<ModelMenu value={menuValue} onChange={handleChange} />}
        />
      </View>
      <Chat key={chatApiUrl} chatApiUrl={chatApiUrl} />
    </>
  );
}
