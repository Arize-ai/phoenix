#!/usr/bin/env python3
"""
Utility functions for Phoenix data export/import.
"""

import os
import time
import logging
import random
import argparse
from functools import wraps
from typing import Callable, Any, Optional, Type, List, Dict, Union

import httpx
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class RetryableError(Exception):
    """Base class for errors that should trigger a retry."""
    pass

def parse_export_args() -> argparse.Namespace:
    """
    Parse command line arguments.
    
    Returns:
        Parsed command line arguments
    """
    parser = argparse.ArgumentParser(
        description='Export data from Phoenix server'
    )
    
    # Environment settings
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
        '--export-dir',
        type=str,
        default=os.environ.get('PHOENIX_EXPORT_DIR', 'phoenix_export'),
        help='Directory to save exported data (default: from PHOENIX_EXPORT_DIR env var or "phoenix_export")'
    )
    
    # Export types
    parser.add_argument(
        '--all',
        action='store_true',
        help='Export all data types: datasets, prompts, projects, traces, and annotations'
    )
    
    parser.add_argument(
        '--datasets',
        action='store_true',
        help='Export datasets'
    )
    
    parser.add_argument(
        '--prompts',
        action='store_true',
        help='Export prompts'
    )
    
    parser.add_argument(
        '--projects',
        action='store_true',
        help='Export projects (includes metadata)'
    )
    
    parser.add_argument(
        '--traces',
        action='store_true',
        help='Export traces'
    )
    
    parser.add_argument(
        '--annotations',
        action='store_true',
        help='Export annotations'
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
    
    # Retry configuration
    parser.add_argument(
        '--max-attempts',
        type=int,
        default=5,
        help='Maximum number of retry attempts for API calls (default: 5)'
    )
    
    parser.add_argument(
        '--initial-backoff',
        type=float,
        default=1.0,
        help='Initial backoff time in seconds (default: 1.0)'
    )
    
    parser.add_argument(
        '--max-backoff',
        type=float,
        default=60.0,
        help='Maximum backoff time in seconds (default: 60.0)'
    )
    
    parser.add_argument(
        '--backoff-factor',
        type=float,
        default=2.0,
        help='Multiplier for backoff on each retry (default: 2.0)'
    )
    
    parser.add_argument(
        '--timeout',
        type=float,
        default=30.0,
        help='Request timeout in seconds (default: 30.0)'
    )
    
    return parser.parse_args()

def retry_with_backoff(
    max_attempts: int = 5,
    initial_backoff: float = 1.0,
    max_backoff: float = 60.0,
    backoff_factor: float = 2.0,
    jitter: bool = True,
    retryable_exceptions: List[Type[Exception]] = None
) -> Callable:
    """
    Decorator to retry a function with exponential backoff.
    
    Args:
        max_attempts: Maximum number of retry attempts (default: 5)
        initial_backoff: Initial backoff time in seconds (default: 1.0)
        max_backoff: Maximum backoff time in seconds (default: 60.0)
        backoff_factor: Multiplier for backoff on each retry (default: 2.0)
        jitter: Whether to add random jitter to backoff time (default: True)
        retryable_exceptions: List of exceptions that should trigger a retry
            (default: [httpx.HTTPStatusError, httpx.RequestError, RetryableError])
            
    Returns:
        Decorated function that will retry on specified exceptions
    """
    if retryable_exceptions is None:
        retryable_exceptions = [
            httpx.HTTPStatusError,
            httpx.RequestError,
            RetryableError,
        ]
        
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            attempts = 0
            backoff = initial_backoff
            
            while attempts < max_attempts:
                try:
                    return func(*args, **kwargs)
                except tuple(retryable_exceptions) as e:
                    attempts += 1
                    
                    # Check for rate limit response (HTTP 429)
                    retry_after = None
                    if isinstance(e, httpx.HTTPStatusError) and e.response.status_code == 429:
                        retry_after = e.response.headers.get('Retry-After')
                        if retry_after:
                            try:
                                retry_after = float(retry_after)
                            except ValueError:
                                # If it's not a numeric value, ignore it
                                retry_after = None
                    
                    # If this was the last attempt, re-raise the exception
                    if attempts >= max_attempts:
                        logger.error(f"Failed after {max_attempts} attempts: {e}")
                        raise
                    
                    # Calculate backoff time
                    if retry_after is not None:
                        # Use the server's retry-after value if available
                        wait_time = retry_after
                        logger.warning(f"Rate limited. Server requested wait of {wait_time}s. Retrying... ({attempts}/{max_attempts})")
                    else:
                        # Otherwise use exponential backoff
                        wait_time = min(backoff, max_backoff)
                        if jitter:
                            # Add random jitter (between -10% and +10%)
                            wait_time = wait_time * (0.9 + 0.2 * random.random())
                        
                        logger.warning(f"Request failed: {e}. Retrying in {wait_time:.2f}s... ({attempts}/{max_attempts})")
                    
                    # Wait and update backoff for next attempt
                    time.sleep(wait_time)
                    backoff = min(backoff * backoff_factor, max_backoff)
            
            return None  # This should never be reached due to the re-raise above
        
        return wrapper
    
    return decorator

def create_client_with_retry(
    base_url: str,
    headers: Dict[str, str],
    timeout: float = 30.0,
    max_attempts: int = 5,
    initial_backoff: float = 1.0,
    max_backoff: float = 60.0,
    backoff_factor: float = 2.0
) -> httpx.Client:
    """
    Create an HTTPX client with retry capabilities.
    
    Args:
        base_url: Base URL for the API
        headers: HTTP headers to include in requests
        timeout: Request timeout in seconds
        max_attempts: Maximum number of retry attempts
        initial_backoff: Initial backoff time in seconds
        max_backoff: Maximum backoff time in seconds
        backoff_factor: Multiplier for backoff on each retry
        
    Returns:
        HTTPX client with retry capabilities
    """
    # Create a custom transport with retry logic
    transport = httpx.HTTPTransport(
        retries=max_attempts,
        verify=True  # Verify SSL certificates
    )
    
    # Create the client with the custom transport
    client = httpx.Client(
        base_url=base_url,
        headers=headers,
        timeout=timeout,
        transport=transport
    )
    
    # Add retry logic for specific status codes
    def retry_request(
        method: str,
        url: str,
        **kwargs: Any
    ) -> httpx.Response:
        """
        Make an HTTP request with retry logic.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            url: URL to request
            **kwargs: Additional arguments to pass to the request
            
        Returns:
            HTTP response
            
        Raises:
            httpx.HTTPError: If the request fails after all retries
        """
        attempt = 0
        backoff = initial_backoff
        
        while attempt < max_attempts:
            try:
                response = client.request(method, url, **kwargs)
                
                # Check if we need to retry
                if response.status_code in [429, 500, 502, 503, 504]:
                    if attempt < max_attempts - 1:
                        logger.warning(
                            f"Request failed with status {response.status_code}, "
                            f"retrying in {backoff:.1f} seconds..."
                        )
                        time.sleep(backoff)
                        backoff = min(backoff * backoff_factor, max_backoff)
                        attempt += 1
                        continue
                
                return response
                
            except (httpx.ConnectError, httpx.ReadTimeout) as e:
                if attempt < max_attempts - 1:
                    logger.warning(
                        f"Request failed with error: {str(e)}, "
                        f"retrying in {backoff:.1f} seconds..."
                    )
                    time.sleep(backoff)
                    backoff = min(backoff * backoff_factor, max_backoff)
                    attempt += 1
                    continue
                raise
    
    # Add the retry_request method to the client
    client.retry_request = retry_request
    
    return client

def handle_api_error(response: httpx.Response, context: str) -> None:
    """
    Handle API error responses.
    
    Args:
        response: HTTP response
        context: Context for the error message
        
    Raises:
        httpx.HTTPError: If the response indicates an error
    """
    if response.status_code >= 400:
        error_msg = f"API error in {context}: {response.status_code}"
        try:
            error_data = response.json()
            if isinstance(error_data, dict):
                if 'error' in error_data:
                    error_msg += f" - {error_data['error']}"
                elif 'message' in error_data:
                    error_msg += f" - {error_data['message']}"
        except Exception:
            error_msg += f" - {response.text}"
        
        logger.error(error_msg)
        response.raise_for_status()

def safe_request(
    client: httpx.Client,
    method: str,
    url: str,
    default_value: Any = None,
    **kwargs
) -> Union[Dict, List, Any]:
    """
    Make a safe HTTP request that returns a default value on failure.
    
    Args:
        client: HTTPX client
        method: HTTP method (get, post, etc.)
        url: URL to request
        default_value: Value to return on failure
        **kwargs: Additional arguments to pass to the request method
        
    Returns:
        JSON response data or default value on failure
    """
    try:
        response = getattr(client, method.lower())(url, **kwargs)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Request failed: {method.upper()} {url} - {e}")
        return default_value

def parse_import_args() -> argparse.Namespace:
    """
    Parse command line arguments for import functionality.
    
    Returns:
        Parsed command line arguments
    """
    parser = argparse.ArgumentParser(
        description='Import Phoenix export data to Arize'
    )
    
    # Environment settings
    parser.add_argument(
        '--api-key',
        type=str,
        default=os.environ.get('ARIZE_API_KEY'),
        help='Arize API key (default: from ARIZE_API_KEY env var)'
    )
    
    parser.add_argument(
        '--space-id',
        type=str,
        default=os.environ.get('ARIZE_SPACE_ID'),
        help='Arize Space ID (default: from ARIZE_SPACE_ID env var)'
    )
    
    parser.add_argument(
        '--export-dir',
        type=str,
        default=os.environ.get('PHOENIX_EXPORT_DIR', 'phoenix_export'),
        help='Phoenix export directory (default: from PHOENIX_EXPORT_DIR env var or "phoenix_export")'
    )
    
    # Import types
    parser.add_argument(
        '--all',
        action='store_true',
        help='Import all data types in order: datasets, prompts, traces, evaluations, and annotations (with confirmations for trace ingestion and annotation setup)'
    )
    
    parser.add_argument(
        '--datasets',
        action='store_true',
        help='Import datasets'
    )
    
    parser.add_argument(
        '--traces',
        action='store_true',
        help='Import traces'
    )
    
    parser.add_argument(
        '--annotations',
        action='store_true',
        help='Import annotations'
    )
    
    parser.add_argument(
        '--evaluations',
        action='store_true',
        help='Import evaluations (requires traces to be fully ingested in Arize first)'
    )
    
    parser.add_argument(
        '--prompts',
        action='store_true',
        help='Import prompts'
    )
    
    parser.add_argument(
        '--setup-annotations',
        action='store_true',
        help='Run the annotation setup guide (do this before importing annotations)'
    )
    
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose output'
    )
    
    # Retry configuration
    parser.add_argument(
        '--max-attempts',
        type=int,
        default=5,
        help='Maximum number of retry attempts for API calls (default: 5)'
    )
    
    parser.add_argument(
        '--initial-backoff',
        type=float,
        default=1.0,
        help='Initial backoff time in seconds (default: 1.0)'
    )
    
    parser.add_argument(
        '--max-backoff',
        type=float,
        default=60.0,
        help='Maximum backoff time in seconds (default: 60.0)'
    )
    
    parser.add_argument(
        '--backoff-factor',
        type=float,
        default=2.0,
        help='Multiplier for backoff on each retry (default: 2.0)'
    )
    
    parser.add_argument(
        '--timeout',
        type=float,
        default=30.0,
        help='Request timeout in seconds (default: 30.0)'
    )
    
    return parser.parse_args() 