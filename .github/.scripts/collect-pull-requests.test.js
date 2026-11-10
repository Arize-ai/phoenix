// Run with: node --test .github/.scripts/*.test.js
const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const collectPullRequests = require("./collect-pull-requests.js");
const {
  buildSlackMessage,
  createMentioner,
  getLastActivity,
  groupByPerson,
  isRelevant,
  summarizePullRequest,
} = collectPullRequests.internals;

const NOW = new Date("2026-11-09T12:00:00Z");

function daysAgo(days) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

let nextNumber = 1;
function makePullRequest(overrides = {}) {
  const createdAt = overrides.createdAt ?? daysAgo(1);
  return {
    number: nextNumber++,
    title: "feat: something",
    url: "https://github.com/o/r/pull/1",
    isDraft: false,
    isCrossRepository: false,
    createdAt,
    authorAssociation: "MEMBER",
    reviewDecision: "REVIEW_REQUIRED",
    author: { __typename: "User", login: "alice" },
    assignees: { nodes: [] },
    reviewRequests: { nodes: [] },
    labels: { nodes: [] },
    commits: { nodes: [{ commit: { committedDate: createdAt } }] },
    reviews: { nodes: [] },
    comments: { nodes: [] },
    ...overrides,
  };
}

function reviewRequest(login) {
  return { requestedReviewer: { __typename: "User", login } };
}

const OPTIONS = {
  owner: "o",
  repo: "r",
  now: NOW,
  agingThreshold: 7,
  stalenessThreshold: 14,
  maxStale: 15,
  maxUnowned: 10,
  mention: createMentioner({}),
};

function summarize(overrides) {
  return summarizePullRequest(makePullRequest(overrides), OPTIONS);
}

describe("isRelevant", () => {
  it("skips drafts, bots, and ignored labels", () => {
    const ignored = ["autorelease: pending"];
    assert.equal(isRelevant(makePullRequest(), ignored), true);
    assert.equal(
      isRelevant(makePullRequest({ isDraft: true }), ignored),
      false,
    );
    assert.equal(
      isRelevant(
        makePullRequest({ author: { __typename: "Bot", login: "bot" } }),
        ignored,
      ),
      false,
    );
    assert.equal(isRelevant(makePullRequest({ author: null }), ignored), false);
    assert.equal(
      isRelevant(
        makePullRequest({
          labels: { nodes: [{ name: "autorelease: pending" }] },
        }),
        ignored,
      ),
      false,
    );
  });
});

describe("getLastActivity", () => {
  it("ignores bot comments and reviews", () => {
    const pullRequest = makePullRequest({
      createdAt: daysAgo(30),
      commits: { nodes: [{ commit: { committedDate: daysAgo(20) } }] },
      reviews: {
        nodes: [
          { submittedAt: daysAgo(18), author: { __typename: "User" } },
          { submittedAt: daysAgo(1), author: { __typename: "Bot" } },
        ],
      },
      comments: {
        nodes: [
          { createdAt: daysAgo(16), author: { __typename: "User" } },
          { createdAt: daysAgo(0), author: { __typename: "Bot" } },
        ],
      },
    });
    assert.equal(getLastActivity(pullRequest).toISOString(), daysAgo(16));
  });
});

describe("summarizePullRequest", () => {
  it("buckets freshness by days since last activity", () => {
    assert.equal(
      summarize({ createdAt: daysAgo(7) }).freshness.label,
      "active",
    );
    assert.equal(summarize({ createdAt: daysAgo(8) }).freshness.label, "aging");
    assert.equal(
      summarize({ createdAt: daysAgo(15) }).freshness.label,
      "stale",
    );
  });

  it("ignores team review requests and the author's own requests", () => {
    const summary = summarize({
      reviewRequests: {
        nodes: [
          reviewRequest("bob"),
          reviewRequest("alice"),
          { requestedReviewer: { __typename: "Team" } },
        ],
      },
    });
    assert.deepEqual(summary.reviewers, ["bob"]);
  });

  it("assigns the next move to the right person", () => {
    const withReviewer = { reviewRequests: { nodes: [reviewRequest("bob")] } };
    assert.deepEqual(summarize(withReviewer).waitingOn, {
      logins: ["bob"],
      reason: "review",
    });
    assert.deepEqual(
      summarize({ ...withReviewer, reviewDecision: "CHANGES_REQUESTED" })
        .waitingOn.logins,
      ["alice"],
    );
    assert.deepEqual(
      summarize({ ...withReviewer, reviewDecision: "APPROVED" }).waitingOn
        .logins,
      ["alice"],
    );
    assert.deepEqual(
      summarize({ assignees: { nodes: [{ login: "carol" }] } }).waitingOn,
      { logins: ["carol"], reason: "assigned" },
    );
    assert.equal(summarize().waitingOn.reason, "no reviewer requested");
  });

  it("flags unowned community PRs", () => {
    const summary = summarize({
      isCrossRepository: true,
      authorAssociation: "CONTRIBUTOR",
      author: { __typename: "User", login: "outsider" },
    });
    assert.equal(summary.needsOwner, true);
    assert.equal(summary.isTeamAuthor, false);
  });
});

describe("groupByPerson", () => {
  it("counts each PR once per person and sorts by stale count", () => {
    const summaries = [
      // bob reviews and is assigned to the same stale PR
      summarize({
        createdAt: daysAgo(30),
        reviewRequests: { nodes: [reviewRequest("bob")] },
        assignees: { nodes: [{ login: "bob" }] },
      }),
      summarize({ createdAt: daysAgo(2) }),
      // Community authors do not get a roll-up of their own
      summarize({
        isCrossRepository: true,
        authorAssociation: "NONE",
        author: { __typename: "User", login: "outsider" },
      }),
    ];
    const people = groupByPerson(summaries);
    assert.deepEqual(
      people.map((person) => person.login),
      ["alice", "bob"],
    );
    const bob = people[1];
    assert.equal(bob.reviewing.length, 1);
    assert.equal(bob.assigned.length, 1);
    assert.equal(bob.pullRequests.length, 1);
    assert.deepEqual(bob.counts, { ACTIVE: 0, AGING: 0, STALE: 1 });
    assert.deepEqual(people[0].counts, { ACTIVE: 1, AGING: 0, STALE: 1 });
  });
});

describe("buildSlackMessage", () => {
  it("counts unique PRs and keeps stale and unowned sections disjoint", () => {
    const summaries = [
      summarize({
        title: "stale <b> & owned",
        createdAt: daysAgo(40),
        reviewRequests: { nodes: [reviewRequest("bob")] },
        assignees: { nodes: [{ login: "carol" }] },
      }),
      summarize({
        createdAt: daysAgo(20),
        isCrossRepository: true,
        authorAssociation: "NONE",
        author: { __typename: "User", login: "outsider" },
      }),
      summarize({ createdAt: daysAgo(1) }),
    ];
    const message = buildSlackMessage(summaries, OPTIONS);
    assert.match(message, /3 open · 🔴 2 stale · 🙋 1 need an owner/);
    assert.match(message, /stale &lt;b&gt; &amp; owned/);
    const staleSection = message.split("*🙋 Needs an owner*")[0];
    assert.doesNotMatch(staleSection, /outsider/);
    assert.match(
      message,
      /Needs an owner[^\n]*\n1\. 🔴 [^\n]*by <[^|]+\|outsider>/,
    );
  });

  it("caps lists and reports how many were hidden", () => {
    const summaries = Array.from({ length: 4 }, (_, i) =>
      summarize({ createdAt: daysAgo(20 + i) }),
    );
    const message = buildSlackMessage(summaries, { ...OPTIONS, maxStale: 2 });
    assert.match(message, /\n2\. 🔴[^\n]*\n_…and 2 more_/);
  });

  it("mentions mapped Slack users and links everyone else", () => {
    const mention = createMentioner({ alice: "U123" });
    assert.equal(mention("alice"), "<@U123>");
    assert.equal(mention("bob"), "<https://github.com/bob|bob>");
    assert.equal(
      mention("constructor"),
      "<https://github.com/constructor|constructor>",
    );
  });
});

describe("main", () => {
  it("paginates, filters, and sets outputs", async () => {
    const pages = [
      {
        nodes: [makePullRequest()],
        pageInfo: { hasNextPage: true, endCursor: "c1" },
      },
      {
        nodes: [makePullRequest({ isDraft: true })],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    ];
    const cursors = [];
    const github = {
      graphql: async (_query, { cursor }) => {
        cursors.push(cursor);
        return { repository: { pullRequests: pages.shift() } };
      },
    };
    const outputs = {};
    const summary = {
      addHeading: () => summary,
      addCodeBlock: () => summary,
      write: async () => {},
    };
    const core = {
      setOutput: (key, value) => (outputs[key] = value),
      warning: () => {},
      summary,
    };
    await collectPullRequests({
      github,
      context: { repo: { owner: "o", repo: "r" } },
      core,
    });
    assert.deepEqual(cursors, [null, "c1"]);
    assert.equal(outputs.has_prs, "true");
    assert.match(outputs.slack_message, /1 open/);
  });
});
