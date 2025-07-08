"""Phoenix client wrapper for CLI operations."""

import sys
from typing import Optional, List, Dict, Any
from pathlib import Path

import httpx
import pandas as pd

from phoenix_cli.config import PhoenixInstance


class PhoenixClientError(Exception):
    """Exception raised for Phoenix client errors."""
    pass


class PhoenixCLIClient:
    """Phoenix client wrapper for CLI operations."""
    
    def __init__(self, instance: PhoenixInstance):
        """Initialize Phoenix client.
        
        Args:
            instance: Phoenix instance configuration
        """
        self.instance = instance
        self._client = None
        self._initialize_client()
    
    def _initialize_client(self) -> None:
        """Initialize the Phoenix client."""
        try:
            # Try to import the Phoenix client
            # This assumes the phoenix-client package is installed
            from phoenix.client import Client
            
            self._client = Client(
                base_url=self.instance.base_url,
                api_key=self.instance.api_key
            )
        except ImportError:
            # Fallback to direct HTTP client if phoenix-client is not available
            print("Warning: phoenix-client package not found. Using direct HTTP client.")
            self._client = httpx.Client(
                base_url=self.instance.base_url,
                headers={"Authorization": f"Bearer {self.instance.api_key}"} if self.instance.api_key else {}
            )
    
    def test_connection(self) -> bool:
        """Test connection to Phoenix instance.
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            if hasattr(self._client, 'projects'):
                # Using Phoenix client
                projects = self._client.projects.list()
                return True
            else:
                # Using direct HTTP client
                response = self._client.get("/v1/projects")
                return response.status_code == 200
        except Exception as e:
            print(f"Connection test failed: {e}")
            return False
    
    def list_projects(self) -> List[Dict[str, Any]]:
        """List all projects in the Phoenix instance.
        
        Returns:
            List of project dictionaries
        """
        try:
            if hasattr(self._client, 'projects'):
                # Using Phoenix client
                projects = self._client.projects.list()
                return [dict(project) for project in projects]
            else:
                # Using direct HTTP client
                response = self._client.get("/v1/projects")
                response.raise_for_status()
                data = response.json()
                return data.get("data", [])
        except Exception as e:
            raise PhoenixClientError(f"Failed to list projects: {e}")
    
    def get_project(self, project_identifier: str) -> Optional[Dict[str, Any]]:
        """Get project details.
        
        Args:
            project_identifier: Project ID or name
            
        Returns:
            Project dictionary or None if not found
        """
        try:
            if hasattr(self._client, 'projects'):
                # Using Phoenix client
                project = self._client.projects.get(project_name=project_identifier)
                return dict(project)
            else:
                # Using direct HTTP client
                response = self._client.get(f"/v1/projects/{project_identifier}")
                response.raise_for_status()
                data = response.json()
                return data.get("data")
        except Exception as e:
            print(f"Failed to get project '{project_identifier}': {e}")
            return None
    
    def export_spans(
        self, 
        project_identifier: str = "default", 
        limit: int = 1000,
        output_format: str = "json"
    ) -> Optional[pd.DataFrame]:
        """Export spans from a project.
        
        Args:
            project_identifier: Project ID or name
            limit: Maximum number of spans to export
            output_format: Output format ('json', 'csv', 'parquet')
            
        Returns:
            DataFrame containing spans or None if failed
        """
        try:
            if hasattr(self._client, 'spans'):
                # Using Phoenix client
                spans_df = self._client.spans.get_spans_dataframe(
                    project_identifier=project_identifier,
                    limit=limit
                )
                return spans_df
            else:
                # Using direct HTTP client - simplified version
                response = self._client.post(
                    "/v1/spans",
                    params={"project_name": project_identifier},
                    json={
                        "queries": [{}],
                        "limit": limit
                    }
                )
                response.raise_for_status()
                data = response.json()
                
                # Convert to DataFrame
                if data.get("data"):
                    import pandas as pd
                    return pd.DataFrame(data["data"])
                else:
                    return pd.DataFrame()
        except Exception as e:
            raise PhoenixClientError(f"Failed to export spans: {e}")
    
    def export_annotations(
        self, 
        project_identifier: str = "default",
        span_ids: Optional[List[str]] = None,
        limit: int = 1000
    ) -> Optional[pd.DataFrame]:
        """Export annotations from a project.
        
        Args:
            project_identifier: Project ID or name
            span_ids: List of span IDs to get annotations for
            limit: Maximum number of annotations to export
            
        Returns:
            DataFrame containing annotations or None if failed
        """
        try:
            if hasattr(self._client, 'spans'):
                # Using Phoenix client
                if span_ids:
                    annotations_df = self._client.spans.get_span_annotations_dataframe(
                        span_ids=span_ids,
                        project_identifier=project_identifier,
                        limit=limit
                    )
                else:
                    # Get all spans first, then their annotations
                    spans_df = self._client.spans.get_spans_dataframe(
                        project_identifier=project_identifier,
                        limit=limit
                    )
                    if not spans_df.empty:
                        annotations_df = self._client.spans.get_span_annotations_dataframe(
                            spans_dataframe=spans_df,
                            project_identifier=project_identifier,
                            limit=limit
                        )
                    else:
                        annotations_df = pd.DataFrame()
                return annotations_df
            else:
                # Using direct HTTP client - simplified version
                if not span_ids:
                    # Get spans first
                    spans_response = self._client.post(
                        "/v1/spans",
                        params={"project_name": project_identifier},
                        json={
                            "queries": [{}],
                            "limit": limit
                        }
                    )
                    spans_response.raise_for_status()
                    spans_data = spans_response.json()
                    
                    # Extract span IDs
                    span_ids = [
                        span.get("context", {}).get("span_id")
                        for span in spans_data.get("data", [])
                        if span.get("context", {}).get("span_id")
                    ]
                
                if span_ids:
                    response = self._client.get(
                        f"/v1/projects/{project_identifier}/span_annotations",
                        params={"span_ids": span_ids, "limit": limit}
                    )
                    response.raise_for_status()
                    data = response.json()
                    
                    # Convert to DataFrame
                    if data.get("data"):
                        import pandas as pd
                        return pd.DataFrame(data["data"])
                
                return pd.DataFrame()
        except Exception as e:
            raise PhoenixClientError(f"Failed to export annotations: {e}")
    
    def export_datasets(self, limit: int = 1000) -> Optional[pd.DataFrame]:
        """Export datasets from the Phoenix instance.
        
        Args:
            limit: Maximum number of datasets to export
            
        Returns:
            DataFrame containing datasets or None if failed
        """
        try:
            if hasattr(self._client, 'datasets'):
                # Using Phoenix client
                datasets = self._client.datasets.list()
                return pd.DataFrame([dict(dataset) for dataset in datasets])
            else:
                # Using direct HTTP client
                response = self._client.get("/v1/datasets", params={"limit": limit})
                response.raise_for_status()
                data = response.json()
                
                # Convert to DataFrame
                if data.get("data"):
                    import pandas as pd
                    return pd.DataFrame(data["data"])
                else:
                    return pd.DataFrame()
        except Exception as e:
            raise PhoenixClientError(f"Failed to export datasets: {e}")
    
    def close(self) -> None:
        """Close the client connection."""
        if hasattr(self._client, 'close'):
            self._client.close()