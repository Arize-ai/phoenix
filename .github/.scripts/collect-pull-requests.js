// Builds a daily Slack digest of open pull requests. The digest gives:
//
// 1. A roll-up per person: how many open PRs they authored, how many wait on
//    their review, and how many they are assigned to, with a staleness
//    breakdown. People with the most stale PRs are listed first.
// 2. The stale PRs (no human activity for more than the staleness threshold),
//    stalest first, each with the person the PR is waiting on.
// 3. Community PRs that have no reviewer or assignee yet.

const PULL_REQUESTS_QUERY = `
  query($owner: String!, $repo: String!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequests(
        states: OPEN
        first: 50
        after: $cursor
        orderBy: { field: CREATED_AT, direction: ASC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          number
          title
          url
          isDraft
          isCrossRepository
          createdAt
          authorAssociation
          reviewDecision
          author {
            __typename
            login
          }
          assignees(first: 10) {
            nodes {
              login
            }
          }
          reviewRequests(first: 20) {
            nodes {
              requestedReviewer {
                __typename
                ... on User {
                  login
                }
              }
            }
          }
          labels(first: 20) {
            nodes {
              name
            }
          }
          commits(last: 1) {
            nodes {
              commit {
                committedDate
              }
            }
          }
          reviews(last: 10) {
            nodes {
              submittedAt
              author {
                __typename
              }
            }
          }
          comments(last: 10) {
            nodes {
              createdAt
              author {
                __typename
              }
            }
          }
        }
      }
    }
  }
`;

// The Actions token does not see private org membership, so an association
// is only a fallback for the primary signal: a head branch in this repo.
const TEAM_AUTHOR_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

const MILLISECONDS_IN_A_DAY = 1000 * 60 * 60 * 24;

// Each level has its own shape (circle, diamond, square) as well as its own
// color, so the levels can be told apart without relying on color
const FRESHNESS = {
  ACTIVE: { key: "ACTIVE", emoji: "🟢", label: "active" },
  AGING: { key: "AGING", emoji: "🔶", label: "aging" },
  STALE: { key: "STALE", emoji: "🟥", label: "stale" },
};

// Slack mrkdwn treats these characters as control characters
function escapeSlackText(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function daysBetween(earlier, later) {
  return Math.floor((later - new Date(earlier)) / MILLISECONDS_IN_A_DAY);
}

function createSearchLink(owner, repo, query) {
  const search = encodeURIComponent(`is:pr is:open draft:false ${query}`);
  return `https://github.com/${owner}/${repo}/pulls?q=${search}`;
}

function isHuman(actor) {
  return Boolean(actor) && actor.__typename !== "Bot";
}

// A PR is worth surfacing when a human is expected to act on it
function isRelevant(pullRequest, ignoredLabels) {
  if (pullRequest.isDraft) return false;
  if (!isHuman(pullRequest.author)) return false;
  return !pullRequest.labels.nodes.some((label) =>
    ignoredLabels.includes(label.name),
  );
}

// Only people with push access can open a PR from a branch in this repo, so a
// non-fork head is a reliable membership signal even for the Actions token
function isTeamAuthored(pullRequest) {
  return (
    !pullRequest.isCrossRepository ||
    TEAM_AUTHOR_ASSOCIATIONS.has(pullRequest.authorAssociation)
  );
}

// The most recent push, human review, or human comment. Bot comments (CI,
// previews, release tooling) are ignored so they do not hide a stalled PR.
function getLastActivity(pullRequest) {
  const timestamps = [pullRequest.createdAt];
  for (const { commit } of pullRequest.commits.nodes) {
    timestamps.push(commit.committedDate);
  }
  for (const review of pullRequest.reviews.nodes) {
    if (review.submittedAt && isHuman(review.author)) {
      timestamps.push(review.submittedAt);
    }
  }
  for (const comment of pullRequest.comments.nodes) {
    if (isHuman(comment.author)) timestamps.push(comment.createdAt);
  }
  return new Date(Math.max(...timestamps.map((t) => new Date(t).getTime())));
}

function getFreshness(idleDays, { agingThreshold, stalenessThreshold }) {
  if (idleDays > stalenessThreshold) return FRESHNESS.STALE;
  if (idleDays > agingThreshold) return FRESHNESS.AGING;
  return FRESHNESS.ACTIVE;
}

function getRequestedReviewers(pullRequest, authorLogin) {
  const reviewers = new Set();
  for (const { requestedReviewer } of pullRequest.reviewRequests.nodes) {
    // Team requests come from CODEOWNERS on nearly every PR, so they do not
    // say who should act; only individual requests are counted
    if (requestedReviewer?.__typename !== "User") continue;
    if (requestedReviewer.login === authorLogin) continue;
    reviewers.add(requestedReviewer.login);
  }
  return [...reviewers];
}

function getAssignees(pullRequest, authorLogin) {
  return [
    ...new Set(
      pullRequest.assignees.nodes
        .map((assignee) => assignee.login)
        .filter((login) => login !== authorLogin),
    ),
  ];
}

// Who the next move belongs to, and why. Null means nobody owns the PR.
function getWaitingOn({
  author,
  isTeamAuthor,
  reviewDecision,
  reviewers,
  assignees,
}) {
  if (reviewDecision === "APPROVED") {
    return { logins: [author], reason: "approved, ready to merge" };
  }
  if (reviewDecision === "CHANGES_REQUESTED") {
    return { logins: [author], reason: "changes requested" };
  }
  if (reviewers.length > 0) return { logins: reviewers, reason: "review" };
  if (assignees.length > 0) return { logins: assignees, reason: "assigned" };
  if (isTeamAuthor)
    return { logins: [author], reason: "no reviewer requested" };
  return null;
}

// Normalize a GraphQL PR node into the fields the digest needs
function summarizePullRequest(pullRequest, options) {
  const { now } = options;
  const author = pullRequest.author.login;
  const reviewers = getRequestedReviewers(pullRequest, author);
  const assignees = getAssignees(pullRequest, author);
  const isTeamAuthor = isTeamAuthored(pullRequest);
  const lastActivity = getLastActivity(pullRequest);
  const idleDays = daysBetween(lastActivity, now);
  const summary = {
    number: pullRequest.number,
    title: pullRequest.title,
    url: pullRequest.url,
    author,
    isTeamAuthor,
    reviewers,
    assignees,
    reviewDecision: pullRequest.reviewDecision,
    ageDays: daysBetween(pullRequest.createdAt, now),
    idleDays,
    freshness: getFreshness(idleDays, options),
  };
  summary.waitingOn = getWaitingOn(summary);
  summary.needsOwner = summary.waitingOn === null;
  return summary;
}

function getOrCreatePerson(people, login) {
  if (!people.has(login)) {
    people.set(login, {
      login,
      authored: [],
      reviewing: [],
      assigned: [],
    });
  }
  return people.get(login);
}

// Index PRs by the people involved. Community authors are not on Slack, so
// only team members get a roll-up for the PRs they authored.
function groupByPerson(summaries) {
  const people = new Map();
  for (const summary of summaries) {
    if (summary.isTeamAuthor) {
      getOrCreatePerson(people, summary.author).authored.push(summary);
    }
    for (const login of summary.reviewers) {
      getOrCreatePerson(people, login).reviewing.push(summary);
    }
    for (const login of summary.assignees) {
      getOrCreatePerson(people, login).assigned.push(summary);
    }
  }
  for (const person of people.values()) {
    // A PR can involve someone in several roles; count it once per person
    const unique = new Map();
    for (const summary of [
      ...person.authored,
      ...person.reviewing,
      ...person.assigned,
    ]) {
      unique.set(summary.number, summary);
    }
    person.pullRequests = [...unique.values()];
    person.counts = { ACTIVE: 0, AGING: 0, STALE: 0 };
    for (const summary of person.pullRequests) {
      person.counts[summary.freshness.key] += 1;
    }
  }
  return [...people.values()].sort(
    (a, b) =>
      b.counts.STALE - a.counts.STALE ||
      b.counts.AGING - a.counts.AGING ||
      b.pullRequests.length - a.pullRequests.length ||
      a.login.localeCompare(b.login, "en", { sensitivity: "base" }),
  );
}

function byIdleDaysDescending(a, b) {
  return b.idleDays - a.idleDays || b.ageDays - a.ageDays;
}

function createGithubLink(login) {
  return `<https://github.com/${login}|${login}>`;
}

function formatPersonLine(person, { owner, repo }) {
  const roleCounts = [
    ["authored", person.authored.length, `author:${person.login}`],
    [
      "to review",
      person.reviewing.length,
      `user-review-requested:${person.login}`,
    ],
    ["assigned", person.assigned.length, `assignee:${person.login}`],
  ]
    .filter(([, count]) => count > 0)
    .map(
      ([label, count, query]) =>
        `<${createSearchLink(owner, repo, query)}|${count} ${label}>`,
    );
  const freshnessCounts = Object.entries(FRESHNESS)
    .reverse()
    .filter(([key]) => person.counts[key] > 0)
    .map(([key, { emoji }]) => `${emoji} ${person.counts[key]}`);
  return `• ${createGithubLink(person.login)}: ${roleCounts.join(
    " · ",
  )}  —  ${freshnessCounts.join("  ")}`;
}

function formatPullRequestLine(summary, index) {
  const details = [
    `idle ${summary.idleDays}d`,
    `opened ${summary.ageDays}d ago`,
    `by ${createGithubLink(summary.author)}`,
  ];
  if (summary.waitingOn) {
    details.push(
      `waiting on ${summary.waitingOn.logins.map(createGithubLink).join(", ")} (${
        summary.waitingOn.reason
      })`,
    );
  }
  return `${index + 1}. ${summary.freshness.emoji} *<${summary.url}|#${
    summary.number
  }>* ${escapeSlackText(summary.title)} — ${details.join(" · ")}`;
}

function formatList(header, summaries, limit) {
  const lines = [header];
  summaries
    .slice(0, limit)
    .forEach((summary, index) =>
      lines.push(formatPullRequestLine(summary, index)),
    );
  const hidden = Math.max(0, summaries.length - limit);
  if (hidden > 0) lines.push(`_…and ${hidden} more_`);
  return lines;
}

function buildSlackMessage(summaries, options) {
  const { agingThreshold, stalenessThreshold, maxStale, maxUnowned } = options;
  const people = groupByPerson(summaries);
  const stale = summaries
    .filter((s) => !s.needsOwner && s.freshness === FRESHNESS.STALE)
    .sort(byIdleDaysDescending);
  const unowned = summaries
    .filter((s) => s.needsOwner)
    .sort(byIdleDaysDescending);
  const staleTotal = summaries.filter(
    (s) => s.freshness === FRESHNESS.STALE,
  ).length;

  const lines = [
    `*🔍 Open pull requests:* ${summaries.length} open · ${FRESHNESS.STALE.emoji} ${staleTotal} stale · 🙋 ${unowned.length} need an owner`,
    `_Last human activity (push, review, or comment): ${FRESHNESS.ACTIVE.emoji} ${FRESHNESS.ACTIVE.label} ≤${agingThreshold}d · ${FRESHNESS.AGING.emoji} ${FRESHNESS.AGING.label} ${agingThreshold + 1}–${stalenessThreshold}d · ${FRESHNESS.STALE.emoji} ${FRESHNESS.STALE.label} >${stalenessThreshold}d. Drafts and bot PRs are excluded._`,
  ];

  if (people.length > 0) {
    lines.push("", `*👥 By person*`);
    lines.push(...people.map((person) => formatPersonLine(person, options)));
  }

  if (stale.length > 0) {
    lines.push("");
    lines.push(
      ...formatList(
        `*${FRESHNESS.STALE.emoji} Stale (no activity in >${stalenessThreshold} days), stalest first*`,
        stale,
        maxStale,
      ),
    );
  }

  if (unowned.length > 0) {
    lines.push("");
    lines.push(
      ...formatList(
        `*🙋 Needs an owner* (community ${
          unowned.length === 1 ? "PR" : "PRs"
        } with no reviewer or assignee)`,
        unowned,
        maxUnowned,
      ),
    );
  }

  return lines.join("\n");
}

async function fetchOpenPullRequests(github, owner, repo) {
  const pullRequests = [];
  let cursor = null;
  do {
    const response = await github.graphql(PULL_REQUESTS_QUERY, {
      owner,
      repo,
      cursor,
    });
    const connection = response.repository.pullRequests;
    pullRequests.push(...connection.nodes);
    cursor = connection.pageInfo.hasNextPage
      ? connection.pageInfo.endCursor
      : null;
  } while (cursor);
  return pullRequests;
}

function parseIntegerEnv(name, fallback) {
  const value = parseInt(process.env[name] ?? "", 10);
  return Number.isNaN(value) ? fallback : value;
}

module.exports = async ({ github, context, core }) => {
  const { owner, repo } = context.repo;
  const ignoredLabels = (
    process.env.IGNORED_PR_LABELS ?? "autorelease: pending"
  )
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
  const options = {
    owner,
    repo,
    now: new Date(),
    agingThreshold: parseIntegerEnv("AGING_THRESHOLD_IN_DAYS", 7),
    stalenessThreshold: parseIntegerEnv("STALENESS_THRESHOLD_IN_DAYS", 14),
    maxStale: parseIntegerEnv("MAX_STALE_PRS", 15),
    maxUnowned: parseIntegerEnv("MAX_UNOWNED_PRS", 10),
  };

  const pullRequests = await fetchOpenPullRequests(github, owner, repo);
  const summaries = pullRequests
    .filter((pullRequest) => isRelevant(pullRequest, ignoredLabels))
    .map((pullRequest) => summarizePullRequest(pullRequest, options));

  if (summaries.length === 0) {
    core.setOutput("has_prs", "false");
    return;
  }

  const message = buildSlackMessage(summaries, options);
  core.setOutput("has_prs", "true");
  core.setOutput("slack_message", message);
  await core.summary
    .addHeading("Pull request digest", 2)
    .addCodeBlock(message)
    .write();
};
