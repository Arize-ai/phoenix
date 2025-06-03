# Phoenix Data Export/Import Tools

## Overview

Comprehensive tools to export data from Phoenix server and import it into Arize, supporting:



### Supported Data Types
- **Projects** - Project metadata and structure
- **Traces** - Complete trace data with spans and relationships
- **Annotations** - Human feedback and evaluation annotations
- **Datasets** - Versioned datasets with examples and experiments
- **Prompts** - Prompt templates and versions
- **Evaluations** - Evaluation results and metrics

### Not Currently Supported
- **Experiments** - Direct experiment results migration
- **Users** - User account data
- **Evaluations/Annotations older than 14 days** - Current Druid lookback window limitation for Import (will be extended to 45 days)

## Installation

```bash
cd export
pip install -r requirements.txt
```

## Configuration

Copy the `.env.example` file to `.env` in the export directory and update the values according to your setup:

## Export Usage

Export data from any Phoenix instance:

```bash
cd export

# Export all data types
python export_all_projects.py --all

# Export specific data types
python export_all_projects.py --datasets --prompts --traces --annotations --evaluations

# Export specific projects only
python export_all_projects.py --all --project "my-project" --project "another-project"

# Export with custom settings
python export_all_projects.py --all --base-url http://localhost:6006 --export-dir my_export
```

### Export Process Order
1. **Datasets** (if selected)
2. **Prompts** (if selected)
3. **Traces and Project Metadata** (if selected)
4. **Annotations** (if selected)
5. **Evaluations** (if selected)

For annotations, you'll need to configure the annotation types in the Arize UI after running the setup guide.
See https://docs.arize.com/arize/evaluate/human-annotations#create-annotations-via-api 

## Import Usage

Import exported Phoenix data to Arize:

```bash
# Import all data types (with confirmations)
python import_to_arize.py --all

# Import specific data types
python import_to_arize.py --datasets --traces --annotations --evaluations --prompts

# Setup annotation types in Arize before importing annotations
python import_to_arize.py --setup-annotations
```

### Import Process Order
1. **Datasets** (if selected)
2. **Prompts** (if selected)
3. **Traces** (if selected) - *Requires confirmation for trace ingestion*
4. **Evaluations** (if selected) - *Requires traces to be fully ingested first*
5. **Annotations** (if selected) - *Requires setup-annotations to be run first*

### Annotation Import Requirements
For annotations, you must:
1. First run: `python import_to_arize.py --annotations`
2. Configure annotation types in the Arize UI as guided
3. Confirm annotations were configured

See: https://docs.arize.com/arize/evaluate/human-annotations#create-annotations-via-api

## Options

### Export Options

#### Data Types
- `--all`: Export all data types (datasets, prompts, projects, traces, annotations, and evaluations)
- `--datasets`: Export datasets
- `--prompts`: Export prompts
- `--projects`: Export projects (includes metadata)
- `--traces`: Export traces
- `--annotations`: Export annotations
- `--evaluations`: Export evaluations

#### Target Selection
- `--project NAME`: Specify project name to export (can be used multiple times)

#### Environment Settings
- `--base-url URL`: Phoenix server base URL (default: from `PHOENIX_ENDPOINT` env var)
- `--api-key KEY`: Phoenix API key for authentication (default: from `PHOENIX_API_KEY` env var)
- `--export-dir DIR`: Directory to save exported data (default: from `PHOENIX_EXPORT_DIR` env var or "phoenix_export")

### Import Options

#### Data Types
- `--all`: Import all data types in order with confirmations
- `--datasets`: Import datasets
- `--traces`: Import traces
- `--annotations`: Import annotations
- `--evaluations`: Import evaluations (requires traces to be ingested first)
- `--prompts`: Import prompts
- `--setup-annotations`: Run annotation setup guide

#### Environment Settings
- `--api-key KEY`: Arize API key (default: from `ARIZE_API_KEY` env var)
- `--space-id ID`: Arize Space ID (default: from `ARIZE_SPACE_ID` env var)
- `--export-dir DIR`: Phoenix export directory (default: from `PHOENIX_EXPORT_DIR` env var or "phoenix_export")

### Retry and Backoff Configuration

Both export and import include built-in retry capabilities to handle API rate limits and transient errors:

- `--max-attempts N`: Maximum number of retry attempts for API calls (default: 5)
- `--initial-backoff SEC`: Initial backoff time in seconds (default: 1.0)
- `--max-backoff SEC`: Maximum backoff time in seconds (default: 60.0)
- `--backoff-factor N`: Multiplier for backoff on each retry (default: 2.0)
- `--timeout SEC`: Request timeout in seconds (default: 30.0)

### Other Options
- `--verbose`: Enable verbose output for detailed logging
- `--help`: Show comprehensive help message

## Data Safeguards

### Export Safeguards
- **Incremental exports**: Previously exported data is automatically detected and skipped
- **Error recovery**: Failed exports can be resumed without re-exporting successful data

### Import Safeguards
- **Duplicate prevention**: Previously imported data is automatically detected and skipped
- **Results tracking**: All imported data is logged in the `results/` directory
- **Validation**: Data integrity checks before import operations
- **Rollback information**: Detailed logs for troubleshooting and potential rollbacks

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
    ├── project_name_1/
    │   ├── project_metadata.json
    │   ├── traces.json
    │   ├── evaluations.json
    │   └── annotations.json
    ├── project_name_2/
    │   └── ...
    └── ...

results/  # Generated during import operations
├── dataset_export_results.json
├── dataset_import_results.json
├── trace_export_results.json
├── trace_import_results.json
├── annotation_export_results.json
├── annotation_import_results.json
├── evaluation_export_results.json
├── evaluation_import_results.json
├── prompt_export_results.json
└── prompt_import_results.json
```

## Examples

### Complete Migration Workflow

1. **Export from Phoenix**:
```bash
cd export
python export_all_projects.py --all
```

2. **Import to Arize**:
```bash
python import_to_arize.py --all --verbose
# Wait for traces to be fully ingested before evaluations
# Add Annotations to each project as prompted
```

### Selective Data Migration

Export and import only specific data types:

```bash
# Export only datasets and prompts
python export_all_projects.py --datasets --prompts

# Import only datasets and prompts
python import_to_arize.py --datasets --prompts
```

### Project-Specific Export

Export data from specific projects:

```bash
python export_all_projects.py --all --project "production-app" --project "staging-app"
```

## Troubleshooting

### Export Issues
- **Connection failures**: Check `PHOENIX_ENDPOINT` and ensure the server is accessible
- **Authentication errors**: Verify `PHOENIX_API_KEY` for Phoenix Cloud instances
- **Empty exports**: May indicate permissions issues or no data in the specified projects
- **Large exports**: Use `--project` to export one project at a time to avoid timeouts

### Import Issues
- **Authentication failures**: Verify `ARIZE_API_KEY` and `ARIZE_SPACE_ID` are correct
- **Annotation import failures**: Ensure `--setup-annotations` was run and annotation types are configured in Arize UI
- **Evaluation import failures**: Ensure traces are fully ingested in Arize before importing evaluations
- **Rate limiting**: The built-in retry logic handles most rate limits, but very large imports may need to be split

### General Debugging
- **Enable verbose mode**: Use `--verbose` for detailed operation logs
- **Check results files**: Review files in `export/results/` for detailed import/export status
- **Incremental operations**: Re-run commands to resume failed operations (duplicates are automatically skipped)
- **Timeout issues**: Increase `--timeout` value for slow network connections

### Getting Help
- Check the detailed logs in the results files
- Use `--verbose` for more detailed output
- Review the Phoenix and Arize documentation for API-specific issues
- For Phoenix issues: [Phoenix Documentation](https://arize-phoenix.readthedocs.io/en/latest/)
- For Arize issues: [Arize Documentation](https://arize-client-python.readthedocs.io/en/latest/)