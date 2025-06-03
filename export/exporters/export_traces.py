#!/usr/bin/env python3
"""
Phoenix Traces Exporter

This module handles exporting traces and evaluations from a Phoenix server.

Usage:
  from exporters import export_traces
  
  # Export traces for all projects
  export_traces.export_traces(
      client=client,
      output_dir="./phoenix_export/projects",
      project_names=None  # Export all projects
  )
  
  # Export traces for specific projects
  export_traces.export_traces(
      client=client,
      output_dir="./phoenix_export/projects",
      project_names=["project1", "project2"]
  )
"""

import os
import json
import logging
from typing import Dict, List, Union, Optional
import httpx
from tqdm import tqdm

from .utils import save_json, get_projects, parse_multipart_response

logger = logging.getLogger(__name__)

def get_project_metadata(client: httpx.Client, project_name: str) -> Dict:
    """Get metadata for a specific project."""
    response = client.get(f'/v1/projects/{project_name}')
    response.raise_for_status()
    return response.json()

def get_traces(client: httpx.Client, project_name: str, limit: int = 1000) -> List[Dict]:
    """Get traces for a specific project."""
    request_body = {
        "queries": [{
            "select": None,
            "filter": None,
            "explode": None,
            "concat": None,
            "rename": None,
            "index": None
        }],
        "limit": limit,
        "project_name": project_name,
        "orphan_span_as_root_span": True,
        "root_spans_only": False
    }
    
    try:
        response = client.post(
            '/v1/spans',
            json=request_body,
            params={'project_name': project_name}
        )
        response.raise_for_status()
        
        content_type = response.headers.get('content-type', '')
        
        if 'multipart/mixed' in content_type:
            traces = parse_multipart_response(response)
        else:
            data = response.json()
            traces = data.get('data', [])
        
        logger.info(f"Retrieved {len(traces)} traces for project {project_name}")
        return traces
        
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            logger.info(f"No traces found for project {project_name}")
            return []
        logger.error(f"Error fetching traces for project {project_name}: {e}")
        raise
    except json.JSONDecodeError as e:
        logger.error(f"Error decoding JSON response for project {project_name}: {e}")
        return []

def get_evaluations(client: httpx.Client, project_name: str) -> List[Dict]:
    """Get evaluations for a specific project."""
    try:
        response = client.get(
            '/v1/evaluations',
            params={'project_name': project_name}
        )
        response.raise_for_status()
        
        content_type = response.headers.get('content-type', '')
        
        if 'multipart/mixed' in content_type:
            evaluations = parse_multipart_response(response)
        else:
            data = response.json()
            evaluations = data.get('data', [])
        
        return evaluations
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            logger.info(f"No evaluations found for project {project_name}")
            return []
        raise
    except json.JSONDecodeError as e:
        logger.error(f"Error decoding evaluations response for project {project_name}: {e}")
        return []

def export_project_traces(
    client: httpx.Client, 
    project_name: str, 
    output_dir: str,
    verbose: bool = False
) -> Dict[str, Union[str, int]]:
    """Export traces and evaluations for a specific project."""
    project_dir = os.path.join(output_dir, project_name)
    os.makedirs(project_dir, exist_ok=True)
    
    result = {
        "project_name": project_name,
        "trace_count": 0,
        "evaluation_count": 0,
        "status": "exported"
    }
    
    try:
        logger.info(f"Exporting project metadata for {project_name}...")
        try:
            project_metadata = get_project_metadata(client, project_name)
            save_json(project_metadata, os.path.join(project_dir, 'project_metadata.json'))
        except Exception as e:
            logger.error(f"Error exporting metadata for project {project_name}: {e}")
        
        logger.info(f"Exporting traces for {project_name}...")
        try:
            traces = get_traces(client, project_name)
            save_json(traces, os.path.join(project_dir, 'traces.json'))
            result["trace_count"] = len(traces)
        except Exception as e:
            logger.error(f"Error exporting traces for project {project_name}: {e}")
        
        logger.info(f"Exporting evaluations for {project_name}...")
        try:
            evaluations = get_evaluations(client, project_name)
            if evaluations:
                save_json(evaluations, os.path.join(project_dir, 'evaluations.json'))
                result["evaluation_count"] = len(evaluations)
        except Exception as e:
            logger.error(f"Error exporting evaluations for project {project_name}: {e}")
        
        logger.info(f"Export completed successfully for {project_name}. Data saved to {project_dir}")
        return result
            
    except Exception as e:
        logger.error(f"Error during export for {project_name}: {e}")
        result["status"] = "error"
        result["error"] = str(e)
        return result

def export_traces(
    client: httpx.Client, 
    output_dir: str,
    project_names: Optional[List[str]] = None,
    verbose: bool = False,
    results_file: Optional[str] = None
) -> Dict[str, Dict]:
    """Export traces and evaluations for multiple projects."""
    os.makedirs(output_dir, exist_ok=True)
    
    if verbose:
        logger.setLevel(logging.DEBUG)
    
    results = {}
    
    try:
        if project_names is None:
            logger.info("Fetching list of projects...")
            projects = get_projects(client)
            project_names = [p['name'] for p in projects]
            
        if not project_names:
            logger.warning("No projects found or provided")
            return results
            
        logger.info(f"Found {len(project_names)} projects to export")
        
        for project_name in tqdm(project_names, desc="Exporting projects"):
            results[project_name] = export_project_traces(
                client=client,
                project_name=project_name,
                output_dir=output_dir,
                verbose=verbose
            )
        
        logger.info(f"Trace export completed successfully. Data saved to {output_dir}")
        
        if results_file:
            save_json(results, results_file)
            logger.info(f"Export results saved to {results_file}")
            
        return results
            
    except Exception as e:
        logger.error(f"Error during traces export: {e}")
        if results_file:
            save_json({"error": str(e), "projects": results}, results_file)
        return results

if __name__ == "__main__":
    import argparse
    from dotenv import load_dotenv
    
    load_dotenv()
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    parser = argparse.ArgumentParser(description="Export traces from a Phoenix server")
    
    parser.add_argument('--base-url', type=str, default=os.environ.get('PHOENIX_BASE_URL'),
                       help='Phoenix server base URL (default: from PHOENIX_BASE_URL env var)')
    parser.add_argument('--api-key', type=str, default=os.environ.get('PHOENIX_API_KEY'),
                       help='Phoenix API key for authentication (default: from PHOENIX_API_KEY env var)')
    parser.add_argument('--output-dir', type=str, default='./phoenix_export/projects',
                       help='Directory to save exported data (default: ./phoenix_export/projects)')
    parser.add_argument('--project', type=str, action='append',
                       help='Project name to export (can be used multiple times, omit to export all projects)')
    parser.add_argument('--verbose', action='store_true', help='Enable verbose output')
    parser.add_argument('--results-file', type=str, help='Path to save export results JSON')
    
    args = parser.parse_args()
    
    if not args.base_url:
        logger.error("No Phoenix base URL provided. Set the PHOENIX_BASE_URL environment variable or use --base-url")
        exit(1)
    
    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
    if args.api_key:
        headers['Authorization'] = f'Bearer {args.api_key}'
    
    client = httpx.Client(base_url=args.base_url.rstrip('/'), headers=headers)
    
    results = export_traces(
        client=client,
        output_dir=args.output_dir,
        project_names=args.project,
        verbose=args.verbose,
        results_file=args.results_file
    )
    
    success_count = sum(1 for p in results.values() if p.get('status') == 'exported')
    error_count = sum(1 for p in results.values() if p.get('status') == 'error')
    total_traces = sum(p.get('trace_count', 0) for p in results.values())
    total_evaluations = sum(p.get('evaluation_count', 0) for p in results.values())
    
    print(f"\nExport Summary:")
    print(f"- Projects: {len(results)} total, {success_count} succeeded, {error_count} failed")
    print(f"- Exported: {total_traces} traces, {total_evaluations} evaluations")
    
    if args.results_file:
        print(f"Detailed results saved to: {args.results_file}")
    
    if error_count > 0:
        exit(1) 