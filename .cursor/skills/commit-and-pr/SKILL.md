# Commit and PR Workflow Skill

## Description
Create well-formatted commits and pull requests following project conventions.

## Commands

### Check Status
```bash
git status                    # See changes
git diff                      # See unstaged changes
git diff --staged            # See staged changes
git log --oneline -5         # See recent commits
```

### Commit Changes
```bash
git add .                    # Stage all changes
git add <specific-files>     # Stage specific files
git commit -m "message"      # Commit with message
```

### Push and Create PR
```bash
git push -u origin <branch>  # Push branch
gh pr create                 # Create PR using GitHub CLI
```

## Commit Message Style

Follow the project's commit style (check recent commits):
- Use imperative mood: "Add feature" not "Added feature"
- Be concise but descriptive
- Focus on "why" not just "what"
- Reference issues when relevant

Examples:
- `Add support for async client operations`
- `Fix null pointer in span query builder`
- `Update migration guide with new patterns`

## PR Creation

When creating PRs:
1. **Check changes**: Review all files to be included
2. **Draft summary**: Summarize all commits, not just the latest
3. **Include test plan**: Checklist of testing performed
4. **Link issues**: Reference related issues/PRs

PR Format:
```markdown
## Summary
- Bullet point 1
- Bullet point 2

## Test Plan
- [ ] Tested locally
- [ ] Added unit tests
- [ ] Ran integration tests
```

## Workflow

1. Make changes
2. Run tests and linting
3. Stage changes: `git add .`
4. Commit: `git commit -m "descriptive message"`
5. Push: `git push -u origin branch-name`
6. Create PR: `gh pr create` (or use GitHub web UI)

## Tips

- Commit frequently with small, focused changes
- Push commits as you go
- Multiple small commits are better than one large commit
- Always run tests before committing
