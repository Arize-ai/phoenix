module.exports = async ({ github, context, core }) => {
  // List of labels to filter by
  const requiredLabels = ["triage"];

  // Access the DAYS environment variable
  const days = parseInt(process.env.LOOKBACK_DAYS || "120", 10);
  const staleThreshold = parseInt(
    process.env.STALENESS_THRESHOLD_IN_DAYS || "14",
    10,
  );

  // Calculate the cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Fetch issues created since DAYS ago
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    state: "open",
    since: cutoffDate.toISOString(),
    per_page: 100,
  });

  // Check if issue has any of the required labels
  function hasRequiredLabel(issueLabels, requiredLabels) {
    return issueLabels.some((label) => requiredLabels.includes(label.name));
  }

  // Filter issues
  const filteredIssues = issues
    .filter(
      (issue) =>
        hasRequiredLabel(issue.labels, requiredLabels) &&
        new Date(issue.created_at) > cutoffDate &&
        !issue.pull_request,
    )
    .sort((a, b) => b.number - a.number);

  // Function to calculate diff in days
  function diffInDays(date1, date2) {
    const diffInMs = Math.abs(date1 - date2);
    return Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  }

  // Function to calculate "X days ago" from created_at date for display purposes
  function timeAgo(createdAt) {
    const now = new Date();
    const diff = diffInDays(new Date(createdAt), now);
    if (diff === 0) {
      return "Today";
    } else if (diff === 1) {
      return "Yesterday";
    } else {
      return `${diff} days ago`;
    }
  }

  // Function to get unique participants from comments on an issue, excluding the author
  async function getParticipants(issueNumber, author) {
    try {
      const comments = await github.paginate(github.rest.issues.listComments, {
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issueNumber,
        per_page: 100,
      });
      // Extract unique usernames of commenters, excluding the author
      return [
        ...new Set(
          comments
            .map((comment) => comment.user.login)
            .filter((username) => username !== author),
        ),
      ].sort();
    } catch (error) {
      console.error(
        `Error fetching comments for issue #${issueNumber}: ${error}`,
      );
      return [];
    }
  }

  // Format the issues as a Markdown message for Slack
  if (filteredIssues.length === 0) {
    core.setOutput("has_issues", "false");
  } else {
    core.setOutput("has_issues", "true");
    let message = `*🛠️ Phoenix Customer Issues Opened in the Last ${days} Day(s)`;
    message += ` Pending <https://github.com/Arize-ai/phoenix/issues?q=is%3Aissue+is%3Aopen+label%3Atriage|Triage>`;
    message += `*\n\n`;
    const now = new Date();
    // Filter issues that are stale
    const staleIssues = filteredIssues.filter(
      (issue) => diffInDays(new Date(issue.created_at), now) > staleThreshold,
    );
    const freshIssues = filteredIssues.filter(
      (issue) => !staleIssues.includes(issue),
    );
    // Separate fresh issues into two lists: those with the "bug" label and those without
    const bugIssues = freshIssues.filter((issue) =>
      issue.labels.some((label) => label.name === "bug"),
    );
    const enhancementIssues = freshIssues.filter(
      (issue) => !bugIssues.includes(issue),
    );
    const issueGroups = [
      [bugIssues, "*🐛 Bugs*"],
      [enhancementIssues, "*💡 Enhancements or Inquiries*"],
      [staleIssues, `*🥀 Stale Issues (>${staleThreshold} days)*`],
    ];
    // Use `for...of` loop to allow async/await inside the loop
    for (const [issues, header] of issueGroups) {
      if (issues.length > 0) {
        message += `${header}\n`;
        for (const [i, issue] of issues.entries()) {
          message += `${i + 1}. *<${issue.html_url}|#${issue.number}>:* ${issue.title}`;
          message += ` (by <https://github.com/${issue.user.login}|${issue.user.login}>`;
          message += `; ${timeAgo(issue.created_at)}`;
          if (issue.comments > 0) {
            message += `; ${issue.comments} comments`;
            const participants = await getParticipants(
              issue.number,
              issue.user.login,
            );
            if (participants.length > 0) {
              message += `; participants: `;
              message += participants
                .map(
                  (participant) =>
                    `<https://github.com/${participant}|${participant}>`,
                )
                .join(", ");
            }
          }
          if (issue.assignees.length > 0) {
            message += `; assigned to: `;
            message += issue.assignees
              .map(
                (assignee) =>
                  `<https://github.com/${assignee.login}|${assignee.login}>`,
              )
              .join(", ");
          }
          message += `)\n`;
        }
      }
    }
    core.setOutput("slack_message", message);
  }
};
