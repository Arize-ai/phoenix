import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Icon, Icons } from "@phoenix/components";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageContent,
  MessageResponse,
  MessageToolbar,
} from "@phoenix/components/ai/message";

const containerCSS = css`
  width: 700px;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
`;

const meta = {
  title: "AI/Message",
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleMarkdown = `## React Hooks Guide

React hooks are functions that let you "hook into" React state and lifecycle features from function components.

### useState
Adds state to functional components:

\`\`\`jsx
const [count, setCount] = useState(0);

return (
  <button onClick={() => setCount(count + 1)}>
    Count: {count}
  </button>
);
\`\`\`

### When to Use Hooks

- **Function components** — hooks only work in function components
- **Replacing class components** — modern React favors hooks over classes
- **Sharing stateful logic** — create custom hooks to reuse logic`;

/**
 * A simple user message followed by an assistant markdown response.
 */
export const Default: Story = {
  render: () => (
    <div css={containerCSS}>
      <Message from="user">
        <MessageContent>How do React hooks work?</MessageContent>
      </Message>
      <Message from="assistant">
        <MessageContent>
          <MessageResponse>{sampleMarkdown}</MessageResponse>
        </MessageContent>
      </Message>
    </div>
  ),
};

/**
 * Assistant message with copy, retry, like/dislike action buttons in a toolbar.
 */
function WithActionsRender() {
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);

  return (
    <div css={containerCSS}>
      <Message from="user">
        <MessageContent>Explain closures in JavaScript.</MessageContent>
      </Message>
      <Message from="assistant">
        <MessageContent>
          <MessageResponse>
            {`A **closure** is a function that has access to variables from its outer (enclosing) scope, even after the outer function has returned.

\`\`\`js
function makeCounter() {
  let count = 0;
  return () => ++count;
}

const counter = makeCounter();
counter(); // 1
counter(); // 2
\`\`\`

The inner function "closes over" the \`count\` variable, keeping it alive across calls.`}
          </MessageResponse>
        </MessageContent>
        <MessageToolbar>
          <MessageActions>
            <MessageAction
              label="Regenerate"
              tooltip="Regenerate response"
              onPress={() => {}}
            >
              <Icon svg={<Icons.Refresh />} />
            </MessageAction>
            <MessageAction
              label="Like"
              tooltip="Like this response"
              onPress={() => setLiked((v) => !v)}
            >
              <Icon
                svg={<Icons.ThumbsUpOutline />}
                color={liked ? "blue-700" : "inherit"}
              />
            </MessageAction>
            <MessageAction
              label="Dislike"
              tooltip="Dislike this response"
              onPress={() => setDisliked((v) => !v)}
            >
              <Icon
                svg={<Icons.ThumbsDownOutline />}
                color={disliked ? "red-700" : "inherit"}
              />
            </MessageAction>
            <MessageAction
              label="Copy"
              tooltip="Copy to clipboard"
              onPress={() => {}}
            >
              <Icon svg={<Icons.DuplicateOutline />} />
            </MessageAction>
          </MessageActions>
        </MessageToolbar>
      </Message>
    </div>
  );
}

export const WithActions: Story = {
  render: () => <WithActionsRender />,
};

const branchVersions = [
  `## Version 1: Detailed

React hooks are functions that let you "hook into" React state and lifecycle features from function components. Here's what you need to know:

### Core Hooks

- **useState** — adds state to functional components
- **useEffect** — handles side effects like data fetching
- **useContext** — consumes context values

Would you like to explore more advanced hooks like \`useReducer\` or \`useMemo\`?`,

  `## Version 2: Concise

React hooks are special functions for using React features in function components. The most common ones:

- \`useState\` — manage component state
- \`useEffect\` — side effects (data fetching, subscriptions)
- \`useRef\` — access DOM elements

Which specific hook would you like to learn more about?`,

  `## Version 3: With Table

Hooks solve several problems: simpler code, reusable logic, better organization.

| Hook | Purpose |
|------|---------|
| useState | Add state to components |
| useEffect | Handle side effects |
| useContext | Access context values |
| useReducer | Complex state logic |

The beauty of hooks is that they let you reuse stateful logic without changing your component hierarchy.`,
];

/**
 * Assistant message with multiple response versions and branch navigation.
 */
export const WithBranching: Story = {
  render: () => (
    <div css={containerCSS}>
      <Message from="user">
        <MessageContent>How do React hooks work?</MessageContent>
      </Message>
      <Message from="assistant">
        <MessageBranch defaultBranch={0}>
          <MessageBranchContent>
            {branchVersions.map((content, i) => (
              <MessageContent key={i}>
                <MessageResponse>{content}</MessageResponse>
              </MessageContent>
            ))}
          </MessageBranchContent>
          <MessageToolbar>
            <MessageBranchSelector>
              <MessageBranchPrevious />
              <MessageBranchPage />
              <MessageBranchNext />
            </MessageBranchSelector>
            <MessageActions>
              <MessageAction
                label="Regenerate"
                tooltip="Regenerate response"
                onPress={() => {}}
              >
                <Icon svg={<Icons.Refresh />} />
              </MessageAction>
              <MessageAction
                label="Copy"
                tooltip="Copy to clipboard"
                onPress={() => {}}
              >
                <Icon svg={<Icons.DuplicateOutline />} />
              </MessageAction>
            </MessageActions>
          </MessageToolbar>
        </MessageBranch>
      </Message>
    </div>
  ),
};

const streamingParts = [
  "## Streaming",
  "## Streaming Demo\n\nThis content",
  "## Streaming Demo\n\nThis content is being **streamed** incrementally.",
  "## Streaming Demo\n\nThis content is being **streamed** incrementally.\n\n```js\nconst greeting = 'Hello, world!';\nconsole.log(greeting);\n```",
  "## Streaming Demo\n\nThis content is being **streamed** incrementally.\n\n```js\nconst greeting = 'Hello, world!';\nconsole.log(greeting);\n```\n\nStreaming complete!",
];

/**
 * Assistant message being streamed with incremental content.
 */
function StreamingRender() {
  const [partIndex, setPartIndex] = useState(0);

  const advance = () => {
    setPartIndex((prev) => (prev < streamingParts.length - 1 ? prev + 1 : 0));
  };

  return (
    <div css={containerCSS}>
      <Message from="user">
        <MessageContent>Show me a streaming response.</MessageContent>
      </Message>
      <Message from="assistant">
        <MessageContent>
          <MessageResponse
            renderMode={
              partIndex < streamingParts.length - 1 ? "streaming" : "static"
            }
          >
            {streamingParts[partIndex]}
          </MessageResponse>
        </MessageContent>
      </Message>
      <button onClick={advance} type="button">
        {partIndex < streamingParts.length - 1
          ? "Advance stream"
          : "Reset stream"}
      </button>
    </div>
  );
}

export const Streaming: Story = {
  render: () => <StreamingRender />,
};

/**
 * Full chat layout with user messages, assistant responses with branching,
 * actions, and markdown — all features combined.
 */
function GalleryRender() {
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  const toggleLike = (key: string) => {
    setLiked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div css={containerCSS}>
      {/* Simple user message */}
      <Message from="user">
        <MessageContent>What is TypeScript?</MessageContent>
      </Message>

      {/* Simple assistant response with actions */}
      <Message from="assistant">
        <MessageContent>
          <MessageResponse>
            {`**TypeScript** is a statically typed superset of JavaScript that compiles to plain JavaScript. It adds optional type annotations, interfaces, and other features that help catch errors at compile time.

\`\`\`ts
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\``}
          </MessageResponse>
        </MessageContent>
        <MessageToolbar>
          <MessageActions>
            <MessageAction
              label="Like"
              tooltip="Like"
              onPress={() => toggleLike("msg-1")}
            >
              <Icon
                svg={<Icons.ThumbsUpOutline />}
                color={liked["msg-1"] ? "blue-700" : "inherit"}
              />
            </MessageAction>
            <MessageAction label="Copy" tooltip="Copy" onPress={() => {}}>
              <Icon svg={<Icons.DuplicateOutline />} />
            </MessageAction>
          </MessageActions>
        </MessageToolbar>
      </Message>

      {/* Follow-up user message */}
      <Message from="user">
        <MessageContent>How does it compare to JavaScript?</MessageContent>
      </Message>

      {/* Branched assistant response */}
      <Message from="assistant">
        <MessageBranch defaultBranch={0}>
          <MessageBranchContent>
            <MessageContent key="v1">
              <MessageResponse>
                {`The key differences are:

1. **Type safety** — TypeScript catches type errors at compile time
2. **IDE support** — better autocomplete and refactoring
3. **Interfaces** — define contracts for object shapes
4. **Enums** — first-class support for enumerated values`}
              </MessageResponse>
            </MessageContent>
            <MessageContent key="v2">
              <MessageResponse>
                {`| Feature | JavaScript | TypeScript |
|---------|-----------|------------|
| Types | Dynamic | Static |
| Compilation | Interpreted | Compiled to JS |
| IDE Support | Basic | Advanced |
| Learning Curve | Lower | Higher |

TypeScript is essentially JavaScript with guardrails.`}
              </MessageResponse>
            </MessageContent>
          </MessageBranchContent>
          <MessageToolbar>
            <MessageBranchSelector>
              <MessageBranchPrevious />
              <MessageBranchPage />
              <MessageBranchNext />
            </MessageBranchSelector>
            <MessageActions>
              <MessageAction
                label="Regenerate"
                tooltip="Regenerate"
                onPress={() => {}}
              >
                <Icon svg={<Icons.Refresh />} />
              </MessageAction>
              <MessageAction
                label="Like"
                tooltip="Like"
                onPress={() => toggleLike("msg-2")}
              >
                <Icon
                  svg={<Icons.ThumbsUpOutline />}
                  color={liked["msg-2"] ? "blue-700" : "inherit"}
                />
              </MessageAction>
              <MessageAction label="Copy" tooltip="Copy" onPress={() => {}}>
                <Icon svg={<Icons.DuplicateOutline />} />
              </MessageAction>
            </MessageActions>
          </MessageToolbar>
        </MessageBranch>
      </Message>
    </div>
  );
}

export const Gallery: Story = {
  render: () => <GalleryRender />,
};
