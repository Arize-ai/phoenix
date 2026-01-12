# Ralph: Loop-Based Agent Development

This directory contains a **Ralph-style agent harness** for autonomous, loop-based development. Ralph runs AI coding agents in a loop until all tasks are complete, with each agent handling exactly one task per invocation.

> "That's the beauty of Ralph - the technique is deterministically bad in an undeterministic world."
> — [Geoffrey Huntley](https://ghuntley.com/ralph/)

## Overview

Ralph is a technique where you run an AI coding agent in a loop, tuning the prompt with "signs" (explicit guardrails) each time a failure mode is discovered. Over time, the agent becomes increasingly reliable.

```
┌─────────────────────────────────────────────────────────────┐
│                      ralph.sh (loop)                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  1. Check TASKS.md for pending tasks                  │  │
│  │  2. If all complete → EXIT SUCCESS                    │  │
│  │  3. Invoke agent with PROMPT.md + TASKS.md            │  │
│  │  4. Agent: pick task → implement → test → commit      │  │
│  │  5. Agent: update TASKS.md → log learnings → EXIT     │  │
│  │  6. Loop back to step 1                               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
todo/
├── README.md        # This file - methodology documentation
├── PROMPT.md        # System prompt with "signs" (guardrails)
├── TASKS.md         # Task list with status tracking
├── LEARNINGS.md     # Accumulated knowledge from completed tasks
├── ralph.sh         # Bash harness that runs the loop
└── ralph.log        # Execution log (auto-generated)
```

## Files Explained

### `PROMPT.md` - The System Prompt

Contains:
- **The Loop**: Step-by-step workflow for each agent invocation
- **Signs**: Explicit guardrails that prevent common mistakes
- **Context**: References to plan files, conventions, and tools

Signs are added whenever a failure mode is discovered. Examples:
- `SIGN: One Task Only` — Prevents scope creep
- `SIGN: Dependencies Matter` — Ensures task ordering
- `SIGN: Testing Requirements` — Clarifies when tests are needed
- `SIGN: Keep Documentation Updated` — Ensures docs stay current

### `TASKS.md` - Task Tracker

Markdown file with tasks in this format:

```markdown
### task-id

- content: Description of what to implement
- status: pending | in_progress | complete
- dependencies: task-id-1, task-id-2
```

The agent:
1. Finds the first `pending` task where all dependencies are `complete`
2. Changes status to `in_progress`
3. Does the work
4. Changes status to `complete`

### `LEARNINGS.md` - Knowledge Log

Agents append learnings after each task:

```markdown
## task-id

- Key insight or decision made
- Gotcha or pitfall discovered
- Pattern that worked well
```

Future agents read this to benefit from past discoveries.

### `ralph.sh` - The Harness

Bash script that:
1. Counts task statuses using awk (precise pattern matching)
2. Exits successfully when all tasks are complete
3. Invokes the agent with PROMPT.md and TASKS.md attached
4. Handles failures gracefully (checks for progress)
5. Logs everything to `ralph.log`

## Usage

### Running the Loop

```bash
# Default: Claude Opus 4.5
./ralph.sh

# Different model
MODEL="anthropic/claude-sonnet-4-20250514" ./ralph.sh

# Custom iteration limit
MAX_ITERATIONS=50 ./ralph.sh

# Longer pause between iterations
PAUSE_SECONDS=10 ./ralph.sh
```

### Prerequisites

1. **OpenCode CLI** installed:
   ```bash
   curl -fsSL https://opencode.ai/install | bash
   ```

2. **Permissions configured** in `../opencode.json`:
   ```json
   {
     "permission": {
       "edit": "allow",
       "bash": "allow",
       "skill": "allow",
       "webfetch": "allow",
       "doom_loop": "allow",
       "external_directory": "allow"
     }
   }
   ```

3. **Authentication** set up:
   ```bash
   opencode auth login
   ```

## Forking for a New Sprint

To create a new Ralph setup for a different project or sprint:

### 1. Copy the Structure

```bash
mkdir -p /path/to/new-project/todo
cp PROMPT.md TASKS.md LEARNINGS.md ralph.sh /path/to/new-project/todo/
```

### 2. Update PROMPT.md

- Change project-specific references (package name, paths)
- Keep the general structure and signs
- Add new signs as you discover failure modes

### 3. Replace TASKS.md

Create new tasks with the same format:

```markdown
# New Project Tasks

## How to Use
... (keep the instructions) ...

---

## Phase 1: Setup

### new-task-id

- content: Description of what to do
- status: pending
- dependencies: none
```

### 4. Clear LEARNINGS.md

Reset to the template:

```markdown
# New Project - Learnings Log

This file is appended by each agent after completing a task.

---
```

### 5. Create opencode.json

In the project root (parent of todo/):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "edit": "allow",
    "bash": "allow",
    "skill": "allow",
    "webfetch": "allow",
    "doom_loop": "allow",
    "external_directory": "allow"
  }
}
```

### 6. Run

```bash
cd /path/to/new-project/todo
./ralph.sh
```

## Task Format Reference

### Basic Task

```markdown
### task-id

- content: What to implement
- status: pending
- dependencies: none
```

### Task with Dependencies

```markdown
### dependent-task

- content: What to implement (requires other tasks first)
- status: pending
- dependencies: task-1, task-2
```

### Status Values

| Status | Meaning |
|--------|---------|
| `pending` | Not started |
| `in_progress` | Currently being worked on |
| `complete` | Done and committed |

**Important**: Status lines must be exactly `- status: <value>` (no extra whitespace) for the harness to count them correctly.

## Tuning the Prompt (Adding Signs)

When you observe a failure mode:

1. **Document the failure** in LEARNINGS.md
2. **Add a sign** to PROMPT.md:

```markdown
### SIGN: Descriptive Name

Clear explanation of what to do or avoid.

```
❌ WRONG: Example of the mistake
✅ RIGHT: Example of correct behavior
```
```

3. **Test** by running a few more iterations

Signs accumulate over time, making the agent more reliable.

## Troubleshooting

### Loop doesn't end when tasks complete

Check that status lines in TASKS.md are exactly:
```
- status: complete
```
No trailing spaces, no variations.

### Agent keeps working on wrong task

Ensure dependencies are correctly specified and marked complete.

### Agent makes same mistake repeatedly

Add a sign to PROMPT.md addressing that specific failure mode.

### Agent exits without committing

Check LEARNINGS.md for error documentation. The agent may have hit a blocker.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MODEL` | `anthropic/claude-opus-4-20250514` | Model to use |
| `MAX_ITERATIONS` | `100` | Safety limit |
| `PAUSE_SECONDS` | `3` | Pause between iterations |

## Credits

- **Ralph Methodology**: [Geoffrey Huntley](https://ghuntley.com/ralph/)
- **Agent Runtime**: [OpenCode](https://opencode.ai)
- **Original Implementation**: Phoenix Insight CLI project
