# Phoenix CLI Package Summary

## Overview

This document provides a comprehensive overview of the Phoenix CLI package created using python-fire. The CLI supports connecting to remote Phoenix instances, managing credentials, and exporting traces and data.

## Package Structure

```
phoenix-cli/
├── src/phoenix_cli/
│   ├── __init__.py           # Package initialization
│   ├── cli.py                # Main CLI interface using python-fire
│   ├── config.py             # Configuration and credential management
│   ├── phoenix_client.py     # Phoenix client wrapper
│   ├── instances.py          # Instance management commands
│   └── export.py             # Data export functionality
├── examples/
│   └── example_usage.py      # Programmatic usage examples
├── pyproject.toml            # Modern Python package configuration
├── setup.py                  # Fallback setup configuration
├── requirements.txt          # Package dependencies
├── README.md                 # User documentation
├── LICENSE                   # MIT License
├── MANIFEST.in               # Distribution manifest
├── demo.py                   # Interactive demonstration
└── test_cli.py               # CLI testing script
```

## Key Features Implemented

### 1. Instance Management (`phoenix instances`)
- **Add instances**: Store Phoenix instance configurations with secure credential storage
- **List instances**: Display all configured instances with connection status
- **Remove instances**: Delete instance configurations and credentials
- **Test connections**: Verify connectivity to Phoenix instances
- **Default instance**: Set and manage default instance for commands

### 2. Data Export (`phoenix export`)
- **Multi-format export**: JSON, CSV, and Parquet support
- **Selective export**: Choose to export spans, annotations, and/or datasets
- **Project-specific**: Export data from specific projects
- **Batch processing**: Handle large datasets with pagination
- **Progress tracking**: Rich terminal output with progress bars

### 3. Project Management (`phoenix projects`)
- **List projects**: View available projects in Phoenix instances
- **Project selection**: Work with specific projects for export

### 4. Secure Configuration
- **Credential storage**: API keys stored in system keyring (not in config files)
- **Local configuration**: `.phoenix/` directory for instance settings
- **Encryption**: Sensitive data encrypted at rest

## Command Examples

### Instance Management
```bash
# Add instances
phoenix instances add myinstance https://phoenix.example.com --api_key abc123
phoenix instances add local http://localhost:6006 --description "Local development" --default

# List and manage instances
phoenix instances list
phoenix instances show myinstance
phoenix instances test myinstance
phoenix instances default myinstance
phoenix instances remove myinstance
```

### Data Export
```bash
# Basic export
phoenix export
phoenix export --instance myinstance --project my-project

# Format options
phoenix export --format json --limit 1000
phoenix export --format csv --limit 5000
phoenix export --format parquet --limit 10000

# Selective export
phoenix export --spans True --annotations False --datasets False
phoenix export --output_dir ./my_export --format csv
```

### Project Management
```bash
# List projects
phoenix projects
phoenix projects --instance myinstance
```

## Implementation Details

### Technology Stack
- **python-fire**: Automatic CLI generation from Python objects
- **httpx**: HTTP client for Phoenix REST API communication
- **pydantic**: Data validation and settings management
- **keyring**: Secure credential storage using system keyring
- **rich**: Beautiful terminal output with tables and progress bars
- **pandas**: Data manipulation and export functionality
- **cryptography**: Additional encryption for sensitive data

### Architecture
- **Modular design**: Separate modules for different functionality
- **Clean API**: Follows Phoenix client design guidelines
- **Error handling**: Graceful error messages and recovery
- **Configuration management**: Persistent settings with defaults
- **Security**: Secure credential storage and encryption

### Configuration Storage
The CLI stores configuration in a `.phoenix/` directory:
```
.phoenix/
├── config.json          # Instance configurations (no credentials)
├── .key                 # Encryption key for sensitive data
└── exports/             # Export directories
    ├── phoenix_export_instance1_project1/
    │   ├── project.json
    │   ├── spans.json
    │   ├── annotations.json
    │   ├── datasets.json
    │   └── export_summary.json
    └── phoenix_export_instance2_project2/
```

## Example Workflows

### Basic Setup and Export
```bash
# 1. Add Phoenix instance
phoenix instances add prod https://prod.phoenix.com --api_key prod-key --default

# 2. Test connection
phoenix instances test prod

# 3. List available projects
phoenix projects --instance prod

# 4. Export data
phoenix export --instance prod --project main-project --format csv
```

### Multi-Instance Management
```bash
# Add multiple instances
phoenix instances add dev https://dev.phoenix.com --api_key dev-key
phoenix instances add staging https://staging.phoenix.com --api_key staging-key
phoenix instances add prod https://prod.phoenix.com --api_key prod-key --default

# List all instances
phoenix instances list

# Export from different instances
phoenix export --instance dev --project experiment1
phoenix export --instance staging --project load-test
phoenix export --instance prod --project production-traces
```

### Data Analysis Workflow
```bash
# Export large dataset for analysis
phoenix export --format parquet --limit 100000

# Export specific data types
phoenix export --annotations True --spans False --datasets False
```

## Installation and Usage

### Installation
```bash
pip install phoenix-cli
```

### Usage
1. Add a Phoenix instance:
   ```bash
   phoenix instances add myinstance https://phoenix.example.com --api_key your-key
   ```

2. Export data:
   ```bash
   phoenix export --instance myinstance --project myproject
   ```

## Dependencies

### Core Dependencies
- `fire>=0.5.0` - CLI framework
- `httpx>=0.24.0` - HTTP client
- `pydantic>=2.0.0` - Data validation
- `rich>=13.0.0` - Terminal output
- `pandas>=1.5.0` - Data manipulation
- `keyring>=24.0.0` - Credential storage
- `cryptography>=3.4.0` - Encryption

### Development Dependencies
- `pytest>=7.0.0` - Testing framework
- `black>=23.0.0` - Code formatting
- `isort>=5.0.0` - Import sorting
- `mypy>=1.0.0` - Type checking

## Development and Testing

### Running Tests
```bash
python test_cli.py
```

### Running Examples
```bash
python examples/example_usage.py
python demo.py
```

### Package Development
```bash
# Install in development mode
pip install -e .

# Format code
black src/
isort src/

# Type checking
mypy src/
```

## Security Features

1. **Secure Credential Storage**: API keys stored in system keyring, not in configuration files
2. **Encryption**: Additional encryption layer for sensitive data
3. **File Permissions**: Restricted access to configuration files
4. **Connection Testing**: Verify connections before storing credentials

## Error Handling

The CLI includes comprehensive error handling:
- Connection failures with helpful messages
- Invalid configuration warnings
- Graceful degradation when dependencies are missing
- User-friendly error messages with suggestions

## Extension Points

The modular design allows for easy extension:
- Add new export formats
- Implement additional Phoenix API endpoints
- Add new instance management features
- Extend authentication methods

## Compliance with Phoenix Design Guidelines

The CLI follows Phoenix client design guidelines:
- **Namespaced methods**: Commands organized by functionality
- **Kwargs usage**: All parameters use keyword arguments
- **Action prefixes**: Methods prefixed with action verbs (get, create, list, etc.)
- **Lightweight client**: Minimal dependencies, no server-specific modules
- **JSON transport**: Uses JSON over HTTP for Phoenix communication

## Conclusion

This Phoenix CLI package provides a comprehensive command-line interface for managing Phoenix instances and exporting data. Built with python-fire, it offers:

- Easy instance management with secure credential storage
- Flexible data export with multiple formats
- Beautiful terminal interface with progress tracking
- Robust error handling and connection testing
- Extensible architecture for future enhancements

The package is ready for installation and use, providing developers and analysts with a powerful tool for interacting with Phoenix instances from the command line.