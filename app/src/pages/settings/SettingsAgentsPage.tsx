import { Controller, useForm } from "react-hook-form";

import { getAgentSystemPromptLines } from "@phoenix/agent/chat/systemPrompt";
import { Card, Label, TextArea, TextField } from "@phoenix/components";
import { AgentModelMenu } from "@phoenix/components/agent/AgentModelMenu";
import { fieldBaseCSS } from "@phoenix/components/core/field/styles";

export function SettingsAgentsPage() {
  return <AssistantCard />;
}

function AssistantCard() {
  const { control } = useForm({
    defaultValues: {
      systemPrompt: getAgentSystemPromptLines().join(),
    },
  });
  return (
    <Card title="Assistant" collapsible>
      <div css={fieldBaseCSS}>
        <Label>Agent Model</Label>
        <AgentModelMenu />
      </div>
      <Controller
        name="systemPrompt"
        control={control}
        render={({ field }) => (
          <TextField {...field} value={field.value ?? undefined}>
            <Label>System Prompt</Label>
            <TextArea
              rows={2}
              placeholder="The system instructions to the assistant"
            />
          </TextField>
        )}
      />
    </Card>
  );
}
