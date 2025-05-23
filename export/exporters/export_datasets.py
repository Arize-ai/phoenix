#!/usr/bin/env python3
"""
Phoenix Datasets Exporter

This module handles exporting datasets, examples, and experiments from a Phoenix server.

Usage:
  from exporters import export_datasets
  
  # Export datasets
  export_datasets.export_datasets(
      client=client,
      output_dir="./phoenix_export/datasets",
  )
"""

import os
import json
import logging
from typing import Dict, List, Union, Optional
import httpx

# Configure logging
logger = logging.getLogger(__name__)

def get_datasets(client: httpx.Client) -> List[Dict]:
    """
    Get all datasets from the Phoenix server.
    
    Args:
        client: HTTPX client
        
    Returns:
        List of dataset dictionaries
    """
    response = client.get('/v1/datasets')
    response.raise_for_status()
    return response.json().get('data', [])

def get_dataset_examples(client: httpx.Client, dataset_id: str) -> List[Dict]:
    """
    Get examples for a specific dataset.
    
    Args:
        client: HTTPX client
        dataset_id: ID of the dataset
        
    Returns:
        List of example dictionaries
    """
    response = client.get(f'/v1/datasets/{dataset_id}/examples')
    response.raise_for_status()
    return response.json().get('data', {}).get('examples', [])

def get_experiments(client: httpx.Client, dataset_id: str) -> List[Dict]:
    """
    Get experiments for a specific dataset.
    
    Args:
        client: HTTPX client
        dataset_id: ID of the dataset
        
    Returns:
        List of experiment dictionaries
    """
    response = client.get(f'/v1/datasets/{dataset_id}/experiments')
    response.raise_for_status()
    return response.json().get('data', [])

def save_json(data: Union[Dict, List], filepath: str) -> None:
    """
    Save data to a JSON file.
    
    Args:
        data: Data to save
        filepath: Path to save the file
    """
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)

def export_datasets(
    client: httpx.Client, 
    output_dir: str,
    verbose: bool = False,
    results_file: Optional[str] = None
) -> List[Dict]:
    """
    Export all datasets and their experiments.
    
    Args:
        client: HTTPX client
        output_dir: Directory to save the exported data
        verbose: Whether to enable verbose output
        results_file: Path to save the results JSON
        
    Returns:
        List of dictionaries with dataset export results
    """
    os.makedirs(output_dir, exist_ok=True)
    
    if verbose:
        logger.setLevel(logging.DEBUG)
    
    results = []
    
    try:
        # Export datasets and their examples
        logger.info("Exporting datasets...")
        datasets = get_datasets(client)
        
        if not datasets:
            logger.warning("No datasets found")
            return results
            
        logger.info(f"Found {len(datasets)} datasets")
        save_json(datasets, os.path.join(output_dir, 'datasets.json'))
        
        for dataset in datasets:
            dataset_id = dataset['id']
            dataset_name = dataset.get('name', dataset_id)
            
            dataset_result = {
                "id": dataset_id,
                "name": dataset_name,
                "examples_count": 0,
                "experiments_count": 0,
                "status": "exported"
            }
            
            try:
                # Export examples
                logger.info(f"Exporting examples for dataset {dataset_name} ({dataset_id})...")
                examples = get_dataset_examples(client, dataset_id)
                examples_path = os.path.join(output_dir, f'dataset_{dataset_id}_examples.json')
                save_json(examples, examples_path)
                dataset_result["examples_count"] = len(examples)
                
                # Export experiments
                logger.info(f"Exporting experiments for dataset {dataset_name} ({dataset_id})...")
                experiments = get_experiments(client, dataset_id)
                experiments_path = os.path.join(output_dir, f'dataset_{dataset_id}_experiments.json')
                save_json(experiments, experiments_path)
                dataset_result["experiments_count"] = len(experiments)
                
                logger.info(f"Successfully exported dataset {dataset_name} with {len(examples)} examples and {len(experiments)} experiments")
                
            except Exception as e:
                logger.error(f"Error exporting dataset {dataset_name}: {e}")
                dataset_result["status"] = "error"
                dataset_result["error"] = str(e)
            
            results.append(dataset_result)
        
        logger.info(f"Datasets export completed successfully. Data saved to {output_dir}")
        
        # Save results to file if requested
        if results_file:
            save_json(results, results_file)
            logger.info(f"Export results saved to {results_file}")
            
        return results
            
    except Exception as e:
        logger.error(f"Error during datasets export: {e}")
        if results_file:
            error_results = {"error": str(e), "datasets": results}
            save_json(error_results, results_file)
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
    
    parser = argparse.ArgumentParser(description="Export datasets from a Phoenix server")
    
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
        default='./phoenix_export/datasets',
        help='Directory to save exported data (default: ./phoenix_export/datasets)'
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
    
    # Export datasets
    results = export_datasets(
        client=client,
        output_dir=args.output_dir,
        verbose=args.verbose,
        results_file=args.results_file
    )
    
    # Print summary
    export_count = sum(1 for r in results if r.get('status') == 'exported')
    error_count = sum(1 for r in results if r.get('status') == 'error')
    
    print(f"\nExport Summary:")
    print(f"- Exported: {export_count} datasets")
    print(f"- Errors: {error_count} datasets")
    
    if args.results_file:
        print(f"Detailed results saved to: {args.results_file}")
    
    if error_count > 0:
        exit(1) 