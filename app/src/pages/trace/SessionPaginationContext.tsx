import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useState } from "react";
import { useLocation, useNavigate } from "react-router";

/**
 * A sequence of session node IDs used to navigate between sessions.
 */
type SessionSequence = { sessionId: string }[];

type SessionPaginationContextType = {
  sessionSequence: SessionSequence;
  next: (currentId?: string) => void;
  previous: (currentId?: string) => void;
  setSessionSequence: (sessionSequence: SessionSequence) => void;
};

export const SessionPaginationContext =
  createContext<SessionPaginationContextType | null>(null);

export const useSessionPagination = () => {
  return useContext(SessionPaginationContext);
};

/**
 * Get the next and previous sessionIds based on the current sessionId.
 */
export const getNeighbors = (
  sessionSequence: SessionSequence,
  currentId?: string
) => {
  const currentIndex = sessionSequence.findIndex(
    ({ sessionId }) => currentId && sessionId === currentId
  );
  return {
    previousSessionId: sessionSequence[currentIndex - 1]?.sessionId,
    nextSessionId: sessionSequence[currentIndex + 1]?.sessionId,
  };
};

/**
 * Build the next and previous session urls by replacing the last segment of
 * the current pathname (which is the current session node id).
 */
export const makeSessionUrls = (
  location: ReturnType<typeof useLocation>,
  sessionSequence: SessionSequence,
  currentId?: string
) => {
  const { nextSessionId, previousSessionId } = getNeighbors(
    sessionSequence,
    currentId
  );
  const [projects, projectId, resource] = location.pathname
    .split("/")
    .filter((part) => part !== "");
  const makeUrl = (sessionId: string) =>
    `/${projects}/${projectId}/${resource}/${encodeURIComponent(sessionId)}`;
  return {
    nextSessionPath: nextSessionId ? makeUrl(nextSessionId) : null,
    previousSessionPath: previousSessionId ? makeUrl(previousSessionId) : null,
  };
};

export const SessionPaginationProvider = ({ children }: PropsWithChildren) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sessionSequence, setSessionSequence] = useState<SessionSequence>([]);

  const next = useCallback(
    (currentId?: string) => {
      const { nextSessionPath } = makeSessionUrls(
        location,
        sessionSequence,
        currentId
      );
      if (nextSessionPath) {
        navigate(nextSessionPath);
      }
    },
    [navigate, location, sessionSequence]
  );

  const previous = useCallback(
    (currentId?: string) => {
      const { previousSessionPath } = makeSessionUrls(
        location,
        sessionSequence,
        currentId
      );
      if (previousSessionPath) {
        navigate(previousSessionPath);
      }
    },
    [navigate, location, sessionSequence]
  );

  return (
    <SessionPaginationContext.Provider
      value={{
        sessionSequence,
        next,
        previous,
        setSessionSequence,
      }}
    >
      {children}
    </SessionPaginationContext.Provider>
  );
};
