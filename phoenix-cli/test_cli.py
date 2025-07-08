#!/usr/bin/env python3
"""Test script for Phoenix CLI functionality."""

import os
import sys
from pathlib import Path

# Add the src directory to Python path for development
sys.path.insert(0, str(Path(__file__).parent / "src"))

def test_cli_commands():
    """Test the CLI commands using python-fire."""
    print("Testing Phoenix CLI Commands")
    print("=" * 40)
    
    # Test 1: Add instances
    print("\n1. Testing instance addition...")
    os.system('python -m phoenix_cli.cli instances add local http://localhost:6006 --description "Local Phoenix instance"')
    
    # Test 2: List instances
    print("\n2. Testing instance listing...")
    os.system('python -m phoenix_cli.cli instances list')
    
    # Test 3: Show instance details
    print("\n3. Testing instance show...")
    os.system('python -m phoenix_cli.cli instances show local')
    
    # Test 4: Test connection (will likely fail unless Phoenix is running)
    print("\n4. Testing connection...")
    os.system('python -m phoenix_cli.cli instances test local')
    
    # Test 5: List projects (will fail if no Phoenix instance is running)
    print("\n5. Testing projects list...")
    os.system('python -m phoenix_cli.cli projects --instance local')
    
    # Test 6: Export data (will fail if no Phoenix instance is running)
    print("\n6. Testing export...")
    os.system('python -m phoenix_cli.cli export --instance local --limit 10')
    
    # Test 7: Remove instance
    print("\n7. Testing instance removal...")
    os.system('python -m phoenix_cli.cli instances remove local')
    
    print("\nAll tests completed!")
    print("Note: Some commands may fail if Phoenix is not running locally.")


if __name__ == "__main__":
    test_cli_commands()