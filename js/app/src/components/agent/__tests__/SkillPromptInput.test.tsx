import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { userEvent } from "storybook/test";

import { PromptInput } from "@phoenix/components/ai/prompt-input";

import { SkillPromptInput } from "../SkillPromptInput";

const skills = [
  {
    name: "debug-trace",
    summary: "Debug a trace",
    description: "Debug a trace",
  },
];

describe("SkillPromptInput prompt history", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const renderInput = (promptHistory: string[]) => {
    act(() => {
      root.render(
        <PromptInput>
          <SkillPromptInput
            skills={skills}
            commands={[]}
            promptHistory={promptHistory}
          />
        </PromptInput>
      );
    });
    const textarea = container.querySelector("textarea");
    if (!textarea) throw new Error("textarea not rendered");
    textarea.focus();
    return textarea;
  };

  it("cycles through history and back to an empty input", async () => {
    const user = userEvent.setup();
    const textarea = renderInput(["newest", "oldest"]);

    await user.keyboard("{ArrowUp}");
    expect(textarea.value).toBe("newest");
    await user.keyboard("{ArrowUp}");
    expect(textarea.value).toBe("oldest");
    // Already at the oldest entry: stays put.
    await user.keyboard("{ArrowUp}");
    expect(textarea.value).toBe("oldest");
    await user.keyboard("{ArrowDown}");
    expect(textarea.value).toBe("newest");
    await user.keyboard("{ArrowDown}");
    expect(textarea.value).toBe("");
  });

  it("leaves a typed draft alone", async () => {
    const user = userEvent.setup();
    const textarea = renderInput(["newest"]);

    await user.type(textarea, "draft");
    await user.keyboard("{ArrowUp}");
    expect(textarea.value).toBe("draft");
  });

  it("does not open the slash menu for a recalled skill token", async () => {
    const user = userEvent.setup();
    const textarea = renderInput(["/debug-trace", "older"]);

    await user.keyboard("{ArrowUp}");
    expect(textarea.value).toBe("/debug-trace");
    expect(textarea.getAttribute("aria-expanded")).toBe("false");
    await user.keyboard("{ArrowUp}");
    expect(textarea.value).toBe("older");
  });
});
