import { Suspense, useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";

import type { PromptCommand } from "@phoenix/agent/slashCommands/promptCommands";
import { PromptInputTextarea } from "@phoenix/components/ai/prompt-input";

import { SkillPromptInput } from "./SkillPromptInput";
import {
  useAvailableAgentSkills,
  type AvailableAgentSkill,
} from "./useAvailableAgentSkills";

type SkillPromptInputBoundaryProps = {
  placeholder?: string;
  /**
   * Local prompt commands offered alongside the skills in the slash menu.
   * Forwarded as-is; the parent owns the catalog so it can also run the
   * submit-time command parse.
   */
  commands: PromptCommand[];
  /**
   * Receives the available skills whenever the catalog resolves, so the parent
   * can parse requested skills from the submitted message text. Called with an
   * empty list while loading or if the catalog fails to load.
   */
  onSkillsChange: (skills: AvailableAgentSkill[]) => void;
  /** Forwarded to the underlying textarea so callers can focus it. */
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  /** Optional layer outside the prompt surface where the menu can be stacked. */
  menuPortalTarget?: HTMLElement | null;
};

function SkillPromptInputLoader({
  placeholder,
  commands,
  onSkillsChange,
  textareaRef,
  menuPortalTarget,
}: SkillPromptInputBoundaryProps) {
  const skills = useAvailableAgentSkills();
  // Publish the resolved catalog to the parent for the submit-time parse.
  // Done in an effect (not during render) to avoid mutating parent state mid-render.
  useEffect(() => {
    onSkillsChange(skills);
  }, [skills, onSkillsChange]);
  return (
    <SkillPromptInput
      placeholder={placeholder}
      skills={skills}
      commands={commands}
      textareaRef={textareaRef}
      menuPortalTarget={menuPortalTarget}
    />
  );
}

/**
 * Wraps {@link SkillPromptInput} with the Relay query for available skills.
 *
 * The skill loader is a progressive enhancement: while the catalog is loading
 * or if it fails (e.g. agents disabled, transient error), the input falls back
 * to the plain prompt textarea so the user can always type and send. The
 * recognized-skill highlight and slash menu appear once the catalog resolves.
 */
export function SkillPromptInputBoundary({
  placeholder,
  commands,
  onSkillsChange,
  textareaRef,
  menuPortalTarget,
}: SkillPromptInputBoundaryProps) {
  const fallback = (
    <PromptInputTextarea ref={textareaRef} placeholder={placeholder} />
  );
  return (
    <ErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <SkillPromptInputLoader
          placeholder={placeholder}
          commands={commands}
          onSkillsChange={onSkillsChange}
          textareaRef={textareaRef}
          menuPortalTarget={menuPortalTarget}
        />
      </Suspense>
    </ErrorBoundary>
  );
}
