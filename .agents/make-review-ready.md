# /make-review-ready

Reimplement the current branch with a clean, narrative-quality git commit history suitable for reviewer comprehension.

## Arguments

- `target_branch` (optional): The branch to merge into (default: `main`)
- `clean_branch_name` (optional): Name for the new clean branch (default: `{current_branch}-clean`)

## Overview

This skill takes a branch with messy commit history and creates a new branch with the same final state but with a clean, logical sequence of commits that tell a story. Each commit introduces a single coherent idea, making the PR easy to review.

## Steps

### 1. Validate the Source Branch

Before starting, validate the source branch:

- Check for uncommitted changes (must be clean)
- Check for merge conflicts with target branch
- Verify the branch is up to date with the remote

```bash
git status
git fetch origin
git log --oneline origin/{target_branch}..HEAD
```

If there are issues, stop and ask the user to resolve them first.

### 2. Analyze the Diff

Study all changes between the current branch and target branch:

```bash
git diff {target_branch}...HEAD --stat
git diff {target_branch}...HEAD
```

Form a clear understanding of:
- What files are changed
- What features/fixes are implemented
- The final intended state

### 3. Create the Clean Branch

```bash
# Save the current branch name for reference
ORIGINAL_BRANCH=$(git branch --show-current)

# Create clean branch from target
git checkout {target_branch}
git pull origin {target_branch}
git checkout -b {clean_branch_name}
```

### 4. Plan the Commit Storyline

Break the implementation into a sequence of self-contained steps. Each step should:

- Reflect a logical stage of development (as if writing a tutorial)
- Introduce a single coherent idea
- Be independently understandable

Write out the plan before implementing:

```
Commit 1: [Title] - [Description of what this introduces]
Commit 2: [Title] - [Description of what this introduces]
...
```

Consider grouping changes by:
- Dependencies/setup first
- Core functionality
- Tests for core functionality
- Integration/wiring
- UI/frontend changes
- Cleanup/refactoring

### 5. Reimplement the Work

For each planned commit:

1. Cherry-pick or manually apply the relevant changes
2. Run any necessary build/generation commands (see Special Cases below)
3. Stage the files for this commit
4. Create the commit with a clear message

**Commit Message Format:**
```
<type>: <short description>

<longer description if needed, explaining the "why">
```

Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`

### 6. Verify Correctness

The final state of the clean branch MUST exactly match the original branch.

```bash
# Compare the two branches (should show no differences)
git diff {original_branch}..{clean_branch_name}
```

If there are differences, identify what's missing and add additional commits.

### 7. Push and Create PR

```bash
git push -u origin {clean_branch_name}
```

Create a PR with:
- Clear title describing the feature/fix
- Summary of changes
- Link to the original branch for reference
- Test plan

## Special Cases

### Modifying prompts/ Directory

After modifying any files under `prompts/`, run:

```bash
tox -e compile_prompts
```

Then commit the generated files in the same commit or a follow-up `chore:` commit.

### Pre-commit Hook Failures

Use `--no-verify` sparingly when:
- Intermediate commits intentionally don't pass all checks
- Known issues that will be fixed in later commits

```bash
git commit --no-verify -m "..."
```

The final commit MUST pass all checks.

### Merge Conflicts

If merge conflicts arise when rebasing onto the target branch:
1. Resolve conflicts carefully
2. Ensure the Mustache-related (or feature-specific) changes are preserved
3. Run linting/type checks after resolution

## Important Rules

**NEVER include in commit messages:**
- `Co-Authored-By:` lines
- `Generated with [Claude Code]` or similar attribution
- Time estimates or predictions

**ALWAYS:**
- Read files before modifying them
- Run tests/linters after significant changes
- Verify final state matches original branch

## Verification Checklist

Before considering the task complete:

- [ ] Clean branch has logical, narrative commit history
- [ ] Each commit introduces a single coherent idea
- [ ] No `Co-Authored-By` or AI attribution lines in commits
- [ ] `git diff {original_branch}..{clean_branch_name}` shows no differences
- [ ] All CI checks pass (ruff, mypy, TypeScript, tests)
- [ ] PR created with link to original branch

## Example Usage

```
User: /make-review-ready target_branch=version-13

Agent: I'll create a clean version of this branch for merging into version-13.

1. Validating source branch...
   - No uncommitted changes
   - 45 commits ahead of version-13
   - No merge conflicts detected

2. Analyzing diff...
   - 15 files changed
   - Main feature: Mustache template support

3. Creating clean branch: ehutt/feature-branch-clean

4. Planned commit storyline:
   - Commit 1: feat: add pystache dependency
   - Commit 2: feat: upgrade MustacheTemplateFormatter
   - Commit 3: feat: add parse_with_types() method
   ...

5. Reimplementing...
   [commits created]

6. Verifying correctness...
   - Final state matches original branch exactly

7. Creating PR...
   - PR #123 created: https://github.com/org/repo/pull/123
```
