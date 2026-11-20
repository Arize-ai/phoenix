import { describe, expect, it, vi } from "vitest";

import {
  createOpenProjectEvaluatorGalleryItemClientAction,
  createReadProjectEvaluatorGalleryClientAction,
  type ProjectEvaluatorGalleryHost,
  type ProjectEvaluatorGalleryListing,
} from "..";

const LISTING: ProjectEvaluatorGalleryListing = {
  templates: [
    {
      name: "hallucination",
      kind: "LLM",
      category: "Grounding & retrieval",
      description: "Detect claims not supported by the input.",
      targetType: "SPAN",
      filterCondition: "span_kind == 'LLM'",
      inputs: [
        { name: "input", description: null, defaultPath: null },
        { name: "output", description: null, defaultPath: null },
      ],
      labels: [
        { label: "hallucinated", score: 1 },
        { label: "grounded", score: 0 },
      ],
      optimizationDirection: "MINIMIZE",
      details: "Use on LLM spans.",
      promptMessages: [{ role: "user", content: "{{input}} {{output}}" }],
    },
  ],
  customEvaluators: [
    {
      evaluatorId: "Q29kZUV2YWx1YXRvcjo4",
      name: "no_sql_in_output",
      kind: "CODE",
      description: null,
      opensAs: "attach",
    },
  ],
};

const CONTEXT = { callId: "tool-call-1:1", sessionId: "session-1" };

function createHost() {
  const openItem = vi.fn(() => "/projects/p/evaluators/new/template/x");
  const host: ProjectEvaluatorGalleryHost = {
    loadListing: async () => LISTING,
    openItem,
  };
  return { host, openItem };
}

describe("evaluators.project.gallery.read", () => {
  it("lists the cards without the details pane's text and prompt", async () => {
    const { host } = createHost();
    const read = createReadProjectEvaluatorGalleryClientAction({
      getHost: () => host,
    });
    const result = await read({});
    expect(result).toMatchObject({ ok: true });
    const output = result.ok ? (result.output as Record<string, unknown>) : {};
    expect(output.customEvaluators).toEqual(LISTING.customEvaluators);
    const [card] = output.templates as Record<string, unknown>[];
    expect(card).toMatchObject({
      name: "hallucination",
      targetType: "SPAN",
      filterCondition: "span_kind == 'LLM'",
    });
    expect(card).not.toHaveProperty("promptMessages");
    expect(card).not.toHaveProperty("details");
  });

  it("reads one template's details, prompt included", async () => {
    const { host } = createHost();
    const read = createReadProjectEvaluatorGalleryClientAction({
      getHost: () => host,
    });
    const result = await read({ templateName: "hallucination" });
    expect(result).toEqual({
      ok: true,
      output: { template: LISTING.templates[0] },
    });
  });

  it("names the templates when asked for one it does not have", async () => {
    const { host } = createHost();
    const read = createReadProjectEvaluatorGalleryClientAction({
      getHost: () => host,
    });
    const result = await read({ templateName: "faithfulness" });
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.error).toContain(
      "Its templates are: hallucination."
    );
  });

  it("reports a gallery that fails to load", async () => {
    const read = createReadProjectEvaluatorGalleryClientAction({
      getHost: () => ({
        loadListing: () => Promise.reject(new Error("Failed to fetch")),
        openItem: vi.fn(),
      }),
    });
    const result = await read({});
    expect(result).toEqual({
      ok: false,
      error: "The evaluator gallery could not be loaded: Failed to fetch",
    });
  });
});

describe("evaluators.project.gallery.open", () => {
  const createOpen = (host: ProjectEvaluatorGalleryHost, autoAccept = true) =>
    createOpenProjectEvaluatorGalleryItemClientAction({
      getHost: () => host,
      shouldAutoAccept: () => autoAccept,
    });

  it("opens a template's form and names the operations that take over", async () => {
    const { host, openItem } = createHost();
    const result = await createOpen(host)(
      { templateName: "hallucination" },
      CONTEXT
    );
    expect(openItem).toHaveBeenCalledWith({
      kind: "template",
      template: LISTING.templates[0],
    });
    expect(result).toMatchObject({
      ok: true,
      output: {
        status: "opened",
        path: "/projects/p/evaluators/new/template/x",
      },
    });
    const next = result.ok
      ? (result.output as { next: string }).next
      : undefined;
    expect(next).toContain("evaluators.llm.submit");
    expect(next).toContain("evaluators.project.bench.run");
  });

  it("opens a custom code evaluator's attach form", async () => {
    const { host, openItem } = createHost();
    const result = await createOpen(host)(
      { evaluatorId: "Q29kZUV2YWx1YXRvcjo4" },
      CONTEXT
    );
    expect(openItem).toHaveBeenCalledWith({
      kind: "custom",
      evaluator: LISTING.customEvaluators[0],
    });
    const next = result.ok
      ? (result.output as { next: string }).next
      : undefined;
    expect(next).toContain("evaluators.project.attach.submit");
  });

  it("refuses an item the gallery does not offer without navigating", async () => {
    const { host, openItem } = createHost();
    const result = await createOpen(host)(
      { templateName: "faithfulness" },
      CONTEXT
    );
    expect(result).toMatchObject({ ok: false });
    expect(openItem).not.toHaveBeenCalled();
  });

  it("needs exactly one of templateName and evaluatorId", async () => {
    const { host, openItem } = createHost();
    const result = await createOpen(host)(
      { templateName: "hallucination", evaluatorId: "Q29kZUV2YWx1YXRvcjo4" },
      CONTEXT
    );
    expect(result).toEqual({
      ok: false,
      error: "Pass exactly one of templateName or evaluatorId.",
    });
    expect(openItem).not.toHaveBeenCalled();
  });

  it("does not navigate without an approved script", async () => {
    const { host, openItem } = createHost();
    const result = await createOpen(host, false)(
      { templateName: "hallucination" },
      CONTEXT
    );
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.error).toContain("write_description");
    expect(openItem).not.toHaveBeenCalled();
  });
});
