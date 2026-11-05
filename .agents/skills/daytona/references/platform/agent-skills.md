
An agent skill for creating and running sandboxes on the Daytona platform. Includes references and practical patterns for the Daytona API, CLI, Python, TypeScript, Go, and Ruby SDKs.

## Installation

Daytona provides multiple options to install the agent skill.

### Skills

```bash
npx skills add https://github.com/daytona/skills --skill daytona
```

### Claude Code (Plugin)

```bash
claude plugin marketplace add daytona/skills
claude plugin install daytona@daytona --scope user
```

Scope options: `user` (all projects), `project` (shared via git), `local` (gitignored).

### Manual

Clone the Daytona skills repository:

```bash
git clone https://github.com/daytona/skills.git
```

Copy the `daytona` subdirectory into your agent's `skills` directory:

| **Agent**    | **Skill directory**              |
| ------------ | -------------------------------- |
| Claude Code  | **`~/.claude/skills/`**          |
| Cursor       | **`~/.cursor/skills/`**          |
| OpenCode     | **`~/.config/opencode/skills/`** |
| OpenAI Codex | **`~/.codex/skills/`**           |
| Windsurf     | **`~/.windsurf/skills/`**        |

## Usage

The agent skill loads automatically when a request involves Daytona platform or sandbox management features. To use it manually, reference the skill directly in your prompt or code.

## Structure

```text
skills/daytona/
├── SKILL.md                # Main entrypoint
└── references/             # Reference directories
    ├── api/                # API reference documentation
    ├── platform/           # Platform reference documentation
    ├── python-sdk/         # Python SDK reference documentation
    │   ├── sync/           # Sync Python SDK reference documentation
    │   └── async/          # Async Python SDK reference documentation
    ├── typescript-sdk/     # TypeScript SDK reference documentation
    ├── go-sdk/             # Go SDK reference documentation
    ├── ruby-sdk/           # Ruby SDK reference documentation
    └── cli.md              # CLI reference documentation
```

## See Also

- [Python SDK](../python-sdk/README.md)
- [TypeScript SDK](../typescript-sdk/README.md)
- [Java SDK](../java-sdk/README.md)
- [Go SDK](../go-sdk/README.md)
- [Ruby SDK](../ruby-sdk/README.md)
