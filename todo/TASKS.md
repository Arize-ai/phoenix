# Project Tasks

Task tracker for multi-agent development.
Each agent picks the next pending task, implements it, and marks it complete.

## How to Use

1. Find the first task with `status: pending` where ALL dependencies have `status: complete`
2. Change that task's status to `in_progress`
3. Implement the task
4. Write and run tests
5. Change the task's status to `complete`
6. Append learnings to LEARNINGS.md
7. Commit with message: `feat: <task-id> - <description>`
8. EXIT

## Task Statuses

- `pending` - Not started
- `in_progress` - Currently being worked on
- `complete` - Done and committed

---

## Phase 1: Discovery

### locate-tag-version-ui

- content: Find the tag version button + modal on prompt versions page and note required props/data.
- status: complete
- dependencies: none

## Phase 2: Playground UI

### add-tagging-entrypoint

- content: Add the existing tag version action to the `/playground` page UI.
- status: complete
- dependencies: locate-tag-version-ui

### wire-tag-modal-playground

- content: Reuse the tag creation modal/dropdown in playground with prompt version data wiring.
- status: pending
- dependencies: add-tagging-entrypoint

## Phase 3: Verification

### verify-playground-tagging

- content: Manually verify the `/playground` tagging flow; skip automated tests.
- status: pending
- dependencies: wire-tag-modal-playground
