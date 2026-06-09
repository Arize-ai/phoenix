import { css } from "@emotion/react";
import type { ChatStatus } from "ai";
import { useState } from "react";

import { parseRequestedSkills } from "@phoenix/agent/skills/requestedSkills";
import {
  PromptInput,
  PromptInputActions,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTools,
} from "@phoenix/components/ai/prompt-input";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";

import { AgentContextPills } from "./AgentContextPills";
import { AgentModelMenu } from "./AgentModelMenu";
import { AgentWebSearchToggle } from "./AgentWebSearchToggle";
import { SkillPromptInputBoundary } from "./SkillPromptInputBoundary";
import type { AvailableAgentSkill } from "./useAvailableAgentSkills";

const agentChatInputCSS = css`
  .agent-chat-input__prompt-stack {
    position: relative;
    isolation: isolate;
  }

  .agent-chat-input__skill-menu-layer {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;

    > * {
      pointer-events: auto;
    }
  }

  .agent-chat-input__prompt-input {
    position: relative;
    z-index: 1;
  }
`;

type AgentChatInputSubmit = {
  text: string;
  requestedSkills: string[];
};

export type AgentChatInputProps = {
  status: ChatStatus;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (submit: AgentChatInputSubmit) => void;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  modelMenuValue: ModelMenuValue;
  onModelChange: (model: ModelMenuValue) => void;
  isSubmitDisabled?: boolean;
  onStop: () => void;
};

/**
 * The normal assistant prompt composer.
 *
 * Owns prompt-local affordances that turn user text into chat request metadata:
 * context pills, model/search tools, slash-command skill selection, and the
 * requested-skills payload. Other chat input modes (consent, elicitation,
 * rewind confirmation) stay in `ChatView` because they replace the composer.
 */
export function AgentChatInput({
  status,
  value,
  onValueChange,
  onSubmit,
  textareaRef,
  modelMenuValue,
  onModelChange,
  isSubmitDisabled,
  onStop,
}: AgentChatInputProps) {
  const [skillMenuLayer, setSkillMenuLayer] = useState<HTMLDivElement | null>(
    null
  );
  const [availableSkills, setAvailableSkills] = useState<AvailableAgentSkill[]>(
    []
  );

  const handleSubmit = (text: string) => {
    const availableSkillNames = new Set(
      availableSkills.map((skill) => skill.name)
    );
    onSubmit({
      text,
      requestedSkills: parseRequestedSkills(text, availableSkillNames),
    });
  };

  return (
    <div css={agentChatInputCSS}>
      <div className="agent-chat-input__prompt-stack">
        <div
          className="agent-chat-input__skill-menu-layer"
          ref={setSkillMenuLayer}
        />
        <PromptInput
          className="agent-chat-input__prompt-input"
          onSubmit={handleSubmit}
          status={status}
          value={value}
          onValueChange={onValueChange}
        >
          <AgentContextPills />
          <PromptInputBody>
            <SkillPromptInputBoundary
              placeholder="Send a message..."
              onSkillsChange={setAvailableSkills}
              textareaRef={textareaRef}
              menuPortalTarget={skillMenuLayer}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <AgentModelMenu
                value={modelMenuValue}
                onChange={onModelChange}
                placement="top start"
                shouldFlip
                variant="quiet"
              />
              <AgentWebSearchToggle />
            </PromptInputTools>

            <PromptInputActions>
              <PromptInputSubmit
                isDisabled={isSubmitDisabled || undefined}
                onPress={onStop}
              />
            </PromptInputActions>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
