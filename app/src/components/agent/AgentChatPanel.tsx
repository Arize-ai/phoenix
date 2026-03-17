import { css } from "@emotion/react";
import { useState } from "react";
import { Panel, PanelResizeHandle } from "react-resizable-panels";

import { Flex, Icon, Icons } from "@phoenix/components";
import { compactResizeHandleCSS } from "@phoenix/components/resize/styles";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
import { prependBasename } from "@phoenix/utils/routingUtils";

import type { ModelMenuValue } from "../generative/ModelMenu";
import {
  AGENT_MODEL_LOCAL_STORAGE_KEY,
  Chat,
  DEFAULT_MODEL_MENU_VALUE,
  getAgentModelConfigFromLocalStorage,
  toAgentModelConfig,
  toModelMenuValue,
} from ".";

const panelHeaderCSS = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
  border-bottom: 1px solid var(--global-color-gray-200);
  font-weight: 600;
  font-size: var(--global-font-size-s);
`;

const closeButtonCSS = css`
  background: none;
  border: none;
  cursor: pointer;
  color: var(--global-text-color-900);
  padding: 4px;
  display: flex;
  align-items: center;
  border-radius: var(--global-rounding-small);

  &:hover {
    background-color: var(--global-color-gray-200);
  }
`;

const panelContentCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background-color: var(--global-color-gray-75);
`;

export function AgentChatPanel() {
  const isAgentsEnabled = useFeatureFlag("agents");
  const isOpen = useAgentContext((state) => state.isOpen);
  const setIsOpen = useAgentContext((state) => state.setIsOpen);

  const [menuValue, setMenuValue] = useState<ModelMenuValue>(() => {
    const config = getAgentModelConfigFromLocalStorage();
    return config ? toModelMenuValue(config) : DEFAULT_MODEL_MENU_VALUE;
  });

  if (!isAgentsEnabled || !isOpen) {
    return null;
  }

  const params = new URLSearchParams({
    model_name: menuValue.modelName,
    ...(menuValue.customProvider
      ? { provider_type: "custom", provider_id: menuValue.customProvider.id }
      : { provider_type: "builtin", provider: menuValue.provider }),
  });
  const chatApiUrl = prependBasename(`/chat?${params}`);

  const handleModelChange = (model: ModelMenuValue) => {
    setMenuValue(model);
    localStorage.setItem(
      AGENT_MODEL_LOCAL_STORAGE_KEY,
      JSON.stringify(toAgentModelConfig(model))
    );
  };

  return (
    <>
      <PanelResizeHandle css={compactResizeHandleCSS} />
      <Panel minSize={20} maxSize={50} defaultSize={30}>
        <div css={panelContentCSS}>
          <div css={panelHeaderCSS}>
            <Flex direction="row" alignItems="center" gap="size-50">
              <Icon svg={<Icons.Robot />} />
              <span>PXI</span>
            </Flex>
            <button
              css={closeButtonCSS}
              onClick={() => setIsOpen(false)}
              aria-label="Close agent chat"
            >
              <Icon svg={<Icons.CloseOutline />} />
            </button>
          </div>
          <Chat
            key={chatApiUrl}
            chatApiUrl={chatApiUrl}
            modelMenuValue={menuValue}
            onModelChange={handleModelChange}
          />
        </div>
      </Panel>
    </>
  );
}
