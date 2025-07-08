"""Export functionality for Phoenix CLI."""

import json
import os
from pathlib import Path
from typing import Optional, List, Dict, Any

import pandas as pd
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeRemainingColumn

from phoenix_cli.config import ConfigManager
from phoenix_cli.phoenix_client import PhoenixCLIClient, PhoenixClientError


class ExportManager:
    """Manages data export operations."""
    
    def __init__(self, config_manager: ConfigManager):
        """Initialize export manager.
        
        Args:
            config_manager: Configuration manager instance
        """
        self.config_manager = config_manager
        self.console = Console()
    
    def export_project_data(
        self,
        instance_name: Optional[str] = None,
        project_identifier: str = "default",
        output_dir: Optional[str] = None,
        output_format: str = "json",
        include_spans: bool = True,
        include_annotations: bool = True,
        include_datasets: bool = True,
        limit: int = 1000
    ) -> None:
        """Export project data from Phoenix instance.
        
        Args:
            instance_name: Phoenix instance name (uses default if None)
            project_identifier: Project ID or name to export
            output_dir: Output directory path
            output_format: Output format ('json', 'csv', 'parquet')
            include_spans: Whether to include spans
            include_annotations: Whether to include annotations
            include_datasets: Whether to include datasets
            limit: Maximum number of records to export
        """
        # Get instance configuration
        instance = self.config_manager.get_instance(instance_name)
        if not instance:
            if instance_name:
                self.console.print(f"[red]Instance '{instance_name}' not found[/red]")
            else:
                self.console.print("[red]No default instance configured[/red]")
            return
        
        # Set up output directory
        if output_dir is None:
            output_dir = f"phoenix_export_{instance.name}_{project_identifier}"
        
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        self.console.print(f"[green]Exporting data from instance '{instance.name}' to '{output_path}'[/green]")
        
        # Initialize Phoenix client
        client = PhoenixCLIClient(instance)
        
        # Test connection
        if not client.test_connection():
            self.console.print("[red]Failed to connect to Phoenix instance[/red]")
            return
        
        try:
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TimeRemainingColumn(),
            ) as progress:
                
                # Export project metadata
                task = progress.add_task("Exporting project metadata...", total=1)
                project_data = client.get_project(project_identifier)
                if project_data:
                    self._save_data(
                        project_data,
                        output_path / f"project.{output_format}",
                        output_format
                    )
                    self.console.print(f"[green]✓ Exported project metadata[/green]")
                else:
                    self.console.print(f"[yellow]⚠ Project '{project_identifier}' not found[/yellow]")
                progress.update(task, advance=1)
                
                # Export spans
                if include_spans:
                    task = progress.add_task("Exporting spans...", total=1)
                    spans_df = client.export_spans(
                        project_identifier=project_identifier,
                        limit=limit,
                        output_format=output_format
                    )
                    if spans_df is not None and not spans_df.empty:
                        self._save_dataframe(
                            spans_df,
                            output_path / f"spans.{output_format}",
                            output_format
                        )
                        self.console.print(f"[green]✓ Exported {len(spans_df)} spans[/green]")
                    else:
                        self.console.print("[yellow]⚠ No spans found[/yellow]")
                    progress.update(task, advance=1)
                
                # Export annotations
                if include_annotations:
                    task = progress.add_task("Exporting annotations...", total=1)
                    annotations_df = client.export_annotations(
                        project_identifier=project_identifier,
                        limit=limit
                    )
                    if annotations_df is not None and not annotations_df.empty:
                        self._save_dataframe(
                            annotations_df,
                            output_path / f"annotations.{output_format}",
                            output_format
                        )
                        self.console.print(f"[green]✓ Exported {len(annotations_df)} annotations[/green]")
                    else:
                        self.console.print("[yellow]⚠ No annotations found[/yellow]")
                    progress.update(task, advance=1)
                
                # Export datasets
                if include_datasets:
                    task = progress.add_task("Exporting datasets...", total=1)
                    datasets_df = client.export_datasets(limit=limit)
                    if datasets_df is not None and not datasets_df.empty:
                        self._save_dataframe(
                            datasets_df,
                            output_path / f"datasets.{output_format}",
                            output_format
                        )
                        self.console.print(f"[green]✓ Exported {len(datasets_df)} datasets[/green]")
                    else:
                        self.console.print("[yellow]⚠ No datasets found[/yellow]")
                    progress.update(task, advance=1)
                
                # Create export summary
                self._create_export_summary(
                    output_path,
                    instance.name,
                    project_identifier,
                    output_format,
                    include_spans,
                    include_annotations,
                    include_datasets,
                    limit
                )
                
                self.console.print(f"[green]✓ Export completed successfully![/green]")
                self.console.print(f"[blue]Data exported to: {output_path.absolute()}[/blue]")
        
        except PhoenixClientError as e:
            self.console.print(f"[red]Export failed: {e}[/red]")
        except Exception as e:
            self.console.print(f"[red]Unexpected error during export: {e}[/red]")
        finally:
            client.close()
    
    def _save_data(
        self,
        data: Dict[str, Any],
        output_file: Path,
        output_format: str
    ) -> None:
        """Save data to file.
        
        Args:
            data: Data to save
            output_file: Output file path
            output_format: Output format
        """
        if output_format == "json":
            with open(output_file, "w") as f:
                json.dump(data, f, indent=2, default=str)
        else:
            # For non-JSON formats, convert to DataFrame first
            df = pd.DataFrame([data])
            self._save_dataframe(df, output_file, output_format)
    
    def _save_dataframe(
        self,
        df: pd.DataFrame,
        output_file: Path,
        output_format: str
    ) -> None:
        """Save DataFrame to file.
        
        Args:
            df: DataFrame to save
            output_file: Output file path
            output_format: Output format
        """
        if output_format == "json":
            df.to_json(output_file, orient="records", indent=2, default_handler=str)
        elif output_format == "csv":
            df.to_csv(output_file, index=False)
        elif output_format == "parquet":
            df.to_parquet(output_file, index=False)
        else:
            raise ValueError(f"Unsupported output format: {output_format}")
    
    def _create_export_summary(
        self,
        output_path: Path,
        instance_name: str,
        project_identifier: str,
        output_format: str,
        include_spans: bool,
        include_annotations: bool,
        include_datasets: bool,
        limit: int
    ) -> None:
        """Create export summary file.
        
        Args:
            output_path: Output directory path
            instance_name: Instance name
            project_identifier: Project identifier
            output_format: Output format
            include_spans: Whether spans were included
            include_annotations: Whether annotations were included
            include_datasets: Whether datasets were included
            limit: Export limit
        """
        summary = {
            "export_summary": {
                "instance_name": instance_name,
                "project_identifier": project_identifier,
                "output_format": output_format,
                "export_settings": {
                    "include_spans": include_spans,
                    "include_annotations": include_annotations,
                    "include_datasets": include_datasets,
                    "limit": limit
                },
                "exported_files": [],
                "timestamp": pd.Timestamp.now().isoformat()
            }
        }
        
        # List exported files
        for file_path in output_path.glob(f"*.{output_format}"):
            if file_path.name != "export_summary.json":
                file_stats = file_path.stat()
                summary["export_summary"]["exported_files"].append({
                    "filename": file_path.name,
                    "size_bytes": file_stats.st_size,
                    "size_mb": round(file_stats.st_size / (1024 * 1024), 2)
                })
        
        # Save summary
        summary_file = output_path / "export_summary.json"
        with open(summary_file, "w") as f:
            json.dump(summary, f, indent=2)
    
    def list_project_info(self, instance_name: Optional[str] = None) -> None:
        """List projects in Phoenix instance.
        
        Args:
            instance_name: Phoenix instance name (uses default if None)
        """
        # Get instance configuration
        instance = self.config_manager.get_instance(instance_name)
        if not instance:
            if instance_name:
                self.console.print(f"[red]Instance '{instance_name}' not found[/red]")
            else:
                self.console.print("[red]No default instance configured[/red]")
            return
        
        # Initialize Phoenix client
        client = PhoenixCLIClient(instance)
        
        # Test connection
        if not client.test_connection():
            self.console.print("[red]Failed to connect to Phoenix instance[/red]")
            return
        
        try:
            projects = client.list_projects()
            
            if not projects:
                self.console.print("[yellow]No projects found[/yellow]")
                return
            
            self.console.print(f"[green]Projects in instance '{instance.name}':[/green]")
            for project in projects:
                self.console.print(f"  • {project.get('name', 'Unknown')} (ID: {project.get('id', 'Unknown')})")
                if project.get('description'):
                    self.console.print(f"    Description: {project['description']}")
        
        except PhoenixClientError as e:
            self.console.print(f"[red]Failed to list projects: {e}[/red]")
        except Exception as e:
            self.console.print(f"[red]Unexpected error: {e}[/red]")
        finally:
            client.close()