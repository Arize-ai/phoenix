"""Instance management commands for Phoenix CLI."""

from typing import Optional

from rich.console import Console
from rich.table import Table

from phoenix_cli.config import ConfigManager
from phoenix_cli.phoenix_client import PhoenixCLIClient


class InstanceManager:
    """Manages Phoenix instance operations."""
    
    def __init__(self, config_manager: ConfigManager):
        """Initialize instance manager.
        
        Args:
            config_manager: Configuration manager instance
        """
        self.config_manager = config_manager
        self.console = Console()
    
    def add(
        self,
        name: str,
        base_url: str,
        api_key: Optional[str] = None,
        description: Optional[str] = None,
        set_default: bool = False
    ) -> None:
        """Add a new Phoenix instance.
        
        Args:
            name: Instance name
            base_url: Base URL of the Phoenix instance
            api_key: API key for authentication
            description: Instance description
            set_default: Whether to set this as the default instance
        """
        try:
            # Validate base_url format
            if not base_url.startswith(('http://', 'https://')):
                base_url = f"https://{base_url}"
            
            # Test connection before adding
            if api_key:
                from phoenix_cli.phoenix_client import PhoenixCLIClient
                from phoenix_cli.config import PhoenixInstance
                
                test_instance = PhoenixInstance(
                    name=name,
                    base_url=base_url,
                    api_key=api_key,
                    description=description
                )
                
                self.console.print(f"[blue]Testing connection to {base_url}...[/blue]")
                client = PhoenixCLIClient(test_instance)
                
                if not client.test_connection():
                    self.console.print(f"[red]Connection test failed for {base_url}[/red]")
                    self.console.print("[yellow]Do you want to add the instance anyway? (y/N)[/yellow]")
                    response = input().strip().lower()
                    if response != 'y':
                        return
                else:
                    self.console.print(f"[green]✓ Connection successful[/green]")
                
                client.close()
            
            # Add instance to configuration
            self.config_manager.add_instance(
                name=name,
                base_url=base_url,
                api_key=api_key,
                description=description,
                set_default=set_default
            )
            
            self.console.print(f"[green]✓ Instance '{name}' added successfully[/green]")
            if set_default:
                self.console.print(f"[green]✓ Set '{name}' as default instance[/green]")
                
        except Exception as e:
            self.console.print(f"[red]Failed to add instance: {e}[/red]")
    
    def remove(self, name: str) -> None:
        """Remove a Phoenix instance.
        
        Args:
            name: Instance name to remove
        """
        try:
            # Check if instance exists
            instance = self.config_manager.get_instance(name)
            if not instance:
                self.console.print(f"[red]Instance '{name}' not found[/red]")
                return
            
            # Confirm removal
            self.console.print(f"[yellow]Are you sure you want to remove instance '{name}'? (y/N)[/yellow]")
            response = input().strip().lower()
            if response != 'y':
                self.console.print("[blue]Removal cancelled[/blue]")
                return
            
            # Remove instance
            self.config_manager.remove_instance(name)
            self.console.print(f"[green]✓ Instance '{name}' removed successfully[/green]")
            
        except Exception as e:
            self.console.print(f"[red]Failed to remove instance: {e}[/red]")
    
    def list(self) -> None:
        """List all configured instances."""
        try:
            instances = self.config_manager.list_instances()
            
            if not instances:
                self.console.print("[yellow]No instances configured[/yellow]")
                self.console.print("[blue]Use 'phoenix instances add' to add an instance[/blue]")
                return
            
            table = Table(title="Phoenix Instances")
            table.add_column("Name", style="cyan", no_wrap=True)
            table.add_column("Base URL", style="magenta")
            table.add_column("Description", style="green")
            table.add_column("Default", style="yellow")
            table.add_column("Status", style="blue")
            
            for instance in instances:
                # Test connection status
                try:
                    client = PhoenixCLIClient(instance)
                    connection_status = "✓ Connected" if client.test_connection() else "✗ Failed"
                    client.close()
                except Exception:
                    connection_status = "✗ Error"
                
                table.add_row(
                    instance.name,
                    instance.base_url,
                    instance.description or "",
                    "✓" if instance.default else "",
                    connection_status
                )
            
            self.console.print(table)
            
        except Exception as e:
            self.console.print(f"[red]Failed to list instances: {e}[/red]")
    
    def set_default(self, name: str) -> None:
        """Set the default instance.
        
        Args:
            name: Instance name to set as default
        """
        try:
            # Check if instance exists
            instance = self.config_manager.get_instance(name)
            if not instance:
                self.console.print(f"[red]Instance '{name}' not found[/red]")
                return
            
            # Set as default
            self.config_manager.set_default_instance(name)
            self.console.print(f"[green]✓ Set '{name}' as default instance[/green]")
            
        except Exception as e:
            self.console.print(f"[red]Failed to set default instance: {e}[/red]")
    
    def show(self, name: Optional[str] = None) -> None:
        """Show details of an instance.
        
        Args:
            name: Instance name to show. If None, shows default instance.
        """
        try:
            instance = self.config_manager.get_instance(name)
            if not instance:
                if name:
                    self.console.print(f"[red]Instance '{name}' not found[/red]")
                else:
                    self.console.print("[red]No default instance configured[/red]")
                return
            
            # Test connection
            try:
                client = PhoenixCLIClient(instance)
                connection_status = "✓ Connected" if client.test_connection() else "✗ Failed"
                client.close()
            except Exception:
                connection_status = "✗ Error"
            
            # Display instance details
            table = Table(title=f"Instance: {instance.name}")
            table.add_column("Property", style="cyan")
            table.add_column("Value", style="magenta")
            
            table.add_row("Name", instance.name)
            table.add_row("Base URL", instance.base_url)
            table.add_row("Description", instance.description or "")
            table.add_row("Default", "✓" if instance.default else "")
            table.add_row("Has API Key", "✓" if instance.api_key else "")
            table.add_row("Status", connection_status)
            
            self.console.print(table)
            
        except Exception as e:
            self.console.print(f"[red]Failed to show instance: {e}[/red]")
    
    def test(self, name: Optional[str] = None) -> None:
        """Test connection to an instance.
        
        Args:
            name: Instance name to test. If None, tests default instance.
        """
        try:
            instance = self.config_manager.get_instance(name)
            if not instance:
                if name:
                    self.console.print(f"[red]Instance '{name}' not found[/red]")
                else:
                    self.console.print("[red]No default instance configured[/red]")
                return
            
            self.console.print(f"[blue]Testing connection to '{instance.name}' at {instance.base_url}...[/blue]")
            
            client = PhoenixCLIClient(instance)
            
            if client.test_connection():
                self.console.print(f"[green]✓ Connection successful![/green]")
                
                # Show additional info
                try:
                    projects = client.list_projects()
                    self.console.print(f"[blue]Found {len(projects)} projects[/blue]")
                except Exception as e:
                    self.console.print(f"[yellow]⚠ Could not list projects: {e}[/yellow]")
            else:
                self.console.print(f"[red]✗ Connection failed![/red]")
                self.console.print(f"[yellow]Please check the instance URL and API key[/yellow]")
            
            client.close()
            
        except Exception as e:
            self.console.print(f"[red]Failed to test instance: {e}[/red]")