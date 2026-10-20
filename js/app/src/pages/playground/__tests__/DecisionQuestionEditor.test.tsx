import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { userEvent } from "storybook/test";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { DecisionQuestionEditor } from "../DecisionQuestionEditor";
import { createDecisionQuestion, createScoreLevel } from "../decisionUtils";

vi.mock("@phoenix/components/templateEditor", () => ({
  TemplateEditor: () => null,
  TemplateEditorWrap: ({ children }: { children: React.ReactNode }) => children,
  TemplateInput: ({
    "aria-label": ariaLabel,
    defaultValue,
    onChange,
  }: {
    "aria-label": string;
    defaultValue?: string;
    onChange: (value: string) => void;
  }) => (
    <input
      aria-label={ariaLabel}
      defaultValue={defaultValue}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

describe("DecisionQuestionEditor scale levels", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const question = createDecisionQuestion({
    type: "score",
    name: "severity",
    instructions: "How severe?",
    levels: [
      createScoreLevel({ label: "low", description: "Cosmetic" }),
      createScoreLevel({ label: "high", description: "Blocks the user" }),
    ],
  });
  const render = (onChange: (patch: unknown) => void) =>
    act(() =>
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <DecisionQuestionEditor
            question={question}
            index={0}
            errors={undefined}
            isDisabled={false}
            canRemove
            templateFormat={TemplateFormats.Mustache}
            onTouch={vi.fn()}
            onChange={onChange}
            onRemove={vi.fn()}
          />
        </ThemeProvider>
      )
    );
  const field = (label: string) =>
    container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;

  it("shows each level's label and rubric", () => {
    render(vi.fn());
    expect(field("Level 0 label").value).toBe("low");
    expect(field("Level 0 description").value).toBe("Cosmetic");
    expect(field("Level 1 description").value).toBe("Blocks the user");
  });

  it("edits a label without touching the rubric, and the reverse", async () => {
    const onChange = vi.fn();
    render(onChange);
    const user = userEvent.setup();
    await act(async () => {
      await user.type(field("Level 0 label"), "!");
    });
    const [labelPatch] = onChange.mock.calls.at(-1)!;
    expect(labelPatch.levels[0]).toMatchObject({
      label: "low!",
      description: "Cosmetic",
    });
    await act(async () => {
      await user.type(field("Level 1 description"), "!");
    });
    const [descriptionPatch] = onChange.mock.calls.at(-1)!;
    expect(descriptionPatch.levels[1]).toMatchObject({
      label: "high",
      description: "Blocks the user!",
    });
  });
});
