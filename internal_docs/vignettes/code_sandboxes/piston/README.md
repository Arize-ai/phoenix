# Piston Playground

A Python/Flask web app that wraps a **locally deployed [Piston](https://github.com/engineer-man/piston)** code-execution engine in a polished browser-based code editor.

```
┌─────────────────────────────────────────┐
│  Browser  →  Flask app  →  Piston API   │
│  :5000        :5000          :2000      │
└─────────────────────────────────────────┘
```

## Features

- Multi-language playground: Python, JavaScript, TypeScript, Rust, C++, Java, Bash
- CodeMirror 6 editor with syntax highlighting and keyboard shortcuts
- Live stdout / stderr / compile-output display with exit-code and timing metadata
- Optional stdin input
- Built-in example snippets per language
- Piston connection status indicator

## Quick start (Docker Compose)

> **Requires:** Docker ≥ 24 with [cgroup v2](https://docs.docker.com/engine/install/) enabled.  
> Piston uses Linux namespaces and `--privileged`, which works on Linux and on Docker Desktop for Mac/Windows.

```bash
cd examples/piston-playground

# 1. Build and start everything (Piston + init + playground)
docker compose up --build

# The first run takes a few minutes while Piston downloads language runtimes.
# Watch the piston-init logs to track progress:
docker compose logs -f piston-init

# 2. Open the playground
open http://localhost:5000
```

After Piston finishes installing runtimes (one-time, cached in a Docker volume), the playground is ready.

### Installing additional runtimes

```bash
# List all available packages
curl http://localhost:2000/api/v2/packages

# Install a specific language (e.g. Go)
curl -X POST http://localhost:2000/api/v2/packages \
  -H 'Content-Type: application/json' \
  -d '{"language": "go", "version": "*"}'
```

Or use the provided helper script (runs against localhost:2000 by default):

```bash
chmod +x init-runtimes.sh
./init-runtimes.sh
```

## Running the Flask app without Docker

Useful for development — point it at a running Piston container.

```bash
# Start Piston only
docker compose up -d piston piston-init

# Install dependencies
pip install -r requirements.txt

# Run the dev server
PISTON_URL=http://localhost:2000 python app.py
```

## Project structure

```
piston-playground/
├── app.py               # Flask app — proxies execution requests to Piston
├── requirements.txt     # Python deps (flask, httpx, gunicorn)
├── Dockerfile           # Web app container
├── docker-compose.yml   # Piston + init + playground services
├── init-runtimes.sh     # Helper script to install runtimes manually
└── templates/
    └── index.html       # Single-page UI (CodeMirror 6, no build step)
```

## API

The Flask app exposes three endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Playground UI |
| GET | `/api/runtimes` | List installed language runtimes |
| POST | `/api/execute` | Execute code via Piston |
| GET | `/health` | Health check (app + Piston status) |

### Execute request

```json
{
  "language": "python",
  "source": "print('hello')",
  "stdin": "",
  "args": []
}
```

### Execute response

```json
{
  "stdout": "hello\n",
  "stderr": "",
  "compile_output": "",
  "exit_code": 0,
  "status": null,
  "cpu_time": 12,
  "wall_time": 45,
  "language": "python",
  "version": "3.12.0"
}
```

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` / `⌘+Enter` | Run code |
| `Tab` | Indent |
| `Ctrl+Z` / `⌘+Z` | Undo |
