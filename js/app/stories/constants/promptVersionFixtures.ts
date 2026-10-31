/**
 * Prompt version histories for the prompt version stories, in two shapes:
 * a team that writes a description, tags releases and signs in, and the
 * bare minimum Phoenix accepts — no description, no tags, and no user
 * because authentication is off.
 */

export type PromptVersionFixture = {
  id: string;
  sequenceNumber: number;
  description: string | null;
  createdAt: string;
  user: {
    id: string;
    username: string;
    profilePictureUrl: string | null;
  } | null;
  tags: { id: string; name: string }[];
};

export type PromptVersionHistoryKind = "curated" | "minimal";

export const PROMPT_VERSION_COUNTS = [1, 3, 5, 6, 1000] as const;

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const DESCRIPTIONS = [
  "Fix typo",
  "Initial draft of the support triage prompt",
  "Add few-shot examples for refund requests",
  "Lower temperature to 0.2 to reduce variance between runs",
  "Tighten the system prompt so the model refuses off-topic questions instead of guessing",
  "Switch to the structured output schema and rename {{question}} to {{customer_message}} across every message template",
];

const AVATAR_URL = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14"><rect width="14" height="14" fill="#7c5cff"/><circle cx="7" cy="5.5" r="2.5" fill="#fff"/><path d="M2.5 13a4.5 4.5 0 0 1 9 0" fill="#fff"/></svg>'
)}`;

const USERS = [
  { id: "VXNlcjox", username: "priya", profilePictureUrl: AVATAR_URL },
  { id: "VXNlcjoy", username: "mkowalski", profilePictureUrl: null },
  {
    id: "VXNlcjoz",
    username: "jonathan.okonkwo-hartley",
    profilePictureUrl: null,
  },
];

/** Tags by distance from the newest version */
const TAGS: Record<number, string[]> = {
  0: ["staging", "release-candidate-2026-10"],
  1: ["production"],
  3: ["baseline-before-schema-migration"],
};

/**
 * Versions newest first, the order the prompt's version connection returns
 */
export function makePromptVersionHistory({
  kind,
  count,
  now = Date.now(),
}: {
  kind: PromptVersionHistoryKind;
  count: number;
  now?: number;
}): PromptVersionFixture[] {
  return Array.from({ length: count }, (_, offset) => {
    const sequenceNumber = count - offset;
    const id = btoa(`PromptVersion:${sequenceNumber}`);
    if (kind === "minimal") {
      return {
        id,
        sequenceNumber,
        description: null,
        createdAt: new Date(now - (offset + 1) * MINUTE_MS).toISOString(),
        user: null,
        tags: [],
      };
    }
    return {
      id,
      sequenceNumber,
      description: DESCRIPTIONS[sequenceNumber % DESCRIPTIONS.length],
      createdAt: new Date(now - (offset * 26 + 2) * HOUR_MS).toISOString(),
      user: USERS[offset % USERS.length],
      tags: (TAGS[offset] ?? []).map((name) => ({
        id: btoa(`PromptVersionTag:${name}`),
        name,
      })),
    };
  });
}
