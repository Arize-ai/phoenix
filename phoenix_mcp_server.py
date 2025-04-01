# phoenix_mcp_server.py
import json
import os
import httpx
from typing import List, Dict, Any, Optional
from fastmcp import FastMCP
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin
import pandas as pd
import phoenix as px
import sys # Import sys
import traceback # Import traceback
# Removed uvicorn import

print("--- Script Top Level: START ---")

# Initialize MCP server - Restore stdio=True
server = FastMCP(
    "Phoenix Traces",
    command="python", # Re-add command/args if needed for Inspector process management
    args=["phoenix_mcp_server.py"],
    stdio=True # Re-enable stdio=True
)
print("--- Script Top Level: FastMCP Initialized (with stdio=True) ---")

# Configuration
PHOENIX_URL = "http://localhost:6006"
PROJECT_NAME = "openai-chat" # Set your target project name

# Initialize Phoenix Client
px_client = None # Initialize as None
print("--- Script Top Level: Attempting px.Client() connection... ---")
try:
    px_client = px.Client()
    print(f"--- Script Top Level: Successfully connected Phoenix client. Targeting project: '{PROJECT_NAME}' ---")
except Exception as e:
    print(f"--- Script Top Level: Error connecting Phoenix client: {e} ---")
    print("Please ensure the Phoenix server is running (`python -m phoenix.server.main serve`)")
    # Keep px_client as None

# --- Tool Definitions using phoenix client ---

@server.tool()
async def list_traces(limit: int = 10, minutes_ago: int = 1440) -> str:
    print(f"\n>>> ENTERING list_traces tool (limit={limit}, minutes_ago={minutes_ago})")
    sys.stdout.flush() # Force flush output buffer
    """List recent traces (root spans) using get_spans_dataframe and pandas filtering."""
    if not px_client:
        return json.dumps({"error": "Phoenix client not connected."})
    try:
        print(f"Fetching all spans for project '{PROJECT_NAME}' to find root spans...")
        sys.stdout.flush()
        df_all = px_client.get_spans_dataframe(project_name=PROJECT_NAME)

        if df_all is None or df_all.empty:
            return json.dumps({"message": f"No spans found at all in project '{PROJECT_NAME}'.", "traces": []})

        # --- DEBUG: Log initial columns ---
        print(f"Initial columns fetched: {df_all.columns.tolist()}")
        # --- End DEBUG ---

        print(f"Fetched {len(df_all)} total spans. Filtering for root spans and time window...")
        sys.stdout.flush()

        # --- Filter in Memory using Pandas ---
        if 'start_time' in df_all.columns and not pd.api.types.is_datetime64_any_dtype(df_all['start_time']):
             df_all['start_time'] = pd.to_datetime(df_all['start_time'], errors='coerce')
        df_roots = df_all[pd.isna(df_all['parent_id'])].copy()
        end_time = datetime.now(timezone.utc)
        start_time_limit = end_time - timedelta(minutes=minutes_ago)
        if pd.api.types.is_datetime64_any_dtype(df_roots['start_time']):
             if df_roots['start_time'].dt.tz is None:
                  df_roots['start_time'] = df_roots['start_time'].dt.tz_localize('UTC')
             df_roots = df_roots[df_roots['start_time'] >= start_time_limit].copy()
        else:
             print("Warning: Could not filter by time, start_time column format issue.")

        if df_roots.empty:
             return json.dumps({"message": f"No root spans (traces) found in the last {minutes_ago} minutes for project '{PROJECT_NAME}'.", "traces": []})

        df_roots = df_roots.sort_values(by='start_time', ascending=False).head(limit)

        # --- DEBUG: Log columns and first row after filtering ---
        print(f"Columns in df_roots after filtering: {df_roots.columns.tolist()}")
        if not df_roots.empty:
            print(f"Data of first filtered root row:\n{df_roots.iloc[0].to_dict()}")
        # --- End DEBUG ---

        print(f"Found {len(df_roots)} matching root spans (traces).")
        # --- End Filtering ---

        # --- Start Manual JSON Construction ---
        traces_output = []
        # Use the logged columns to confirm names
        for index, row in df_roots.iterrows():
            trace_entry = {}
            # Check standard names first
            if 'trace_id' in row and pd.notna(row['trace_id']):
                trace_entry['trace_id'] = row['trace_id']
            # Add check for potential alternative name if standard one fails
            elif 'context.trace_id' in row and pd.notna(row['context.trace_id']):
                 print("Note: Using 'context.trace_id' instead of 'trace_id'")
                 trace_entry['trace_id'] = row['context.trace_id']

            if 'name' in row and pd.notna(row['name']):
                trace_entry['name'] = row['name']

            if 'start_time' in row and pd.notna(row['start_time']):
                 start_time_val = row['start_time']
                 if isinstance(start_time_val, pd.Timestamp):
                      trace_entry['start_time'] = start_time_val.isoformat()
                 else:
                      try: trace_entry['start_time'] = pd.to_datetime(start_time_val).isoformat()
                      except: trace_entry['start_time'] = str(start_time_val)

            # Check standard 'latency' or calculated 'latency_ms'
            if 'latency_ms' in row and pd.notna(row['latency_ms']):
                 trace_entry['latency_ms'] = row['latency_ms']
            elif 'latency' in row and pd.notna(row['latency']):
                 if isinstance(row['latency'], pd.Timedelta):
                     trace_entry['latency_ms'] = row['latency'].total_seconds() * 1000
                 else:
                      try: trace_entry['latency_ms'] = float(row['latency'])
                      except: trace_entry['latency_ms'] = None
            # Check for 'duration' as alternative from OTel spec
            elif 'duration' in row and pd.notna(row['duration']):
                 print("Note: Using 'duration' for latency")
                 try: # Duration might be nanoseconds
                      trace_entry['latency_ms'] = float(row['duration']) / 1_000_000
                 except:
                      trace_entry['latency_ms'] = None


            if 'status_code' in row and pd.notna(row['status_code']):
                trace_entry['status_code'] = row['status_code']
            elif 'status.code' in row and pd.notna(row['status.code']): # Alternative naming
                 print("Note: Using 'status.code' instead of 'status_code'")
                 trace_entry['status_code'] = row['status.code']


            traces_output.append(trace_entry)
        # --- End Manual JSON Construction ---

        print(f"Constructed JSON output (first item): {traces_output[0] if traces_output else 'None'}")
        sys.stdout.flush()
        result_json = json.dumps({"project_name": PROJECT_NAME, "traces": traces_output}, indent=2, default=str)
        print("<<< EXITING list_traces tool (Success)")
        sys.stdout.flush()
        return result_json

    except Exception as e:
        print(f"!!! Exception in list_traces tool: {type(e).__name__}: {str(e)}")
        print(traceback.format_exc()) # Print full traceback
        sys.stdout.flush() # Flush before returning error
        error_json = json.dumps({"error": f"Failed to list traces for project '{PROJECT_NAME}': {str(e)}"})
        print("<<< EXITING list_traces tool (Exception)")
        return error_json


@server.tool()
async def get_trace(trace_id: str) -> str:
    print(f"\n>>> ENTERING get_trace tool (trace_id={trace_id})")
    sys.stdout.flush() # Force flush output buffer
    """Get all spans for a specific trace ID using get_spans_dataframe for the configured project."""
    # This tool should still work correctly as it uses the reliable filtering method
    if not px_client:
        return json.dumps({"error": "Phoenix client not connected."})
    try:
        filter_string = f"trace_id == '{trace_id}'"
        print(f"Querying spans for trace_id: {trace_id} in project '{PROJECT_NAME}' using filter string: {filter_string}")

        # Use get_spans_dataframe with the filter string AND project_name
        df = px_client.get_spans_dataframe(filter_string, project_name=PROJECT_NAME)

        if df is None or df.empty:
             # If get_spans_dataframe fails, the trace likely doesn't exist or isn't queryable this way
             return json.dumps({"error": f"Trace '{trace_id}' not found in project '{PROJECT_NAME}' using get_spans_dataframe.", "trace_id": trace_id})

        # --- Start Data Serialization ---
        for col in df.select_dtypes(include=['datetime64[ns]', 'datetime64[ns, UTC]']).columns:
             df.loc[:, col] = df[col].apply(lambda x: x.isoformat() if pd.notnull(x) else None)
        if 'latency' in df.columns and pd.api.types.is_timedelta64_dtype(df['latency']):
             df.loc[:, 'latency_ms'] = df['latency'].apply(lambda x: x.total_seconds() * 1000 if pd.notnull(x) else None)
        # --- End Data Serialization ---

        spans_json = df.to_dict(orient='records')
        
        result = {
            "trace_id": trace_id,
            "project_name": PROJECT_NAME,
            "span_count": len(spans_json),
            "spans": spans_json
        }
        sys.stdout.flush()
        result_json = json.dumps(result, indent=2, default=str)
        print("<<< EXITING get_trace tool (Success)")
        sys.stdout.flush()
        return result_json
    except Exception as e:
        print(f"!!! Exception in get_trace tool: {type(e).__name__}: {str(e)}")
        print(traceback.format_exc()) # Print full traceback
        sys.stdout.flush() # Flush before returning error
        error_json = json.dumps({"error": f"Failed to get trace '{trace_id}' from project '{PROJECT_NAME}': {str(e)}", "trace_id": trace_id})
        print("<<< EXITING get_trace tool (Exception)")
        return error_json


@server.tool()
async def check_health() -> str:
    print(f"\n>>> ENTERING check_health tool") # Add entry log
    sys.stdout.flush() # Flush output buffer
    """Check the health/status of the Phoenix server UI via root."""
    url = urljoin(PHOENIX_URL, "/")
    try:
        print(f"\nChecking Phoenix health via root endpoint ('/') at {url}")
        async with httpx.AsyncClient() as client:
            response = await client.head(url, headers={"Accept": "text/html"}, timeout=10.0)
        print(f"Health check status: {response.status_code}")
        is_healthy = response.is_success
        status = "healthy" if is_healthy else "unhealthy"
        result_json = json.dumps({
            "status": status,
            "checked_url": url,
            "http_status": response.status_code,
        })
        print("<<< EXITING check_health tool (Success)") # Add success exit log
        sys.stdout.flush()
        return result_json
    except Exception as e:
        print(f"!!! Exception in check_health tool: {type(e).__name__}: {str(e)}")
        sys.stdout.flush() # Flush before returning error
        error_json = json.dumps({"status": "unhealthy", "checked_url": url, "error": str(e)})
        print("<<< EXITING check_health tool (Exception)") # Add exception exit log
        return error_json

if __name__ == "__main__":
    print(f"--- Script Main Block: START ---")
    print(f"Starting Phoenix MCP Server...")
    print(f"Target Phoenix URL (for health check): {PHOENIX_URL}")
    print(f"Target Phoenix Project (for tools): '{PROJECT_NAME}'")
    print("MCP Server interacting via Phoenix Python Client.")
    print("\nAvailable tools:")
    print("  1. check_health - Check if the Phoenix server UI is reachable via HTTP.")
    print("  2. list_traces - List recent traces (uses get_spans_dataframe + pandas filter). Args: limit, minutes_ago")
    print("  3. get_trace - Get all spans for a specific trace (uses get_spans_dataframe). Args: trace_id")
    if not px_client:
         print("\n--- Script Main Block: WARNING: Phoenix client connection failed. Tools might not function. ---")
    else:
         print("\n--- Script Main Block: Phoenix client seems connected. ---")

    # --- Restore simple server.run() for stdio mode ---
    print(f"--- Script Main Block: Starting server via server.run() (expecting stdio communication) ---")
    sys.stdout.flush()
    try:
        server.run() # No arguments, relies on stdio=True setting
    except Exception as e:
        print(f"!!! Failed to start server. Error: {type(e).__name__}: {e}")
        print(traceback.format_exc())

    print("--- Script Main Block: server finished (if run completed/exited) ---")