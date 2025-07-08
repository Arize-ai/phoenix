"""Main CLI module for Phoenix CLI using python-fire."""

import sys
from typing import Optional

import fire

from phoenix_cli.config import ConfigManager
from phoenix_cli.instances import InstanceManager
from phoenix_cli.export import ExportManager


class PhoenixCLI:
    """Phoenix CLI - Command-line interface for Phoenix instances management and data export."""
    
    def __init__(self):
        """Initialize the Phoenix CLI."""
        self.config_manager = ConfigManager()
        self.instances = InstanceManager(self.config_manager)
        self.export_manager = ExportManager(self.config_manager)
    
    def export(
        self,
        instance: Optional[str] = None,
        project: str = "default",
        output_dir: Optional[str] = None,
        format: str = "json",
        spans: bool = True,
        annotations: bool = True,
        datasets: bool = True,
        limit: int = 1000
    ) -> None:
        """Export data from a Phoenix instance.
        
        Args:
            instance: Phoenix instance name (uses default if not specified)
            project: Project ID or name to export (default: "default")
            output_dir: Output directory path
            format: Output format ('json', 'csv', 'parquet')
            spans: Whether to include spans (default: True)
            annotations: Whether to include annotations (default: True)
            datasets: Whether to include datasets (default: True)
            limit: Maximum number of records to export (default: 1000)
        
        Examples:
            phoenix export --instance myinstance --project myproject
            phoenix export --format csv --limit 5000
            phoenix export --instance prod --spans False --annotations False
        """
        self.export_manager.export_project_data(
            instance_name=instance,
            project_identifier=project,
            output_dir=output_dir,
            output_format=format,
            include_spans=spans,
            include_annotations=annotations,
            include_datasets=datasets,
            limit=limit
        )
    
    def projects(self, instance: Optional[str] = None) -> None:
        """List projects in a Phoenix instance.
        
        Args:
            instance: Phoenix instance name (uses default if not specified)
        
        Examples:
            phoenix projects
            phoenix projects --instance myinstance
        """
        self.export_manager.list_project_info(instance_name=instance)


class InstancesCLI:
    """Instance management commands."""
    
    def __init__(self, config_manager: ConfigManager):
        """Initialize instances CLI."""
        self.manager = InstanceManager(config_manager)
    
    def add(
        self,
        name: str,
        base_url: str,
        api_key: Optional[str] = None,
        description: Optional[str] = None,
        default: bool = False
    ) -> None:
        """Add a new Phoenix instance.
        
        Args:
            name: Instance name
            base_url: Base URL of the Phoenix instance
            api_key: API key for authentication
            description: Instance description
            default: Whether to set this as the default instance
        
        Examples:
            phoenix instances add myinstance https://phoenix.example.com
            phoenix instances add prod https://prod.phoenix.com --api_key abc123 --default
        """
        self.manager.add(
            name=name,
            base_url=base_url,
            api_key=api_key,
            description=description,
            set_default=default
        )
    
    def remove(self, name: str) -> None:
        """Remove a Phoenix instance.
        
        Args:
            name: Instance name to remove
        
        Examples:
            phoenix instances remove myinstance
        """
        self.manager.remove(name)
    
    def list(self) -> None:
        """List all configured instances.
        
        Examples:
            phoenix instances list
        """
        self.manager.list()
    
    def default(self, name: str) -> None:
        """Set the default instance.
        
        Args:
            name: Instance name to set as default
        
        Examples:
            phoenix instances default myinstance
        """
        self.manager.set_default(name)
    
    def show(self, name: Optional[str] = None) -> None:
        """Show details of an instance.
        
        Args:
            name: Instance name to show. If None, shows default instance.
        
        Examples:
            phoenix instances show myinstance
            phoenix instances show  # Shows default instance
        """
        self.manager.show(name)
    
    def test(self, name: Optional[str] = None) -> None:
        """Test connection to an instance.
        
        Args:
            name: Instance name to test. If None, tests default instance.
        
        Examples:
            phoenix instances test myinstance
            phoenix instances test  # Tests default instance
        """
        self.manager.test(name)


def main():
    """Main entry point for the Phoenix CLI."""
    # Create the main CLI instance
    cli = PhoenixCLI()
    
    # Attach the instances sub-command
    cli.instances = InstancesCLI(cli.config_manager)
    
    # Use fire to create the CLI
    try:
        fire.Fire(cli)
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()