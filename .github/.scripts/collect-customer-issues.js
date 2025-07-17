// Utility function to create a hyperlink to a GitHub user
function createGithubLink(username) {
  return `<https://github.com/${username}|${username}>`;
}

// Helper function to check if an issue has any of the required labels
function hasLabel(issueLabels, requiredLabels) {
  return issueLabels.some((label) => requiredLabels.includes(label.name));
}

// Helper function to calculate the difference in days and format as "Today," "Yesterday," or "X days ago"
function formatDateDifference(date) {
  const now = new Date();
  const millisecondsInADay = 1000 * 60 * 60 * 24;
  const daysDifference = Math.floor(
    (now - new Date(date)) / millisecondsInADay
  );

  if (daysDifference === 0) return "Today";
  if (daysDifference === 1) return "Yesterday";
  return `${daysDifference} days ago`;
}

// Helper function to extract the owner and repo name from a GitHub URL
function extractOwnerAndRepoFromHtmlUrl(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (match) {
    return {
      owner: match[1],
      repo: match[2],
    };
  }
  throw new Error(`Invalid GitHub URL ${url}`);
}

// Helper function to get a sorted list of unique participants from comments on an issue, excluding the author
async function getParticipants(github, issue) {
  try {
    const { owner, repo } = extractOwnerAndRepoFromHtmlUrl(issue.html_url);
    const comments = await github.paginate(github.rest.issues.listComments, {
      owner: owner,
      repo: repo,
      issue_number: issue.number,
      per_page: 100,
    });

    const participants = new Set(
      comments
        .map((comment) => comment.user.login)
        .filter((username) => username !== issue.user.login) // Exclude the author
    );
    return Array.from(participants).sort();
  } catch (error) {
    console.error(`Error fetching comments for issue #${issue.number}:`, error);
    return [];
  }
}

// Helper function to filter issues based on required labels and a cutoff date
function filterIssues(issues, requiredLabels, cutoffDate) {
  return issues
    .filter((issue) => {
      const hasLabels = hasLabel(issue.labels, requiredLabels);
      const isRecent = new Date(issue.created_at) > cutoffDate;
      const isNotPR = !issue.pull_request;
      return hasLabels && isRecent && isNotPR;
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // Sort by creation date, newest first
}

// Helper function to separate issues into "stale" and "fresh" based on staleness threshold
function splitIssuesByStaleness(issues, stalenessThreshold) {
  const staleIssues = [];
  const freshIssues = [];
  const now = new Date();

  issues.forEach((issue) => {
    const daysOld = Math.floor(
      (now - new Date(issue.created_at)) / (1000 * 60 * 60 * 24)
    );
    if (daysOld > stalenessThreshold) {
      staleIssues.push(issue);
    } else {
      freshIssues.push(issue);
    }
  });

  return { staleIssues, freshIssues };
}

// Helper function to categorize fresh issues as either "bug" or "enhancement/inquiry"
function categorizeIssues(issues) {
  const bugIssues = [];
  const enhancementIssues = [];

  issues.forEach((issue) => {
    if (issue.labels.some((label) => label.name === "bug")) {
      bugIssues.push(issue);
    } else {
      enhancementIssues.push(issue);
    }
  });

  return { bugIssues, enhancementIssues };
}

// Helper function to build a detailed description for each issue
async function formatIssueLine(github, issue, index) {
  let line = `${index + 1}. *<${issue.html_url}|#${issue.number}>:* ${
    issue.title
  }`;
  line += ` (by ${createGithubLink(issue.user.login)}; ${formatDateDifference(
    issue.created_at
  )})`;

  if (issue.comments > 0) {
    line += `; ${issue.comments} comment${issue.comments > 1 ? "s" : ""}`;
    const participants = await getParticipants(github, issue);
    if (participants.length > 0) {
      const participantLinks = participants.map(createGithubLink).join(", ");
      line += `; participants: ${participantLinks}`;
    }
  }

  if (issue.assignees.length > 0) {
    const assigneeLinks = issue.assignees
      .map((assignee) => createGithubLink(assignee.login))
      .join(", ");
    line += `; assigned to: ${assigneeLinks}`;
  }

  return line;
}

// Helper function to build a message for Slack with grouped and formatted issues
async function buildSlackMessage(github, issueGroups, lookbackDays) {
  const messageLines = [
    `*🛠️ Customer Issues Opened in the Last ${lookbackDays} Day(s) Pending Triage*\n`,
  ];

  for (const [issuesArray, header] of issueGroups) {
    if (issuesArray.length > 0) {
      messageLines.push(header); // Add the group header (e.g., "🐛 Bugs")
      const issueDescriptions = await Promise.all(
        issuesArray.map((issue, index) => formatIssueLine(github, issue, index))
      );
      messageLines.push(...issueDescriptions);
    }
  }

  return messageLines.join("\n");
}

// Main function to fetch and format issues, then send the Slack message
module.exports = async ({ github, context, core }) => {
  const requiredLabels = ["triage"];
  const lookbackDays = parseInt(process.env.LOOKBACK_DAYS || "120", 10);
  const stalenessThreshold = parseInt(
    process.env.STALENESS_THRESHOLD_IN_DAYS || "14",
    10
  );

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

  const issues = [];
  // Retrieve issues created within the specified lookback period
  for (const repo of ["phoenix"]) {
    const repoIssues = await github.paginate(github.rest.issues.listForRepo, {
      owner: context.repo.owner,
      repo: repo,
      state: "open",
      since: cutoffDate.toISOString(),
      per_page: 100,
    });
    issues.push(...repoIssues);
  }

  // Filter issues by label and date, then categorize by staleness and type
  const filteredIssues = filterIssues(issues, requiredLabels, cutoffDate);
  if (filteredIssues.length === 0) {
    core.setOutput("has_issues", "false");
    return;
  }

  core.setOutput("has_issues", "true");

  const { staleIssues, freshIssues } = splitIssuesByStaleness(
    filteredIssues,
    stalenessThreshold
  );
  const { bugIssues, enhancementIssues } = categorizeIssues(freshIssues);

  const issueGroups = [
    [bugIssues, "*🐛 Bugs*"],
    [enhancementIssues, "*💡 Enhancements or Inquiries*"],
    [staleIssues, `*🥀 Stale Issues (>${stalenessThreshold} days)*`],
  ];

  // Build the Slack message and set as output
  const message = await buildSlackMessage(github, issueGroups, lookbackDays);
  core.setOutput("slack_message", message);
};
