import { describe, expect, it } from "vitest";

import {
  isTeam,
  orgMemberFlag,
  tallyReactions,
  verdict,
  type Entry,
} from "./triage.ts";
import type { GhUser } from "./types.ts";

const NOW = Date.now();
const day = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const user = (login: string, type = "User"): GhUser => ({ login, type });

function entry(p: Partial<Entry> & { user: GhUser | null }): Entry {
  return {
    kind: "comment",
    login: p.user?.login ?? null,
    created_at: day(1),
    url: "https://x/y#c",
    body: "",
    ...p,
  };
}

const team = () => new Set(["maintainer"]);

describe("verdict", () => {
  it("flags an outside comment with no team response", () => {
    const v = verdict(
      [entry({ user: user("outsider"), kind: "body", created_at: day(3) })],
      team()
    );
    expect(v.needs).toBe(true);
    expect(v.reason).toBe("Opened, no team response");
  });

  it("clears when a team member spoke last", () => {
    const v = verdict(
      [
        entry({ user: user("outsider"), kind: "body", created_at: day(3) }),
        entry({ user: user("maintainer"), created_at: day(2) }),
      ],
      team()
    );
    expect(v.needs).toBe(false);
    expect(v.lastIsTeam).toBe(1);
  });

  it("does not clear when a team member reacted to the last outside comment", () => {
    const v = verdict(
      [
        entry({
          user: user("outsider"),
          kind: "body",
        }),
      ],
      team()
    );
    expect(v.needs).toBe(true);
    expect(v.reason).toBe("Opened, no team response");
  });

  it("ignores bots when deciding who spoke last", () => {
    const v = verdict(
      [
        entry({ user: user("outsider"), kind: "body", created_at: day(4) }),
        entry({ user: user("ci[bot]", "Bot"), created_at: day(1) }),
      ],
      team()
    );
    expect(v.needs).toBe(true);
    expect(v.display.login).toBe("outsider"); // the bot isn't the displayed actor
  });

  it("uses time order, not array order, for the last human entry", () => {
    const v = verdict(
      [
        entry({ user: user("maintainer"), created_at: day(1) }), // newest, listed first
        entry({ user: user("outsider"), kind: "body", created_at: day(5) }),
      ],
      team()
    );
    expect(v.needs).toBe(false); // maintainer is genuinely newest → handled
  });

  it("treats a thread with only bot activity as not-needing", () => {
    const v = verdict(
      [entry({ user: user("dependabot[bot]", "Bot"), kind: "body" })],
      team()
    );
    expect(v.needs).toBe(false);
    expect(v.reason).toBe("Only bot activity");
  });

  it("distinguishes 'opened' from 'awaiting reply'", () => {
    const opened = verdict(
      [entry({ user: user("outsider"), kind: "body" })],
      team()
    );
    expect(opened.reason).toBe("Opened, no team response");

    const replied = verdict(
      [
        entry({ user: user("maintainer"), kind: "body", created_at: day(5) }),
        entry({ user: user("outsider"), created_at: day(2) }),
      ],
      team()
    );
    expect(replied.needs).toBe(true);
    expect(replied.reason).toBe("Awaiting reply");
  });
});

describe("orgMemberFlag", () => {
  // Stub the injected membership check so tests never touch network/DB.
  const orgMembers = new Set(["colleague"]);
  const stubOrg = (login: string) =>
    Promise.resolve(orgMembers.has(login.toLowerCase()));

  it("flags an outside org member who isn't on the team", async () => {
    const v = verdict(
      [entry({ user: user("colleague"), kind: "body" })],
      team()
    );
    expect(v.needs).toBe(true);
    expect(await orgMemberFlag(v, stubOrg)).toBe(true);
  });

  it("does not flag a non-member outsider", async () => {
    const v = verdict(
      [entry({ user: user("outsider"), kind: "body" })],
      team()
    );
    expect(await orgMemberFlag(v, stubOrg)).toBe(false);
  });

  it("skips the lookup when the team spoke last", async () => {
    const v = verdict(
      [
        entry({ user: user("colleague"), kind: "body", created_at: day(3) }),
        entry({ user: user("maintainer"), created_at: day(1) }),
      ],
      team()
    );
    let called = false;
    const flag = await orgMemberFlag(v, (login) => {
      called = true;
      return stubOrg(login);
    });
    expect(flag).toBe(false);
    expect(called).toBe(false);
  });
});

describe("isTeam", () => {
  it("matches case-insensitively and treats null as outside", () => {
    const t = new Set(["maintainer"]);
    expect(isTeam("Maintainer", t)).toBe(true);
    expect(isTeam("outsider", t)).toBe(false);
    expect(isTeam(null, t)).toBe(false);
  });
});

describe("tallyReactions", () => {
  it("counts only outside reactors, excluding team, bots, and dosubot", () => {
    const counts = tallyReactions(
      [
        { key: "+1", login: "outsider1", user: user("outsider1") },
        { key: "+1", login: "outsider2", user: user("outsider2") },
        { key: "heart", login: "outsider1", user: user("outsider1") },
        { key: "+1", login: "maintainer", user: user("maintainer") }, // team
        { key: "+1", login: "dosubot[bot]", user: user("dosubot[bot]", "Bot") },
        { key: "+1", login: "dosubot", user: user("dosubot") }, // bare login
      ],
      team()
    );
    expect(counts).toEqual({ "+1": 2, heart: 1 });
  });

  it("returns an empty object when only team/bots reacted", () => {
    const counts = tallyReactions(
      [{ key: "+1", login: "maintainer", user: user("maintainer") }],
      team()
    );
    expect(counts).toEqual({});
  });
});
