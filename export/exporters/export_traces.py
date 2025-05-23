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
import re
import logging
from typing import Dict, List, Union, Optional
import httpx
from tqdm import tqdm

# Configure logging
logger = logging.getLogger(__name__)

def get_projects(client: httpx.Client) -> List[Dict]:
    """
    Get all projects from the Phoenix server.
    
    Args:
        client: HTTPX client
    
    Returns:
        List of project dictionaries
    """
    response = client.get('/v1/projects')
    response.raise_for_status()
    return response.json().get('data', [])

def get_project_metadata(client: httpx.Client, project_name: str) -> Dict:
    """
    Get metadata for a specific project.
    
    Args:
        client: HTTPX client
        project_name: Name of the project
        
    Returns:
        Project metadata dictionary
    """
    response = client.get(f'/v1/projects/{project_name}')
    response.raise_for_status()
    return response.json()

def get_traces(client: httpx.Client, project_name: str, limit: int = 1000) -> List[Dict]:
    """
    Get traces for a specific project.
    
    Args:
        client: HTTPX client
        project_name: Name of the project
        limit: Maximum number of traces to retrieve
        
    Returns:
        List of trace dictionaries
    """
    traces = []
    
    # Create the request body with proper query structure
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
        "root_spans_only": False  # Get all spans, not just root spans
    }
    
    # Add Accept header for JSON response
    headers = {
        'Accept': 'application/json'
    }
    
    try:
        # Pass project_name both in query params and JSON body
        response = client.post(
            '/v1/spans',
            json=request_body,
            headers=headers,
            params={
                'project_name': project_name,
                'project-name': project_name  # for backward-compatibility
            }
        )
        response.raise_for_status()
        response_data = response.text
        
        # Process the response based on type
        content_type = response.headers.get('content-type', '')
        
        if 'multipart/mixed' in content_type:
            # This is a streaming multipart response
            # Find the boundary token from the first line
            match = re.search(r'--([a-zA-Z0-9_\-]+)', response_data)
            if match:
                boundary = f"--{match.group(1)}"
                # Split by boundary
                parts = response_data.split(boundary)
                for part in parts:
                    if not part.strip():
                        continue
                    # Extract JSON content using a more robust regex approach
                    match = re.search(r'Content-Type:\s*application/json\r\n\r\n([\s\S]+?)(?:\r\n--|\r\n$|$)', part)
                    if match:
                        json_content = match.group(1).strip()
                        try:
                            data = json.loads(json_content)
                            if isinstance(data, list):
                                traces.extend(data)
                            elif isinstance(data, dict) and 'data' in data:
                                traces.extend(data['data'])
                            elif isinstance(data, dict):
                                traces.append(data)
                        except json.JSONDecodeError as e:
                            logger.error(f"Error parsing JSON content: {e}")
        else:
            # This is a regular JSON response
            data = response.json()
            if isinstance(data, list):
                traces.extend(data)
            elif isinstance(data, dict) and 'data' in data:
                traces.extend(data['data'])
            elif isinstance(data, dict):
                traces.append(data)
        
        if traces:
            logger.info(f"Retrieved {len(traces)} traces for project {project_name}")
        else:
            logger.info(f"No traces found for project {project_name}")
            
        return traces
        
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            logger.info(f"No traces found for project {project_name}")
            return []
        logger.error(f"Error fetching traces for project {project_name}: {e}")
        raise

def get_evaluations(client: httpx.Client, project_name: str) -> List[Dict]:
    """
    Get evaluations for a specific project.
    
    Args:
        client: HTTPX client
        project_name: Name of the project
        
    Returns:
        List of evaluation dictionaries
    """
    try:
        # Add Accept header for JSON response
        headers = {
            'Accept': 'application/json'
        }
        
        response = client.get(
            '/v1/evaluations',
            params={'project_name': project_name},
            headers=headers
        )
        response.raise_for_status()
        
        evaluations = []
        response_data = response.text
        content_type = response.headers.get('content-type', '')
        
        # The response is a streaming response with multiple JSON parts
        if 'multipart/mixed' in content_type:
            # Split the response by boundary
            match = re.search(r'--([a-zA-Z0-9_\-]+)', response_data)
            if match:
                boundary = f"--{match.group(1)}"
                parts = response_data.split(boundary)
                for part in parts:
                    if not part.strip():
                        continue
                    # Extract JSON content
                    match = re.search(r'Content-Type:\s*application/json\r\n\r\n([\s\S]+?)(?:\r\n--|\r\n$|$)', part)
                    if match:
                        json_content = match.group(1).strip()
                        try:
                            data = json.loads(json_content)
                            if isinstance(data, list):
                                evaluations.extend(data)
                            elif isinstance(data, dict) and 'data' in data:
                                evaluations.extend(data['data'])
                        except json.JSONDecodeError as e:
                            logger.error(f"Error parsing JSON content for evaluations: {e}")
        else:
            # This is a regular JSON response
            data = response.json()
            if isinstance(data, list):
                evaluations.extend(data)
            elif isinstance(data, dict) and 'data' in data:
                evaluations.extend(data['data'])
        
        return evaluations
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            logger.info(f"No evaluations found for project {project_name}")
            return []
        raise

def save_json(data: Union[Dict, List], filepath: str) -> None:
    """
    Save data to a JSON file.
    
    Args:
        data: Data to save
        filepath: Path to save the file
    """
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)

def export_project_traces(
    client: httpx.Client, 
    project_name: str, 
    output_dir: str,
    verbose: bool = False
) -> Dict[str, Union[str, int]]:
    """
    Export traces and evaluations for a specific project.
    
    Args:
        client: HTTPX client
        project_name: Name of the project
        output_dir: Directory to save the exported data
        verbose: Whether to enable verbose output
        
    Returns:
        Dictionary with export results
    """
    project_dir = os.path.join(output_dir, project_name)
    os.makedirs(project_dir, exist_ok=True)
    
    result = {
        "project_name": project_name,
        "trace_count": 0,
        "evaluation_count": 0,
        "status": "exported"
    }
    
    try:
        # Export project metadata
        logger.info(f"Exporting project metadata for {project_name}...")
        try:
            project_metadata = get_project_metadata(client, project_name)
            save_json(project_metadata, os.path.join(project_dir, 'project_metadata.json'))
        except Exception as e:
            logger.error(f"Error exporting metadata for project {project_name}: {e}")
        
        # Export traces
        logger.info(f"Exporting traces for {project_name}...")
        try:
            traces = get_traces(client, project_name)
            save_json(traces, os.path.join(project_dir, 'traces.json'))
            result["trace_count"] = len(traces)
        except Exception as e:
            logger.error(f"Error exporting traces for project {project_name}: {e}")
        
        # Export evaluations
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
    """
    Export traces and evaluations for multiple projects.
    
    Args:
        client: HTTPX client
        output_dir: Directory to save the exported data
        project_names: List of project names to export (None for all projects)
        verbose: Whether to enable verbose output
        results_file: Path to save the results JSON
        
    Returns:
        Dictionary with export results for each project
    """
    os.makedirs(output_dir, exist_ok=True)
    
    if verbose:
        logger.setLevel(logging.DEBUG)
    
    results = {}
    
    try:
        # Get all projects if project_names is None
        if project_names is None:
            logger.info("Fetching list of projects...")
            projects = get_projects(client)
            project_names = [p['name'] for p in projects]
            
        if not project_names:
            logger.warning("No projects found or provided")
            return results
            
        logger.info(f"Found {len(project_names)} projects to export")
        
        # Export data for each project
        for project_name in tqdm(project_names, desc="Exporting projects"):
            results[project_name] = export_project_traces(
                client=client,
                project_name=project_name,
                output_dir=output_dir,
                verbose=verbose
            )
        
        logger.info(f"Trace export completed successfully. Data saved to {output_dir}")
        
        # Save results to file if requested
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
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    parser = argparse.ArgumentParser(description="Export traces from a Phoenix server")
    
    parser.add_argument(
        '--base-url',
        type=str,
        default=os.environ.get('PHOENIX_BASE_URL'),
        help='Phoenix server base URL (default: from PHOENIX_BASE_URL env var)'
    )
    
    parser.add_argument(
        '--api-key',
        type=str,
        default=os.environ.get('PHOENIX_API_KEY'),
        help='Phoenix API key for authentication (default: from PHOENIX_API_KEY env var)'
    )
    
    parser.add_argument(
        '--output-dir',
        type=str,
        default='./phoenix_export/projects',
        help='Directory to save exported data (default: ./phoenix_export/projects)'
    )
    
    parser.add_argument(
        '--project',
        type=str,
        action='append',
        help='Project name to export (can be used multiple times, omit to export all projects)'
    )
    
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose output'
    )
    
    parser.add_argument(
        '--results-file',
        type=str,
        help='Path to save export results JSON'
    )
    
    args = parser.parse_args()
    
    if not args.base_url:
        logger.error("No Phoenix base URL provided. Set the PHOENIX_BASE_URL environment variable or use --base-url")
        exit(1)
    
    # Create HTTPX client
    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
    if args.api_key:
        headers['Authorization'] = f'Bearer {args.api_key}'
    
    client = httpx.Client(base_url=args.base_url.rstrip('/'), headers=headers)
    
    # Export traces
    results = export_traces(
        client=client,
        output_dir=args.output_dir,
        project_names=args.project,  # None if no --project arguments were provided
        verbose=args.verbose,
        results_file=args.results_file
    )
    
    # Print summary
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