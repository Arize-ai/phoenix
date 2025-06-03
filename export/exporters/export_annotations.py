#!/usr/bin/env python3
"""
Phoenix Annotations Exporter

This module handles exporting annotations from a Phoenix server.

Usage:
  from exporters import export_annotations
  
  # Export annotations for all projects
  export_annotations.export_annotations(
      client=client,
      output_dir="./phoenix_export/annotations",
      project_names=None  # Export all projects
  )
  
  # Export annotations for specific projects
  export_annotations.export_annotations(
      client=client,
      output_dir="./phoenix_export/annotations",
      project_names=["project1", "project2"]
  )
"""

import os
import json
import logging
from typing import Dict, List, Union, Optional, Set
import httpx
from tqdm import tqdm
import re

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
        # Pass project_name 
        response = client.post(
            '/v1/spans',
            json=request_body,
            headers=headers,
            params={
                'project_name': project_name,
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

def extract_span_ids(traces: List[Dict]) -> Set[str]:
    """
    Extract span IDs from traces.
    
    Args:
        traces: List of trace dictionaries
        
    Returns:
        Set of span IDs
    """
    span_ids = set()
    
    for trace in traces:
        # Look for the span_id fields in the flattened format
        for key, value in trace.items():
            if key.endswith('context.span_id') and value and isinstance(value, str):
                span_ids.add(value)
                
            # Also check for possible span IDs in other fields
            if 'span_id' in key and value and isinstance(value, str):
                span_ids.add(value)
    
    return span_ids

def get_annotations(client: httpx.Client, project_name: str, span_ids: List[str]) -> List[Dict]:
    """
    Get annotations for a specific set of span IDs.
    
    Args:
        client: HTTPX client
        project_name: Name of the project
        span_ids: List of span IDs to get annotations for
        
    Returns:
        List of annotation dictionaries
    """
    all_annotations = []
    
    # Add Accept header for JSON response
    headers = {
        'Accept': 'application/json'
    }
    
    try:
        # Query annotations for this batch of span_ids
        response = client.get(
            f'/v1/projects/{project_name}/span_annotations',
            params={'span_ids': span_ids},
            headers=headers
        )
        response.raise_for_status()
        
        # JSON response
        data = response.json()
        all_annotations = data.get('data', [])
        
        return all_annotations
            
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            logger.info(f"No annotations found for these span IDs")
            return []
        logger.error(f"Error fetching annotations: {e}")
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

def export_project_annotations(
    client: httpx.Client, 
    project_name: str, 
    output_dir: str,
    verbose: bool = False
) -> Dict[str, Union[str, int]]:
    """
    Export annotations for a specific project.
    
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
        "annotation_count": 0,
        "span_count": 0,
        "status": "exported"
    }
    
    try:
        # First, get all traces for the project to extract span_ids
        logger.info(f"Fetching traces for project {project_name} to extract span IDs...")
        traces = get_traces(client, project_name)
        
        if not traces:
            logger.info(f"No traces found for project {project_name}")
            return result
        
        # Extract span IDs from the traces
        span_ids = extract_span_ids(traces)
        
        if not span_ids:
            logger.info(f"No span IDs found in traces for project {project_name}")
            return result
        
        result["span_count"] = len(span_ids)
        logger.info(f"Found {len(span_ids)} unique span IDs in traces for project {project_name}")
        
        # Get annotations for these spans in batches to avoid URL length limitations
        all_annotations = []
        batch_size = 10  # The API can only handle 10 span_ids per request
        span_ids_list = list(span_ids)
        
        for i in range(0, len(span_ids_list), batch_size):
            batch = span_ids_list[i:i + batch_size]
            
            try:
                logger.info(f"Fetching annotations for batch {i//batch_size + 1}/{(len(span_ids_list) + batch_size - 1)//batch_size}...")
                batch_annotations = get_annotations(client, project_name, batch)
                all_annotations.extend(batch_annotations)
                
                if verbose:
                    logger.debug(f"Retrieved {len(batch_annotations)} annotations in this batch")
                
            except Exception as e:
                logger.error(f"Error fetching annotations for batch of span IDs: {e}")
                # Continue with next batch instead of failing entirely
                continue
        
        if all_annotations:
            result["annotation_count"] = len(all_annotations)
            logger.info(f"Retrieved {len(all_annotations)} annotations for project {project_name}")
            
            # Save annotations to file
            save_json(all_annotations, os.path.join(project_dir, 'annotations.json'))
        else:
            logger.info(f"No annotations found for project {project_name}")
        
        return result
            
    except Exception as e:
        logger.error(f"Error during annotations export for {project_name}: {e}")
        result["status"] = "error"
        result["error"] = str(e)
        return result

def export_annotations(
    client: httpx.Client, 
    output_dir: str,
    project_names: Optional[List[str]] = None,
    verbose: bool = False,
    results_file: Optional[str] = None
) -> Dict[str, Dict]:
    """
    Export annotations for multiple projects.
    
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
            
        logger.info(f"Found {len(project_names)} projects to export annotations for")
        
        # Export annotations for each project
        for project_name in tqdm(project_names, desc="Exporting annotations"):
            results[project_name] = export_project_annotations(
                client=client,
                project_name=project_name,
                output_dir=output_dir,
                verbose=verbose
            )
        
        logger.info(f"Annotations export completed successfully. Data saved to {output_dir}")
        
        # Save results to file if requested
        if results_file:
            save_json(results, results_file)
            logger.info(f"Export results saved to {results_file}")
            
        return results
            
    except Exception as e:
        logger.error(f"Error during annotations export: {e}")
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
    
    parser = argparse.ArgumentParser(description="Export annotations from a Phoenix server")
    
    parser.add_argument(
        '--base-url',
        type=str,
        default=os.environ.get('PHOENIX_ENDPOINT'),
        help='Phoenix server base URL (default: from PHOENIX_ENDPOINT env var)'
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
        help='Project name to export annotations for (can be used multiple times, omit to export all projects)'
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
        logger.error("No Phoenix base URL provided. Set the PHOENIX_ENDPOINT environment variable or use --base-url")
        exit(1)
    
    # Create HTTPX client
    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
    if args.api_key:
        headers['Authorization'] = f'Bearer {args.api_key}'
    
    client = httpx.Client(base_url=args.base_url.rstrip('/'), headers=headers)
    
    # Export annotations
    results = export_annotations(
        client=client,
        output_dir=args.output_dir,
        project_names=args.project,  # None if no --project arguments were provided
        verbose=args.verbose,
        results_file=args.results_file
    )
    
    # Print summary
    success_count = sum(1 for p in results.values() if p.get('status') == 'exported')
    error_count = sum(1 for p in results.values() if p.get('status') == 'error')
    total_annotations = sum(p.get('annotation_count', 0) for p in results.values())
    total_spans = sum(p.get('span_count', 0) for p in results.values())
    
    print(f"\nExport Summary:")
    print(f"- Projects: {len(results)} total, {success_count} succeeded, {error_count} failed")
    print(f"- Exported: {total_annotations} annotations from {total_spans} spans")
    
    if args.results_file:
        print(f"Detailed results saved to: {args.results_file}")
    
    if error_count > 0:
        exit(1) 