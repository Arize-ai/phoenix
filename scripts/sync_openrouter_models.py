import asyncio
import aiohttp
import json
from datetime import datetime

# Asynchronously fetch data from a given URL
async def fetch_data(url):
    try:
        # Create an asynchronous session
        async with aiohttp.ClientSession() as session:
            # Send a GET request to the URL
            async with session.get(url) as resp:
                # Raise an error if the response status is not OK
                resp.raise_for_status()
                # Parse the response JSON
                resp_json = await resp.json()
                print("Fetched data from URL successfully.")
                # Return the 'data' field from the JSON response
                return resp_json.get('data', resp_json)
    except Exception as e:
        # Print an error message if fetching data fails
        print(f"Error fetching data from URL: {e}")
        return None

# Transform the remote data into a generic structure
def transform_remote_data(data):
    """
    Transform OpenRouter API data into a generic model format.
    
    Output format:
    {
        "model_id": {
            "provider": "provider_name",
            "max_tokens": int,
            "input_cost_per_token": float,
            "max_output_tokens": int (optional),
            "output_cost_per_token": float,
            "input_cost_per_image": float (optional),
            "supports_vision": bool (optional)
        }
    }
    """
    transformed = {}
    
    for row in data:
        # Create a unique model identifier
        model_id = f"openrouter/{row['id']}"
        
        # Build the generic model object
        model_info = {
            "provider": "openrouter",
            "max_tokens": row.get("context_length", 0),
            "input_cost_per_token": float(row.get("pricing", {}).get("prompt", 0)),
            "output_cost_per_token": float(row.get("pricing", {}).get("completion", 0))
        }
        
        # Add optional max_output_tokens if available
        if "top_provider" in row and row["top_provider"]:
            max_completion = row["top_provider"].get("max_completion_tokens")
            if max_completion is not None:
                model_info["max_output_tokens"] = int(max_completion)
        
        # Add optional input_cost_per_image if it exists and is non-zero
        image_cost = float(row.get("pricing", {}).get("image", 0))
        if image_cost > 0:
            model_info["input_cost_per_image"] = image_cost
        
        # Add supports_vision if the model is multimodal
        modality = row.get("architecture", {}).get("modality", "")
        if modality == "multimodal":
            model_info["supports_vision"] = True
        
        transformed[model_id] = model_info
    
    return transformed

# Merge remote data with existing local data
def merge_data(local_data, remote_data):
    """
    Merge remote data into local data, updating existing entries and adding new ones.
    """
    merged = local_data.copy() if local_data else {}
    
    # Update or add entries from remote data
    for model_id, model_info in remote_data.items():
        if model_id in merged:
            # Update existing entry
            merged[model_id].update(model_info)
        else:
            # Add new entry
            merged[model_id] = model_info
    
    return merged

# Write data to the json file
def write_to_file(file_path, data):
    try:
        # Add metadata
        output = {
            "last_updated": datetime.utcnow().isoformat() + "Z",
            "models": data
        }
        
        # Open the file in write mode
        with open(file_path, "w") as file:
            # Dump the data as JSON into the file with nice formatting
            json.dump(output, file, indent=2, sort_keys=True)
        print(f"Successfully updated {file_path}")
    except Exception as e:
        # Print an error message if writing to file fails
        print(f"Error writing to file: {e}")
        raise

# Load local data from a specified file
def load_local_data(file_path):
    try:
        # Open the file in read mode
        with open(file_path, "r") as file:
            # Load and return the JSON data
            data = json.load(file)
            # Handle both old format (direct models) and new format (with metadata)
            if isinstance(data, dict) and "models" in data:
                return data["models"]
            return data
    except FileNotFoundError:
        # Return empty dict if file doesn't exist yet
        print(f"File not found: {file_path} - will create new file")
        return {}
    except json.JSONDecodeError as e:
        # Print an error message if JSON decoding fails
        print(f"Error decoding JSON: {e}")
        return {}

def main():
    # Configuration
    local_file_path = "model_prices_and_context_window.json"
    url = "https://openrouter.ai/api/v1/models"
    
    # Load existing local data
    local_data = load_local_data(local_file_path)
    
    # Fetch and transform remote data
    remote_data = asyncio.run(fetch_data(url))
    if not remote_data:
        print("Failed to fetch model data from API")
        return 1
    
    # Transform the fetched data into generic format
    transformed_data = transform_remote_data(remote_data)
    
    # Merge with existing data
    merged_data = merge_data(local_data, transformed_data)
    
    # Write the updated data back to file
    write_to_file(local_file_path, merged_data)
    
    # Print summary
    print(f"Total models in file: {len(merged_data)}")
    print(f"Models from this sync: {len(transformed_data)}")
    
    return 0

# Entry point of the script
if __name__ == "__main__":
    exit(main())
