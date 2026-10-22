# Factory assessment

Coordinators post this on their PR with `add_issue_comment` right after opening it, so a reviewer can pick a review depth before reading the diff. It complements the PR body, which describes the change but never grades it. Keep each line to one sentence.

```markdown
## Factory assessment

**Fit:** <implements the issue fully | partially, and what is left>
**Evidence:** <the failing test or probe before the change, and the commands that passed after it>
**Risk:** side effects <none/low/medium/high>, performance <…>, backwards compatibility <…>, from the area reviewers
**Review depth:** <glance | focused | deep>, because <reason>
```

Review depth:

- **glance**: only docs, tests or comments change.
- **deep**: the change touches a public API, a GraphQL or OpenAPI schema, a migration, auth or permissions, or any risk is medium or high.
- **focused**: everything else.
