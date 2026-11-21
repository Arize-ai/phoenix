# Agent Skills

An agent skill for creating and running sandboxes on the Daytona platform.

An agent skill for creating and running sandboxes on the Daytona platform. Includes references and practical patterns for two Daytona versions: Daytona v2 (current) and Daytona v0.

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
├── SKILL.md                    # Entrypoint: version selection
└── references/
    ├── daytona-v2/
    │   ├── README.md           # Daytona v2 guide
    │   ├── api/                # API reference
    │   ├── cli/                # CLI reference
    │   ├── platform/           # Platform reference
    │   ├── python-sdk/         # Python SDK feature guides
    │   │   └── reference/      # Python SDK class and method reference
    │   └── typescript-sdk/     # TypeScript SDK feature guides
    │       └── reference/      # TypeScript SDK class and method reference
    └── daytona-v0/
        ├── README.md           # Daytona v0 guide
        ├── api/                # API reference
        ├── platform/           # Platform reference
        ├── python-sdk/         # Python SDK reference
        │   ├── sync/           # Sync Python SDK reference
        │   └── async/          # Async Python SDK reference
        ├── typescript-sdk/     # TypeScript SDK reference
        ├── java-sdk/           # Java SDK reference
        ├── go-sdk/             # Go SDK reference
        ├── ruby-sdk/           # Ruby SDK reference
        └── cli.md              # CLI reference
```
