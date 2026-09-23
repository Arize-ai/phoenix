// Builds a Slack digest of open pull requests grouped by the person who needs
// to act on them: individually requested reviewers, assignees, and team-member
// authors whose PR is approved, has changes requested, or has no other owner.
// Community PRs that nobody owns yet are listed separately so they can be
// picked up.

const PULL_REQUESTS_QUERY = `
  query($owner: String!, $repo: String!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequests(
        states: OPEN
        first: 100
        after: $cursor
        orderBy: { field: CREATED_AT, direction: DESC }
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
          createdAt
          updatedAt
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
        }
      }
    }
  }
`;

// Author associations that identify a team member who can shepherd their own PR
const TEAM_AUTHOR_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

// The order in which a person's PRs are listed: things to review come first
const ROLE_PRIORITY = {
  "review requested": 0,
  assigned: 1,
  author: 2,
};

const REVIEW_STATUS = {
  APPROVED: { emoji: "✅", label: "approved" },
  CHANGES_REQUESTED: { emoji: "🔁", label: "changes requested" },
  REVIEW_REQUIRED: { emoji: "👀", label: "awaiting review" },
};

const MILLISECONDS_IN_A_DAY = 1000 * 60 * 60 * 24;

// Slack mrkdwn treats these characters as control characters
function escapeSlackText(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function createGithubLink(username) {
  return `<https://github.com/${username}|${username}>`;
}

function createPullRequestSearchLink(owner, repo, query) {
  const search = encodeURIComponent(`is:pr is:open draft:false ${query}`);
  return `https://github.com/${owner}/${repo}/pulls?q=${search}`;
}

function daysSince(date) {
  return Math.floor((Date.now() - new Date(date)) / MILLISECONDS_IN_A_DAY);
}

function formatDaysAgo(days) {
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function pluralize(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
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

// A PR is worth surfacing when a human is expected to act on it
function isImportant(pullRequest, ignoredLabels) {
  if (pullRequest.isDraft) return false;
  if (!pullRequest.author || pullRequest.author.__typename === "Bot") {
    return false;
  }
  return !pullRequest.labels.nodes.some((label) =>
    ignoredLabels.includes(label.name)
  );
}

// reviewDecision is null when the branch has no required-review rule
function getReviewStatus(pullRequest) {
  return (
    REVIEW_STATUS[pullRequest.reviewDecision] || REVIEW_STATUS.REVIEW_REQUIRED
  );
}

// Determine who needs to act on a PR and in which capacity
function getOwners(pullRequest) {
  const authorLogin = pullRequest.author.login;
  const owners = [];
  const seen = new Set([authorLogin]);

  for (const request of pullRequest.reviewRequests.nodes) {
    const reviewer = request.requestedReviewer;
    if (
      !reviewer ||
      reviewer.__typename !== "User" ||
      seen.has(reviewer.login)
    ) {
      continue;
    }
    seen.add(reviewer.login);
    owners.push({ login: reviewer.login, role: "review requested" });
  }

  for (const assignee of pullRequest.assignees.nodes) {
    if (seen.has(assignee.login)) continue;
    seen.add(assignee.login);
    owners.push({ login: assignee.login, role: "assigned" });
  }

  // A team member's own PR lands on their plate when nobody else owns it or
  // when reviewers have already spoken and the next move is theirs
  const isTeamAuthor = TEAM_AUTHOR_ASSOCIATIONS.has(
    pullRequest.authorAssociation
  );
  const reviewStatus = getReviewStatus(pullRequest);
  const ballIsWithAuthor = reviewStatus !== REVIEW_STATUS.REVIEW_REQUIRED;
  if (isTeamAuthor && (owners.length === 0 || ballIsWithAuthor)) {
    owners.push({ login: authorLogin, role: "author" });
  }

  return owners;
}

function compareEntries(a, b) {
  const roleDifference = ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role];
  if (roleDifference !== 0) return roleDifference;
  return new Date(a.pullRequest.createdAt) - new Date(b.pullRequest.createdAt); // Oldest first
}

// Group PRs by owner login; PRs with no owner are collected separately
function groupPullRequestsByOwner(pullRequests) {
  const groups = new Map();
  const unowned = [];

  for (const pullRequest of pullRequests) {
    const owners = getOwners(pullRequest);
    if (owners.length === 0) {
      unowned.push({ pullRequest, role: null });
      continue;
    }
    for (const { login, role } of owners) {
      if (!groups.has(login)) groups.set(login, []);
      groups.get(login).push({ pullRequest, role });
    }
  }

  for (const entries of groups.values()) {
    entries.sort(compareEntries);
  }
  unowned.sort(compareEntries);

  const sortedGroups = [...groups.entries()].sort(([a], [b]) =>
    a.localeCompare(b, "en", { sensitivity: "base" })
  );
  return { groups: sortedGroups, unowned };
}

function formatPullRequestLine(
  { pullRequest, role },
  index,
  stalenessThreshold
) {
  const status = getReviewStatus(pullRequest);
  const daysSinceUpdate = daysSince(pullRequest.updatedAt);
  const isStale = daysSinceUpdate > stalenessThreshold;

  let line = `${index + 1}. ${status.emoji} *<${pullRequest.url}|#${
    pullRequest.number
  }>:* ${escapeSlackText(pullRequest.title)}`;

  const details = [
    `by ${createGithubLink(pullRequest.author.login)}`,
    `opened ${formatDaysAgo(daysSince(pullRequest.createdAt))}`,
  ];
  if (role && role !== "author") details.push(role);
  if (status !== REVIEW_STATUS.REVIEW_REQUIRED) details.push(status.label);
  if (isStale) {
    details.push(`🥀 last activity ${formatDaysAgo(daysSinceUpdate)}`);
  }
  line += ` (${details.join("; ")})`;

  return line;
}

function formatGroup(header, entries, moreLink, options) {
  const { maxPerGroup, stalenessThreshold } = options;
  const lines = [header];
  const shown = entries.slice(0, maxPerGroup);
  lines.push(
    ...shown.map((entry, index) =>
      formatPullRequestLine(entry, index, stalenessThreshold)
    )
  );
  const hidden = entries.length - shown.length;
  if (hidden > 0) {
    lines.push(
      `_…and <${moreLink}|${pluralize(hidden, "more pull request")}>_`
    );
  }
  return lines;
}

function buildSlackMessage({ groups, unowned }, options) {
  const { owner, repo, stalenessThreshold } = options;
  const total =
    groups.reduce((sum, [, entries]) => sum + entries.length, 0) +
    unowned.length;

  const messageLines = [
    `*🔍 Open Pull Requests Needing Attention*`,
    `${pluralize(total, "pull request")} across ${groups.length} ${
      groups.length === 1 ? "person" : "people"
    }` +
      (unowned.length > 0
        ? ` plus ${pluralize(unowned.length, "unowned pull request")}`
        : "") +
      `. ${REVIEW_STATUS.REVIEW_REQUIRED.emoji} awaiting review · ${
        REVIEW_STATUS.APPROVED.emoji
      } approved · ${
        REVIEW_STATUS.CHANGES_REQUESTED.emoji
      } changes requested · 🥀 no activity in >${stalenessThreshold} days\n`,
  ];

  for (const [login, entries] of groups) {
    const header = `*👤 ${createGithubLink(login)}* (${pluralize(
      entries.length,
      "pull request"
    )})`;
    const moreLink = createPullRequestSearchLink(
      owner,
      repo,
      `involves:${login}`
    );
    messageLines.push(...formatGroup(header, entries, moreLink, options), "");
  }

  if (unowned.length > 0) {
    const header = `*🙋 Needs an Owner* (${pluralize(
      unowned.length,
      "pull request"
    )} with no reviewer or assignee)`;
    const moreLink = createPullRequestSearchLink(owner, repo, "no:assignee");
    messageLines.push(...formatGroup(header, unowned, moreLink, options));
  }

  return messageLines.join("\n").trimEnd();
}

// Main function to fetch and group open PRs, then set the Slack message output
module.exports = async ({ github, context, core }) => {
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const stalenessThreshold = parseInt(
    process.env.STALENESS_THRESHOLD_IN_DAYS || "14",
    10
  );
  const maxPerGroup = parseInt(process.env.MAX_PRS_PER_GROUP || "10", 10);
  const ignoredLabels = (
    process.env.IGNORED_PR_LABELS || "autorelease: pending"
  )
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);

  const pullRequests = await fetchOpenPullRequests(github, owner, repo);
  const importantPullRequests = pullRequests.filter((pullRequest) =>
    isImportant(pullRequest, ignoredLabels)
  );

  if (importantPullRequests.length === 0) {
    core.setOutput("has_prs", "false");
    return;
  }

  core.setOutput("has_prs", "true");
  const grouped = groupPullRequestsByOwner(importantPullRequests);
  const message = buildSlackMessage(grouped, {
    owner,
    repo,
    stalenessThreshold,
    maxPerGroup,
  });
  core.setOutput("slack_message", message);
};
