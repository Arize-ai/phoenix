#!/usr/bin/env python3
"""Example usage of Phoenix CLI programmatically."""

import sys
import tempfile
from pathlib import Path

# Add the src directory to Python path for development
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from phoenix_cli.config import ConfigManager
from phoenix_cli.instances import InstanceManager
from phoenix_cli.export import ExportManager


def main():
    """Demonstrate Phoenix CLI functionality."""
    print("Phoenix CLI Example Usage")
    print("=" * 50)
    
    # Create a temporary directory for this example
    with tempfile.TemporaryDirectory() as temp_dir:
        config_dir = Path(temp_dir) / ".phoenix"
        
        # Initialize configuration manager
        config_manager = ConfigManager(config_dir)
        
        # Example 1: Add instances
        print("\n1. Adding Phoenix instances...")
        instance_manager = InstanceManager(config_manager)
        
        # Add a local instance
        instance_manager.add(
            name="local",
            base_url="http://localhost:6006",
            description="Local Phoenix instance",
            set_default=True
        )
        
        # Add a production-like instance (this would normally have an API key)
        instance_manager.add(
            name="prod",
            base_url="https://phoenix.example.com",
            description="Production Phoenix instance"
        )
        
        # Example 2: List instances
        print("\n2. Listing instances...")
        instance_manager.list()
        
        # Example 3: Show instance details
        print("\n3. Showing default instance details...")
        instance_manager.show()
        
        # Example 4: Test connection (this will likely fail unless you have a Phoenix instance running)
        print("\n4. Testing connection to local instance...")
        instance_manager.test("local")
        
        # Example 5: Export data (this will fail if no Phoenix instance is running)
        print("\n5. Attempting to export data...")
        export_manager = ExportManager(config_manager)
        
        try:
            export_manager.export_project_data(
                instance_name="local",
                project_identifier="default",
                output_dir=str(Path(temp_dir) / "export"),
                output_format="json",
                limit=10  # Small limit for example
            )
        except Exception as e:
            print(f"Export failed (expected if no Phoenix instance is running): {e}")
        
        # Example 6: List projects (this will fail if no Phoenix instance is running)
        print("\n6. Attempting to list projects...")
        try:
            export_manager.list_project_info("local")
        except Exception as e:
            print(f"List projects failed (expected if no Phoenix instance is running): {e}")
        
        print("\nExample completed!")
        print(f"Configuration was stored in: {config_dir}")
        print("In a real scenario, you would use the 'phoenix' command directly.")


if __name__ == "__main__":
    main()