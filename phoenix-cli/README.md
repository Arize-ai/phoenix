# Phoenix CLI

A command-line interface for managing Phoenix instances and exporting data.

## Features

- **Instance Management**: Add, remove, list, and manage Phoenix instances
- **Secure Credential Storage**: API keys are securely stored using system keyring
- **Data Export**: Export spans, annotations, and datasets from Phoenix instances
- **Multiple Output Formats**: Support for JSON, CSV, and Parquet formats
- **Rich CLI Interface**: Beautiful terminal output with progress indicators

## Installation

```bash
pip install phoenix-cli
```

## Quick Start

### 1. Add a Phoenix Instance

```bash
# Add an instance with API key
phoenix instances add myinstance https://phoenix.example.com --api_key your-api-key

# Add as default instance
phoenix instances add prod https://prod.phoenix.com --api_key prod-key --default

# Add instance without API key (for testing)
phoenix instances add local http://localhost:6006
```

### 2. List Instances

```bash
phoenix instances list
```

### 3. Export Data

```bash
# Export all data from default instance
phoenix export

# Export from specific instance and project
phoenix export --instance myinstance --project my-project

# Export to CSV format
phoenix export --format csv --limit 5000

# Export only spans (no annotations or datasets)
phoenix export --annotations False --datasets False
```

### 4. List Projects

```bash
# List projects in default instance
phoenix projects

# List projects in specific instance
phoenix projects --instance myinstance
```

## Commands

### Instance Management

```bash
# Add instance
phoenix instances add <name> <base_url> [--api_key API_KEY] [--description DESC] [--default]

# Remove instance
phoenix instances remove <name>

# List all instances
phoenix instances list

# Show instance details
phoenix instances show [name]

# Set default instance
phoenix instances default <name>

# Test connection
phoenix instances test [name]
```

### Data Export

```bash
# Export data
phoenix export [--instance INSTANCE] [--project PROJECT] [--output_dir DIR] 
              [--format FORMAT] [--spans BOOL] [--annotations BOOL] 
              [--datasets BOOL] [--limit LIMIT]

# List projects
phoenix projects [--instance INSTANCE]
```

## Configuration

Phoenix CLI stores its configuration in a `.phoenix` directory in your current working directory:

```
.phoenix/
├── config.json          # Instance configurations
├── .key                 # Encryption key for sensitive data
└── export_*/            # Export directories
```

### Configuration Structure

Instances are stored in `config.json` with the following structure:

```json
{
  "instances": {
    "myinstance": {
      "name": "myinstance",
      "base_url": "https://phoenix.example.com",
      "description": "My Phoenix instance",
      "default": true
    }
  },
  "default_instance": "myinstance"
}
```

API keys are securely stored in your system's keyring and are not saved in the configuration file.

## Examples

### Basic Usage

```bash
# Add your Phoenix instance
phoenix instances add mycompany https://phoenix.mycompany.com --api_key your-api-key --default

# Export all data from default project
phoenix export

# Export specific project to CSV
phoenix export --project my-ai-project --format csv

# Export only spans with higher limit
phoenix export --annotations False --datasets False --limit 10000
```

### Advanced Usage

```bash
# Add multiple instances
phoenix instances add dev https://dev.phoenix.com --api_key dev-key
phoenix instances add staging https://staging.phoenix.com --api_key staging-key
phoenix instances add prod https://prod.phoenix.com --api_key prod-key --default

# Export from different instances
phoenix export --instance dev --project experiment1
phoenix export --instance staging --project load-test
phoenix export --instance prod --project production-traces

# Test all instances
phoenix instances test dev
phoenix instances test staging
phoenix instances test prod
```

## Output Formats

### JSON (default)
```bash
phoenix export --format json
```

### CSV
```bash
phoenix export --format csv
```

### Parquet
```bash
phoenix export --format parquet
```

## Export Structure

When you run an export, Phoenix CLI creates the following structure:

```
phoenix_export_<instance>_<project>/
├── project.json          # Project metadata
├── spans.json            # Spans data
├── annotations.json      # Annotations data
├── datasets.json         # Datasets data
└── export_summary.json   # Export summary and stats
```

## Requirements

- Python 3.8+
- Phoenix instance with API access
- System keyring support for secure credential storage

## Development

```bash
# Clone the repository
git clone https://github.com/Arize-ai/phoenix.git
cd phoenix/phoenix-cli

# Install in development mode
pip install -e .

# Run tests
pytest

# Format code
black src/
isort src/
```

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- GitHub Issues: https://github.com/Arize-ai/phoenix/issues
- Documentation: https://docs.arize.com/phoenix