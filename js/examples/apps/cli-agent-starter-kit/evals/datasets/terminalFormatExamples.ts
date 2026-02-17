import type { Example } from "@arizeai/phoenix-client/types/datasets";

export const terminalFormatExamples: Example[] = [
  // Compliant examples (5)
  {
    input: { prompt: "How do I install Phoenix?" },
    output: {
      response:
        "Install Phoenix using npm: npm install @arizeai/phoenix-client. Then import it in your TypeScript project.",
    },
    metadata: {
      expectedSafe: true,
      category: "compliant",
      description: "Plain text with code-like words (no backticks)",
    },
  },
  {
    input: { prompt: "What is tracing?" },
    output: {
      response:
        "Tracing is the process of capturing execution data from your application. Phoenix uses OpenTelemetry to track spans, which represent units of work.",
    },
    metadata: {
      expectedSafe: true,
      category: "compliant",
      description: "Technical explanation without formatting",
    },
  },
  {
    input: { prompt: "How do evaluations work?" },
    output: {
      response:
        "Evaluations assess the quality of your AI outputs. You can create custom evaluators using createEvaluator or use pre-built evaluators like correctness and faithfulness.",
    },
    metadata: {
      expectedSafe: true,
      category: "compliant",
      description: "Function names mentioned as plain text",
    },
  },
  {
    input: { prompt: "What are datasets?" },
    output: {
      response:
        "Datasets are collections of examples used for evaluation. Each example has an input, optional expected output, and metadata.",
    },
    metadata: {
      expectedSafe: true,
      category: "compliant",
      description: "Simple definition",
    },
  },
  {
    input: { prompt: "Where do I view results?" },
    output: {
      response:
        "View experiment results in the Phoenix UI at http://localhost:6006. Navigate to the Datasets section to see your experiments.",
    },
    metadata: {
      expectedSafe: true,
      category: "compliant",
      description: "URL without markdown link syntax",
    },
  },

  // Bold violations (3)
  {
    input: { prompt: "What is Phoenix?" },
    output: {
      response:
        "Phoenix is an **AI observability platform** that helps you trace and evaluate LLM applications.",
    },
    metadata: {
      expectedSafe: false,
      category: "markdown-bold",
      description: "Contains bold markdown syntax",
    },
  },
  {
    input: { prompt: "Key features?" },
    output: {
      response:
        "Phoenix offers **tracing**, **evaluation**, and **experimentation** capabilities for AI applications.",
    },
    metadata: {
      expectedSafe: false,
      category: "markdown-bold-multiple",
      description: "Multiple bold markdown occurrences",
    },
  },
  {
    input: { prompt: "What's important?" },
    output: {
      response:
        "The __most important__ thing is to instrument your code properly.",
    },
    metadata: {
      expectedSafe: false,
      category: "markdown-bold-underscore",
      description: "Bold with underscore syntax",
    },
  },

  // Code block violations (3)
  {
    input: { prompt: "Show me example code" },
    output: {
      response:
        "Here's how to trace:\n```typescript\nimport { register } from '@arizeai/phoenix-otel';\nregister({ projectName: 'my-app' });\n```",
    },
    metadata: {
      expectedSafe: false,
      category: "markdown-code-block",
      description: "Contains code block with triple backticks",
    },
  },
  {
    input: { prompt: "How to import?" },
    output: {
      response:
        "Import using `import { createClient } from '@arizeai/phoenix-client'` in your file.",
    },
    metadata: {
      expectedSafe: false,
      category: "markdown-inline-code",
      description: "Contains inline code with backticks",
    },
  },
  {
    input: { prompt: "What's the command?" },
    output: {
      response: "Run `npm install` to install dependencies.",
    },
    metadata: {
      expectedSafe: false,
      category: "markdown-inline-code-command",
      description: "Command wrapped in backticks",
    },
  },

  // Link violations (2)
  {
    input: { prompt: "Where is the documentation?" },
    output: {
      response:
        "You can find the documentation at [Phoenix Docs](https://arize.com/docs/phoenix).",
    },
    metadata: {
      expectedSafe: false,
      category: "markdown-link",
      description: "Contains markdown link syntax",
    },
  },
  {
    input: { prompt: "More info?" },
    output: {
      response:
        "See the [tracing guide](https://arize.com/docs/phoenix/tracing) and [evaluation docs](https://arize.com/docs/phoenix/evaluation) for details.",
    },
    metadata: {
      expectedSafe: false,
      category: "markdown-link-multiple",
      description: "Multiple markdown links",
    },
  },

  // Heading violations (1)
  {
    input: { prompt: "Tell me about features" },
    output: {
      response:
        "# Phoenix Features\n\nPhoenix offers tracing, evaluation, and experimentation.",
    },
    metadata: {
      expectedSafe: false,
      category: "markdown-heading",
      description: "Contains markdown heading",
    },
  },

  // Edge cases (2)
  {
    input: { prompt: "What about regex patterns?" },
    output: {
      response:
        "The pattern looks like /\\*\\*[^*]+\\*\\*/ which matches bold text in markdown.",
    },
    metadata: {
      expectedSafe: true,
      category: "edge-case-regex",
      description: "Escaped markdown in regex (should be safe)",
    },
  },
  {
    input: { prompt: "Explain syntax" },
    output: {
      response:
        "In markdown, you write bold as two asterisks before and after text. We avoid this in terminal output.",
    },
    metadata: {
      expectedSafe: true,
      category: "edge-case-explanation",
      description: "Talking about markdown without using it",
    },
  },
];

// Full dataset with splits for filtering
export const terminalFormatDataset = {
  name: "cli-agent-terminal-format",
  description: "Terminal-safe formatting evaluation dataset with splits",
  examples: terminalFormatExamples.map((example) => ({
    ...example,
    splits: example.metadata?.category
      ? [example.metadata.category as string]
      : [],
  })),
};
