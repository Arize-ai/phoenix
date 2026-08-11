import { css } from "@emotion/react";
import type { ChatStatus } from "ai";
import { useState } from "react";

import { parseRequestedSkills } from "@phoenix/agent/skills/requestedSkills";
import {
  parsePromptCommands,
  PROMPT_COMMANDS,
} from "@phoenix/agent/slashCommands/promptCommands";
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

  .agent-chat-input__slash-menu-layer {
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
  /** The submitted message with recognized command tokens stripped out. */
  text: string;
  /** Skill names recognized in `text`, for the chat request body. */
  requestedSkills: string[];
  /**
   * Local command names recognized in the submitted message, in order of first
   * appearance. The chat surface executes these before sending `text` (if any
   * text remains).
   */
  commandNames: string[];
};

export type AgentChatInputProps = {
  status: ChatStatus;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (submit: AgentChatInputSubmit) => void;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  modelMenuValue: ModelMenuValue;
  onModelChange: (model: ModelMenuValue) => void;
  isInputDisabled?: boolean;
  isSubmitDisabled?: boolean;
  onStop: () => void;
};

/** Names of the local prompt commands, for the submit-time command parse. */
const availableCommandNames: ReadonlySet<string> = new Set(
  PROMPT_COMMANDS.map((command) => command.name)
);

/**
 * The normal assistant prompt composer.
 *
 * Owns prompt-local affordances that turn user text into chat request metadata:
 * context pills, model/search tools, slash-command skill and command selection,
 * and the requested-skills/command payload. Other chat input modes (consent,
 * elicitation, rewind confirmation) stay in `ChatView` because they replace the
 * composer.
 */
export function AgentChatInput({
  status,
  value,
  onValueChange,
  onSubmit,
  textareaRef,
  modelMenuValue,
  onModelChange,
  isInputDisabled,
  isSubmitDisabled,
  onStop,
}: AgentChatInputProps) {
  const [slashMenuLayer, setSlashMenuLayer] = useState<HTMLDivElement | null>(
    null
  );
  const [availableSkills, setAvailableSkills] = useState<AvailableAgentSkill[]>(
    []
  );

  const handleSubmit = (text: string) => {
    if (isInputDisabled) {
      return;
    }
    // Commands parse first and are stripped; a name that collided with a skill
    // would act as a command. Skills then parse from the stripped text.
    const { commandNames, text: messageText } = parsePromptCommands(
      text,
      availableCommandNames
    );
    const availableSkillNames = new Set(
      availableSkills.map((skill) => skill.name)
    );
    onSubmit({
      text: messageText,
      requestedSkills: parseRequestedSkills(messageText, availableSkillNames),
      commandNames,
    });
  };

  return (
    <div css={agentChatInputCSS}>
      <div className="agent-chat-input__prompt-stack">
        <div
          className="agent-chat-input__slash-menu-layer"
          ref={setSlashMenuLayer}
        />
        <PromptInput
          className="agent-chat-input__prompt-input"
          onSubmit={handleSubmit}
          status={status}
          value={value}
          onValueChange={onValueChange}
          isDisabled={isInputDisabled}
          isSubmitDisabled={isSubmitDisabled}
        >
          <AgentContextPills />
          <PromptInputBody>
            <SkillPromptInputBoundary
              placeholder="Send a message..."
              commands={PROMPT_COMMANDS}
              onSkillsChange={setAvailableSkills}
              textareaRef={textareaRef}
              menuPortalTarget={slashMenuLayer}
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
