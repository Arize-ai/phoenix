import { css, keyframes } from "@emotion/react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Navigate } from "react-router";

import { Icon, Icons, Loading } from "@phoenix/components";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import { DRAFT_SESSION_ID } from "@phoenix/store/agentStore";

import type { HomePageRecentConversationsQuery } from "./__generated__/HomePageRecentConversationsQuery.graphql";

const PxiShaderGlyph = lazy(() =>
  import("@phoenix/components/agent/PxiShaderGlyph").then((module) => ({
    default: module.PxiShaderGlyph,
  }))
);

const SUGGESTIONS = [
  { icon: <Icons.Bulb />, label: "How do I use Phoenix?" },
  { icon: <Icons.Book />, label: "Explain a Phoenix concept to me." },
  { icon: <Icons.Trace />, label: "Find critical issues in my traces." },
];

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const homePageCSS = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: var(--global-dimension-size-300);
  animation: ${fadeIn} 400ms ease-out;

  .homePage__title {
    font-size: 28px;
    font-weight: 600;
    color: var(--global-text-color-900);
  }

  .homePage__subtitle {
    color: #6b7280;
    margin-top: -12px;
  }

  .home-page-input {
    position: relative;
    width: 640px;
    background: var(--prompt-input-background-color);
    border: 1px solid var(--global-border-color-default);
    border-radius: 12px;
    padding: 14px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);

    textarea {
      width: 100%;
      min-height: 72px;
      resize: none;
      border: none;
      outline: none;
      background: transparent;
      font-family: inherit;
      font-size: 14px;
      color: var(--global-text-color-900);
    }
  }

  .home-page-input__send {
    position: absolute;
    right: 12px;
    bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--global-color-gray-900);
    color: var(--global-color-gray-50);
    cursor: pointer;

    &[aria-disabled="true"] {
      opacity: 0.4;
      cursor: default;
    }
  }

  .homePage__suggestions {
    width: 640px;

    h3 {
      font-size: 12px;
      font-weight: 500;
      color: #6b7280;
      margin: 0 0 8px;
    }
  }

  .homePage__recent {
    width: 640px;

    h3 {
      font-size: 12px;
      font-weight: 500;
      color: #6b7280;
      margin: 0 0 8px;
    }

    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
  }

  .homePage__recent-item {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--global-text-color-700);
    font-family: inherit;
    font-size: 14px;
    text-align: left;
    cursor: pointer;

    &:hover,
    &[data-active="true"] {
      background: var(--global-color-gray-100);
    }
  }

  .homePage__recent-time {
    color: #6b7280;
    font-size: 12px;
  }

  .homePage__suggestion {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 8px;
    color: var(--global-text-color-700);
    text-decoration: none;

    &:hover {
      background: var(--global-color-gray-100);
    }
  }
`;

export function HomePage() {
  const assistantEnabled = useAgentContext(
    (state) => state.agentsConfig.assistantEnabled
  );

  if (!assistantEnabled) {
    return <Navigate to="/projects" replace />;
  }

  return (
    <Suspense
      fallback={
        <div
          css={css`
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
          `}
        >
          <Loading />
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}

function HomePageContent() {
  const store = useAgentStore();
  const { setIsOpen, activeSessionId } = useAgentContext((state) => ({
    setIsOpen: state.setIsOpen,
    activeSessionId: state.activeSessionId,
  }));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [canSubmit, setCanSubmit] = useState(false);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const submit = (text: string) => {
    if (text.length === 0) {
      return;
    }
    const state = store.getState();
    state.setActiveSession(DRAFT_SESSION_ID);
    state.setPendingMessage(DRAFT_SESSION_ID, { text, requestedSkills: [] });
    setIsOpen(true);
    setValue("");
    setCanSubmit(false);
  };

  // Opens a previous conversation. Anything already typed is sent there.
  const openConversation = (sessionId: string) => {
    const state = store.getState();
    state.setActiveSession(sessionId);
    if (value.length > 0) {
      state.setPendingMessage(sessionId, { text: value, requestedSkills: [] });
      setValue("");
      setCanSubmit(false);
    }
    setIsOpen(true);
  };

  return (
    <div css={homePageCSS} className="homePage">
      <PxiShaderGlyph size={160} />
      <div className="homePage__title">What can I help you with?</div>
      <div className="homePage__subtitle">
        Ask PXI about your traces, experiments, datasets, and prompts.
      </div>
      <div className="home-page-input">
        <textarea
          ref={textareaRef}
          value={value}
          placeholder="Ask PXI anything..."
          onChange={(event) => {
            setValue(event.target.value);
            setCanSubmit(event.target.value.length > 0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit(value);
            }
          }}
        />
        <div
          role="button"
          aria-label="Send"
          aria-disabled={!canSubmit}
          className="home-page-input__send"
          onClick={() => submit(value)}
        >
          <Icon svg={<Icons.ArrowUp />} />
        </div>
      </div>
      <div className="homePage__suggestions">
        <h3>Try asking</h3>
        {SUGGESTIONS.map((suggestion) => (
          <a
            key={suggestion.label}
            href="#"
            className="homePage__suggestion"
            onClick={(event) => {
              event.preventDefault();
              submit(suggestion.label);
            }}
          >
            <Icon svg={suggestion.icon} />
            {suggestion.label}
          </a>
        ))}
      </div>
      <RecentConversations
        activeSessionId={activeSessionId}
        onSelect={openConversation}
      />
    </div>
  );
}

function RecentConversations({
  activeSessionId,
  onSelect,
}: {
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
}) {
  const data = useLazyLoadQuery<HomePageRecentConversationsQuery>(
    graphql`
      query HomePageRecentConversationsQuery {
        agentSessions(first: 5, viewerOnly: true) {
          edges {
            node {
              id
              title
              updatedAt
            }
          }
        }
      }
    `,
    {},
    { fetchPolicy: "network-only" }
  );
  const sessions = data.agentSessions.edges.map(({ node }) => node);

  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="homePage__recent">
      <h3>Recent conversations</h3>
      <ul>
        {sessions.map((session) => (
          <li key={session.id}>
            <button
              type="button"
              className="homePage__recent-item"
              data-active={session.id === activeSessionId}
              onClick={() => onSelect(session.id)}
            >
              <span>{session.title || "Untitled"}</span>
              <span className="homePage__recent-time">
                {formatRelativeTime(session.updatedAt as string)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatRelativeTime(timestamp: string) {
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minutes = Math.round((Date.parse(timestamp) - Date.now()) / 60000);
  if (Math.abs(minutes) < 60) {
    return formatter.format(minutes, "minute");
  }
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return formatter.format(hours, "hour");
  }
  return formatter.format(Math.round(hours / 24), "day");
}
