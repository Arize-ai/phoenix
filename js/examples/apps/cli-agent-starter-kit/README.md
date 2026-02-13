# CLI Agent Starter Kit

A TypeScript-based CLI agent starter kit integrated with the Vercel AI SDK and Anthropic's Claude, designed for building intelligent command-line applications with Phoenix observability skills.

## Features

- 🤖 **Anthropic Claude Integration** - Built with Vercel AI SDK for seamless LLM interactions
- 📦 **TypeScript** - Full type safety and modern JavaScript features
- 🔧 **Phoenix Skills** - Pre-configured with Phoenix CLI, Tracing, and Evals skills

## Prerequisites

- Node.js 22+ (see `.nvmrc`)
- pnpm 10.13.1+
- Anthropic API key

## Installation

```bash
# Install dependencies
pnpm install

# Copy environment template and add your API key
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

## Environment Variables

Create a `.env` file in the project root:

```bash
ANTHROPIC_API_KEY=your_api_key_here
```

## Usage

### Development Mode

Run the agent with hot reload:

```bash
pnpm dev
```

### Build for Production

Compile TypeScript to JavaScript:

```bash
pnpm build
```

### Run Production Build

Execute the compiled output:

```bash
pnpm start
```

### Clean Build Artifacts

Remove the `dist` directory:

```bash
pnpm clean
```

## Project Structure

```
cli-agent-starter-kit/
├── src/
│   └── index.ts              # Main entry point
├── dist/                     # Compiled output (generated)
├── .agents/
│   └── skills/               # Agent skills (symlinked)
│       ├── phoenix-cli
│       ├── phoenix-evals
│       └── phoenix-tracing
├── .claude/
│   └── skills/               # Claude Code skills (symlinked)
├── AGENTS.md                 # Agent configuration
├── CLAUDE.md                 # Symlink to AGENTS.md
├── tsconfig.json             # TypeScript configuration
└── package.json              # Project dependencies
```

## Available Skills

This starter kit includes symlinked Phoenix skills for enhanced functionality:

- **phoenix-cli** - Phoenix CLI management and operations
- **phoenix-tracing** - Phoenix tracing and observability features
- **phoenix-evals** - Phoenix evaluation tooling

Skills are symlinked from the Phoenix monorepo root and available in both `.agents/skills/` and `.claude/skills/` directories.

## Resources

- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Phoenix Documentation](https://arize.com/docs/phoenix)
