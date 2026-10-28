import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ThemeContext } from "@phoenix/contexts/ThemeContext";

import type { DecisionVersionDetails_definition$data } from "../__generated__/DecisionVersionDetails_definition.graphql";
import { DecisionDefinition } from "../DecisionDefinition";

vi.mock("@phoenix/components/templateEditor", () => ({
  TemplateEditor: ({ defaultValue }: { defaultValue?: string }) => (
    <pre data-testid="template">{defaultValue}</pre>
  ),
  TemplateEditorWrap: ({ children }: { children: React.ReactNode }) => children,
}));

type Definition = DecisionVersionDetails_definition$data;

function definition(
  overrides: Partial<Omit<Definition, " $fragmentType">>
): Definition {
  return {
    inputs: [],
    state: { __typename: "DecisionObjectState", object: true },
    questions: [],
    modelName: "gpt-4o",
    modelProvider: "OPENAI",
    customProvider: null,
    ...overrides,
  } as unknown as Definition;
}

describe("DecisionDefinition", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(value: Definition) {
    await act(async () => {
      root.render(
        <ThemeContext.Provider
          value={{
            theme: "dark",
            themeMode: "dark",
            systemTheme: "dark",
            setThemeMode: vi.fn(),
          }}
        >
          <DecisionDefinition definition={value} />
        </ThemeContext.Provider>
      );
    });
    return container.textContent ?? "";
  }

  it("lists inputs by name and description, and a text state's template with its format", async () => {
    const text = await render(
      definition({
        inputs: [
          {
            name: "question",
            description: "The user's question",
            jsonSchema: null,
          },
          { name: "answer", description: null, jsonSchema: { type: "string" } },
        ],
        state: {
          __typename: "DecisionTextState",
          template: "Q: {{question}}",
          templateFormat: "MUSTACHE",
        },
      })
    );
    expect(text).toContain("question: The user's question");
    expect(text).toContain("answer");
    expect(text).not.toContain("string");
    expect(text).toContain("Mustache");
    expect(
      container.querySelector('[data-testid="template"]')?.textContent
    ).toBe("Q: {{question}}");
  });

  it("explains the object and input states and an empty input list", async () => {
    const objectText = await render(definition({}));
    expect(objectText).toContain("No inputs");
    expect(objectText).toContain("inputs as a JSON object");

    const inputText = await render(
      definition({
        state: { __typename: "DecisionInputState", input: "transcript" },
      })
    );
    expect(inputText).toContain("Input: transcript");
  });

  it("renders each question type with its label, criteria, choices or levels, and skips unknown kinds", async () => {
    const text = await render(
      definition({
        questions: [
          {
            __typename: "DecisionPredicateQuestion",
            name: "grounded",
            instructions: "Is it supported?",
            criteria: { true: "Every claim is supported.", false: null },
          },
          {
            __typename: "DecisionChoiceQuestion",
            name: "tone",
            instructions: "Pick the tone.",
            choices: [{ value: "formal", description: "Reads like docs." }],
          },
          {
            __typename: "DecisionScaleQuestion",
            name: "quality",
            instructions: "",
            levels: [{ label: "1 - Poor", description: null }],
          },
          { __typename: "%other" },
        ],
      })
    );
    const cards = container.querySelectorAll(
      '[data-testid="decision-question"]'
    );
    expect(cards).toHaveLength(3);
    expect(cards[0].textContent).toContain("Yes / No");
    expect(cards[0].textContent).toContain("True: Every claim is supported.");
    expect(cards[0].textContent).not.toContain("False");
    expect(cards[1].textContent).toContain("Choice");
    expect(cards[1].textContent).toContain("formal: Reads like docs.");
    expect(cards[2].textContent).toContain("Scale");
    expect(cards[2].textContent).toContain("1 - Poor");
    expect(text).not.toContain("%other");
  });
});
