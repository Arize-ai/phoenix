import { Suspense, useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";

import type { AvailableAgentSkill } from "@phoenix/agent/skills/availability";
import { PromptInputTextarea } from "@phoenix/components/ai/prompt-input";

import { SkillPromptInput } from "./SkillPromptInput";
import { useAvailableAgentSkills } from "./useAvailableAgentSkills";

type SkillPromptInputBoundaryProps = {
  placeholder?: string;
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
          onSkillsChange={onSkillsChange}
          textareaRef={textareaRef}
          menuPortalTarget={menuPortalTarget}
        />
      </Suspense>
    </ErrorBoundary>
  );
}
