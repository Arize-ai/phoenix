"""Script to process and analyze LLM model pricing data from LiteLLM.

This script fetches model pricing information from LiteLLM's pricing JSON file,
processes it into a structured format, and creates two CSV files:
1. model_prices.csv - Contains the full model pricing information
2. model_prices_by_token_type.csv - Contains a token-type focused view of the pricing data

The script handles nested JSON data by flattening it into a tabular format,
making it easier to analyze and compare different model pricing structures.
"""

from typing import Any
from urllib.parse import urlparse

import pandas as pd
import requests


def flatten_dict(d: dict[str, Any], parent_key: str = "", sep: str = "_") -> dict[str, Any]:
    """Flatten nested dictionaries with custom separator.

    Args:
        d: Dictionary to flatten
        parent_key: Parent key for nested dictionaries
        sep: Separator to use between keys

    Returns:
        Flattened dictionary
    """
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)


def process_model_prices(url: str) -> pd.DataFrame:
    """Process the model prices JSON file from a URL into a pandas DataFrame.

    Args:
        url: URL to fetch the JSON data from

    Returns:
        DataFrame containing the processed model prices

    Raises:
        ValueError: If URL is invalid
        requests.RequestException: If request fails
        ValueError: If JSON parsing fails
    """
    # Validate URL
    try:
        result = urlparse(url)
        if not all([result.scheme, result.netloc]):
            raise ValueError("Invalid URL format")
    except Exception as e:
        raise ValueError(f"Invalid URL: {str(e)}")

    # Fetch the JSON data from URL
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as e:
        raise requests.RequestException(f"Failed to fetch data: {str(e)}")
    except ValueError as e:
        raise ValueError(f"Failed to parse JSON: {str(e)}")

    # Remove the sample_spec entry as it's just documentation
    if "sample_spec" in data:
        del data["sample_spec"]

    # Process each model's data
    processed_data = []
    for model_name, model_info in data.items():
        # Flatten the nested dictionary
        flat_info = flatten_dict(model_info)
        # Add model name
        flat_info["model_name"] = model_name
        processed_data.append(flat_info)

    # Create DataFrame
    df = pd.DataFrame(processed_data)

    # Reorder columns to put model_name first
    cols = ["model_name"] + [col for col in df.columns if col != "model_name"]
    df = df[cols]

    # Sort by litellm_provider and model_name
    df = df.sort_values(["litellm_provider", "model_name"])

    return df


def create_token_type_df(df: pd.DataFrame) -> pd.DataFrame:
    """Create a transposed version of the DataFrame focusing on cost-related columns.

    Args:
        df: Input DataFrame containing model prices

    Returns:
        DataFrame with token type information
    """
    # Get all columns that contain '_cost_per_'
    cost_columns = [col for col in df.columns if "_cost_per_" in col or col.endswith("_cost")]

    # Select only the columns we want to keep
    keep_columns = ["model_name", "litellm_provider"] + cost_columns
    df_subset = df[keep_columns].copy()

    # Melt the DataFrame to create the token_type format
    df_melted = pd.melt(
        df_subset,
        id_vars=["model_name", "litellm_provider"],
        value_vars=cost_columns,
        var_name="unit_type",
        value_name="unit_cost",
    )

    # Remove rows where unit_cost is missing
    df_melted = df_melted.dropna(subset=["unit_cost"])

    # Reorder columns to put litellm_provider first
    df_melted = df_melted[["litellm_provider", "model_name", "unit_type", "unit_cost"]]

    # Sort by model_name, litellm_provider, and token_type
    df_melted = df_melted.sort_values(["litellm_provider", "model_name", "unit_type"])

    return df_melted


if __name__ == "__main__":
    # URL for the model prices JSON file
    url = "https://raw.githubusercontent.com/BerriAI/litellm/refs/heads/main/model_prices_and_context_window.json"

    # Process the file
    df = process_model_prices(url)

    # Display basic information about the DataFrame
    print("\nDataFrame Info:")
    print(df.info())

    # Save to CSV for easy viewing
    df.to_csv("litellm_model_prices.csv", index=False)
    print("\nData has been saved to 'litellm_model_prices.csv'")

    # Create and save the token type version
    df_token_type = create_token_type_df(df)
    df_token_type.to_csv("litellm_model_prices_by_token_type.csv", index=False)
    print("\nToken type data has been saved to 'litellm_model_prices_by_token_type.csv'")
