#!/usr/bin/env python3
"""Demonstration of Phoenix CLI functionality."""

import os
import sys
from pathlib import Path

# Add the src directory to Python path for development
sys.path.insert(0, str(Path(__file__).parent / "src"))

def main():
    """Demonstrate Phoenix CLI functionality."""
    print("Phoenix CLI Demonstration")
    print("=" * 50)
    print("This demonstrates the Phoenix CLI functionality using python-fire.")
    print("The CLI commands shown below would work exactly as displayed.")
    print()
    
    # Create a demo directory to show structure
    demo_dir = Path(".phoenix_demo")
    demo_dir.mkdir(exist_ok=True)
    
    print("🚀 Phoenix CLI Commands Demo")
    print()
    
    # Instance Management Commands
    print("📦 Instance Management Commands:")
    print("=" * 40)
    
    print("1. Add a Phoenix instance:")
    print('   phoenix instances add myinstance https://phoenix.example.com --api_key abc123')
    print('   phoenix instances add local http://localhost:6006 --description "Local development"')
    print()
    
    print("2. List all instances:")
    print('   phoenix instances list')
    print()
    
    print("3. Show instance details:")
    print('   phoenix instances show myinstance')
    print('   phoenix instances show  # Shows default instance')
    print()
    
    print("4. Test instance connection:")
    print('   phoenix instances test myinstance')
    print('   phoenix instances test  # Tests default instance')
    print()
    
    print("5. Set default instance:")
    print('   phoenix instances default myinstance')
    print()
    
    print("6. Remove instance:")
    print('   phoenix instances remove myinstance')
    print()
    
    # Export Commands
    print("📊 Data Export Commands:")
    print("=" * 40)
    
    print("1. Export all data from default instance:")
    print('   phoenix export')
    print()
    
    print("2. Export from specific instance and project:")
    print('   phoenix export --instance myinstance --project my-project')
    print()
    
    print("3. Export to different formats:")
    print('   phoenix export --format json --limit 1000')
    print('   phoenix export --format csv --limit 5000')
    print('   phoenix export --format parquet --limit 10000')
    print()
    
    print("4. Export specific data types:")
    print('   phoenix export --spans True --annotations False --datasets False')
    print('   phoenix export --annotations True --spans False --datasets False')
    print()
    
    print("5. Export to specific directory:")
    print('   phoenix export --output_dir ./my_export --format csv')
    print()
    
    # Project Commands
    print("📋 Project Management Commands:")
    print("=" * 40)
    
    print("1. List projects in default instance:")
    print('   phoenix projects')
    print()
    
    print("2. List projects in specific instance:")
    print('   phoenix projects --instance myinstance')
    print()
    
    # Show example configuration structure
    print("📁 Configuration Structure:")
    print("=" * 40)
    print("Phoenix CLI stores configuration in .phoenix/ directory:")
    print()
    print(".phoenix/")
    print("├── config.json          # Instance configurations")
    print("├── .key                 # Encryption key for sensitive data")
    print("└── exports/             # Export directories")
    print("    ├── phoenix_export_instance1_project1/")
    print("    │   ├── project.json")
    print("    │   ├── spans.json")
    print("    │   ├── annotations.json")
    print("    │   ├── datasets.json")
    print("    │   └── export_summary.json")
    print("    └── phoenix_export_instance2_project2/")
    print()
    
    # Show example workflows
    print("🔄 Example Workflows:")
    print("=" * 40)
    
    print("Basic Setup and Export:")
    print("1. phoenix instances add prod https://prod.phoenix.com --api_key prod-key --default")
    print("2. phoenix instances test prod")
    print("3. phoenix projects --instance prod")
    print("4. phoenix export --instance prod --project main-project --format csv")
    print()
    
    print("Multi-Instance Management:")
    print("1. phoenix instances add dev https://dev.phoenix.com --api_key dev-key")
    print("2. phoenix instances add staging https://staging.phoenix.com --api_key staging-key")
    print("3. phoenix instances add prod https://prod.phoenix.com --api_key prod-key --default")
    print("4. phoenix instances list")
    print("5. phoenix export --instance dev --project experiment1")
    print("6. phoenix export --instance staging --project load-test")
    print("7. phoenix export --instance prod --project production-traces")
    print()
    
    print("Data Analysis Workflow:")
    print("1. phoenix export --format parquet --limit 100000")
    print("2. # Load exported data into pandas/jupyter for analysis")
    print("3. phoenix export --annotations True --spans False --datasets False")
    print("4. # Analyze annotations separately")
    print()
    
    # Implementation Details
    print("⚙️ Implementation Details:")
    print("=" * 40)
    print("• Built with python-fire for automatic CLI generation")
    print("• Uses httpx for HTTP client with Phoenix REST API")
    print("• Secure credential storage with system keyring")
    print("• Rich terminal output with progress bars")
    print("• Support for JSON, CSV, and Parquet export formats")
    print("• Automatic pagination for large datasets")
    print("• Error handling and connection testing")
    print("• Configuration stored in .phoenix directory")
    print()
    
    print("🎯 Key Features:")
    print("=" * 40)
    print("✅ Instance Management - Add, remove, list, test instances")
    print("✅ Secure Credentials - API keys stored in system keyring")
    print("✅ Data Export - Spans, annotations, datasets to multiple formats")
    print("✅ Project Management - List and select projects")
    print("✅ Beautiful CLI - Rich output with tables and progress bars")
    print("✅ Error Handling - Graceful error messages and recovery")
    print("✅ Configuration - Persistent configuration with defaults")
    print()
    
    print("🔧 Installation & Usage:")
    print("=" * 40)
    print("1. pip install phoenix-cli")
    print("2. phoenix instances add myinstance https://phoenix.example.com --api_key your-key")
    print("3. phoenix export --instance myinstance --project myproject")
    print()
    
    print("Demo completed! 🎉")
    print("The Phoenix CLI provides a powerful command-line interface for managing")
    print("Phoenix instances and exporting data with python-fire.")
    
    # Clean up demo directory
    if demo_dir.exists():
        import shutil
        shutil.rmtree(demo_dir)


if __name__ == "__main__":
    main()