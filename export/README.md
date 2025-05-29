# Phoenix Data Export/Import Tools

## Overview

Tools to export data from Phoenix server and import it into Arize, supporting:
- Self-hosted & Cloud instances
- Projects
- traces
- Annotations
- Datasets
- Prompts

Not Supported
 - Experiments
 - Users

Still WIP
 - Evals

## Installation

```bash
cd export
pip install -r requirements.txt
```

## Configuration

Copy the `.env.example` file to `.env` in the export directory and update the values according to your setup:

## Import Usage

```bash
cd export
python import_to_arize.py [--all] [--datasets] [--traces] [--annotations] [--prompts]
```

The import process follows this sequence:
1. Datasets (if selected)
2. Prompts (if selected)
3. Traces (if selected)
4. Annotations setup and import (if selected)

For annotations, you'll need to configure the annotation types in the Arize UI after running the setup guide.
See https://docs.arize.com/arize/evaluate/human-annotations#create-annotations-via-api 

The import process includes safeguards against data duplication:
- All imported data is logged in the `results/` directory
- If the script is run again, previously imported data will be automatically skipped

## Export Usage

```bash
python export_all_projects.py [--all] [--datasets] [--traces] [--prompts] [--annotations] [--projects]
```

## Options

### Export Types

- `--all`: Export all data types (datasets, prompts, projects, traces, and annotations)
- `--datasets`: Export datasets
- `--prompts`: Export prompts
- `--projects`: Export projects (includes metadata)
- `--traces`: Export traces
- `--annotations`: Export annotations

### Target Selection

- `--project NAME`: Specify project name to export (can be used multiple times)

### Environment Settings

- `--base-url URL`: Phoenix server base URL (default: from `PHOENIX_BASE_URL` env var)
- `--api-key KEY`: Phoenix API key for authentication (default: from `PHOENIX_API_KEY` env var)
- `--export-dir DIR`: Directory to save exported data (default: from `PHOENIX_EXPORT_DIR` env var or "phoenix_export")

### Retry and Backoff Configuration

The exporter includes built-in retry capabilities to handle API rate limits and transient errors:

- `--max-attempts N`: Maximum number of retry attempts for API calls (default: 5)
- `--initial-backoff SEC`: Initial backoff time in seconds (default: 1.0)
- `--max-backoff SEC`: Maximum backoff time in seconds (default: 60.0)
- `--backoff-factor N`: Multiplier for backoff on each retry (default: 2.0)
- `--timeout SEC`: Request timeout in seconds (default: 30.0)

### Other Options

- `--verbose`: Enable verbose output
- `--help`: Show help message

## Output Structure

```
phoenix_export/
├── datasets/
│   ├── datasets.json
│   ├── dataset_{id}_examples.json
│   └── dataset_{id}_experiments.json
├── prompts/
│   └── prompts.json
└── projects/
    ├── project1/
    │   ├── project_metadata.json
    │   ├── traces.json
    │   ├── evaluations.json
    │   └── annotations.json
    └── ...
```

## Troubleshooting

- If connection fails, check `PHOENIX_ENDPOINT` and ensure the server is running
- Empty project exports might indicate permissions or data issues
- For large exports, use `--project` to export one project at a time
- For annotation imports, ensure you've configured annotation types in Arize UI
- Results files in `export/results/` contain detailed information for debugging