import json
import os
import httpx
from typing import Dict, Any, Optional
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin
import pandas as pd
import phoenix as px
import sys
import traceback
import logging
import uvicorn

# --- FastAPI Imports ---
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

logging.info("--- FastAPI Server Script: START ---")

# --- Configuration (Copied from previous script) ---
PHOENIX_URL = os.getenv("PHOENIX_URL", "http://localhost:6006")
PROJECT_NAME = os.getenv("PHOENIX_PROJECT_NAME", "openai-chat")

# --- Initialize Phoenix Client (Copied from previous script) ---
px_client = None
logging.info("Attempting px.Client() connection...")
try:
    px_client = px.Client(endpoint=PHOENIX_URL)
    logging.info(f"Successfully connected Phoenix client to {PHOENIX_URL}. Targeting project: '{PROJECT_NAME}'")
except Exception as e:
    logging.error(f"Error connecting Phoenix client: {e}", exc_info=True)
    logging.error("Ensure Phoenix server is running (`python -m phoenix.server.main serve`)")
    # Consider exiting or disabling tools if client fails

# --- Tool Function Definitions (Copied *logic* from FastMCP tools) ---
# We define them as regular async functions now, not FastMCP tools

async def list_traces_logic(limit: int = 10, minutes_ago: int = 1440) -> str:
    # This is the *implementation* from your @server.tool()
    logging.info(f"Executing list_traces_logic (limit={limit}, minutes_ago={minutes_ago})")
    if not px_client:
        logging.error("list_traces_logic: Phoenix client not connected.")
        return json.dumps({"error": "Phoenix client not connected."})
    try:
        logging.info(f"list_traces_logic: Fetching all spans for project '{PROJECT_NAME}'...")
        df_all = px_client.get_spans_dataframe(project_name=PROJECT_NAME)
        if df_all is None or df_all.empty:
             logging.warning(f"list_traces_logic: No spans found at all in project '{PROJECT_NAME}'.")
             return json.dumps({"message": f"No spans found at all in project '{PROJECT_NAME}'.", "traces": []})

        logging.info(f"list_traces_logic: Fetched {len(df_all)} total spans. Filtering...")

        # --- Start Filtering Logic ---
        if 'start_time' in df_all.columns and not pd.api.types.is_datetime64_any_dtype(df_all['start_time']):
             df_all['start_time'] = pd.to_datetime(df_all['start_time'], errors='coerce')
        # Filter for root spans (parent_id is NaN or None)
        df_roots = df_all[pd.isna(df_all['parent_id'])].copy()
        end_time = datetime.now(timezone.utc)
        start_time_limit = end_time - timedelta(minutes=minutes_ago)
        # Filter by time window
        if pd.api.types.is_datetime64_any_dtype(df_roots['start_time']):
             if df_roots['start_time'].dt.tz is None:
                  df_roots['start_time'] = df_roots['start_time'].dt.tz_localize('UTC')
             df_roots = df_roots[df_roots['start_time'] >= start_time_limit].copy()
        else:
             logging.warning("list_traces_logic: Could not filter by time, start_time column format issue.")

        if df_roots.empty:
             logging.info(f"list_traces_logic: No root spans found in the last {minutes_ago} minutes.")
             return json.dumps({"message": f"No root spans (traces) found in the last {minutes_ago} minutes for project '{PROJECT_NAME}'.", "traces": []})

        df_roots = df_roots.sort_values(by='start_time', ascending=False).head(limit)
        logging.info(f"list_traces_logic: Found {len(df_roots)} matching root spans. Constructing JSON...")
        # --- End Filtering Logic ---

        # --- Start Manual JSON Construction ---
        traces_output = []
        for index, row in df_roots.iterrows():
            trace_entry = {}
            # Using .get() with default is safer than 'in' checks
            trace_id_val = row.get('context.trace_id', row.get('trace_id'))
            if pd.notna(trace_id_val):
                trace_entry['trace_id'] = trace_id_val

            if pd.notna(row.get('name')):
                trace_entry['name'] = row['name']

            start_time_val = row.get('start_time')
            if pd.notna(start_time_val):
                 if isinstance(start_time_val, pd.Timestamp):
                      trace_entry['start_time'] = start_time_val.isoformat()
                 else:
                      try: trace_entry['start_time'] = pd.to_datetime(start_time_val).isoformat()
                      except: trace_entry['start_time'] = str(start_time_val) # Fallback

            latency_val = row.get('latency_ms', row.get('latency', row.get('duration')))
            if pd.notna(latency_val):
                 try:
                     if isinstance(latency_val, pd.Timedelta):
                         trace_entry['latency_ms'] = latency_val.total_seconds() * 1000
                     elif 'duration' in row and latency_val == row['duration']: # Check if it was duration
                          trace_entry['latency_ms'] = float(latency_val) / 1_000_000 # nanoseconds to ms
                     else:
                          trace_entry['latency_ms'] = float(latency_val)
                 except:
                     logging.warning(f"list_traces_logic: Could not convert latency value {latency_val} to float.", exc_info=True)
                     trace_entry['latency_ms'] = None

            status_code_val = row.get('status.code', row.get('status_code'))
            if pd.notna(status_code_val):
                trace_entry['status_code'] = status_code_val

            traces_output.append(trace_entry)
        # --- End Manual JSON Construction ---

        result_json = json.dumps({"project_name": PROJECT_NAME, "traces": traces_output}, indent=2, default=str)
        logging.info("list_traces_logic: Success")
        return result_json
    except Exception as e:
        logging.error(f"Exception in list_traces_logic", exc_info=True)
        return json.dumps({"error": f"Failed to list traces: {str(e)}"})

async def get_trace_logic(trace_id: str) -> str:
    # This is the *implementation* from your @server.tool()
    logging.info(f"Executing get_trace_logic (trace_id={trace_id})")
    if not px_client:
        logging.error("get_trace_logic: Phoenix client not connected.")
        return json.dumps({"error": "Phoenix client not connected."})
    try:
        # --- Start get_trace Logic ---
        filter_string = f"trace_id == '{trace_id}'"
        logging.info(f"get_trace_logic: Querying spans for trace_id: {trace_id} in project '{PROJECT_NAME}' using filter string: {filter_string}")

        df = px_client.get_spans_dataframe(filter_string, project_name=PROJECT_NAME)

        if df is None or df.empty:
             logging.warning(f"get_trace_logic: Trace '{trace_id}' not found in project '{PROJECT_NAME}'.")
             return json.dumps({"error": f"Trace '{trace_id}' not found.", "trace_id": trace_id})

        logging.info(f"get_trace_logic: Found {len(df)} spans for trace {trace_id}. Serializing...")
        # --- Start Data Serialization ---
        for col in df.select_dtypes(include=['datetime64[ns]', 'datetime64[ns, UTC]']).columns:
             df.loc[:, col] = df[col].apply(lambda x: x.isoformat() if pd.notnull(x) else None)
        if 'latency' in df.columns and pd.api.types.is_timedelta64_dtype(df['latency']):
             df.loc[:, 'latency_ms'] = df['latency'].apply(lambda x: x.total_seconds() * 1000 if pd.notnull(x) else None)
        # --- End Data Serialization ---

        spans_json = df.to_dict(orient='records')

        result = {
             "trace_id": trace_id, "project_name": PROJECT_NAME,
             "span_count": len(spans_json), "spans": spans_json
        }
        # --- End get_trace Logic ---
        result_json = json.dumps(result, indent=2, default=str)
        logging.info("get_trace_logic: Success")
        return result_json
    except Exception as e:
        logging.error(f"Exception in get_trace_logic", exc_info=True)
        return json.dumps({"error": f"Failed to get trace '{trace_id}': {str(e)}", "trace_id": trace_id})

async def check_health_logic() -> str:
    # This is the *implementation* from your @server.tool()
    logging.info("Executing check_health_logic")
    url = urljoin(PHOENIX_URL, "/")
    try:
        # --- Start check_health Logic ---
        logging.info(f"Checking Phoenix health via root endpoint ('/') at {url}")
        async with httpx.AsyncClient() as client:
             response = await client.head(url, headers={"Accept": "text/html"}, timeout=10.0)
        logging.info(f"Health check status: {response.status_code}")
        status = "healthy" if response.is_success else "unhealthy"
        result_json = json.dumps({
             "status": status, "checked_url": url, "http_status": response.status_code,
        })
        # --- End check_health Logic ---
        logging.info("check_health_logic: Success")
        return result_json
    except Exception as e:
        logging.error(f"Exception in check_health_logic", exc_info=True)
        return json.dumps({"status": "unhealthy", "checked_url": url, "error": str(e)})

# --- FastAPI App Definition ---
app = FastAPI(title="Phoenix Tools FastAPI Server")

# Define the request body model to match FastMCP's /call_tool payload
class ToolCallRequest(BaseModel):
    tool: str
    args: Dict[str, Any] = {} # Arguments are optional

# Create the /call_tool endpoint
@app.post("/call_tool")
async def call_tool_endpoint(request: ToolCallRequest):
    logging.info(f"Received /call_tool request: tool='{request.tool}', args={request.args}")
    tool_name = request.tool
    args = request.args

    try:
        if tool_name == "list_traces":
            # Pass args using dictionary unpacking
            result_json_string = await list_traces_logic(**args)
        elif tool_name == "get_trace":
            result_json_string = await get_trace_logic(**args)
        elif tool_name == "check_health":
            result_json_string = await check_health_logic(**args) # Should have no args typically
        else:
            logging.error(f"Unknown tool requested: {tool_name}")
            raise HTTPException(status_code=400, detail=f"Unknown tool: {tool_name}")

        # Return the result in the FastMCP-like format
        # The tool functions should already return JSON strings
        return {"result": result_json_string}

    except HTTPException as http_exc:
        # Re-raise FastAPI specific exceptions
        raise http_exc
    except Exception as e:
        logging.error(f"Error executing tool '{tool_name}'", exc_info=True)
        # Return a JSON error compatible with the RAG bot's error handling
        error_result = json.dumps({"error": f"Server error executing tool '{tool_name}': {str(e)}"})
        # Return 500, but structure the response so client might parse it
        return {"result": error_result} # Or raise HTTPException(500, detail=...)

# --- Main block to run this FastAPI app with uvicorn ---
if __name__ == "__main__":
    logging.info("--- Script Main Block: START ---")
    host = "127.0.0.1"
    port = 5174 # Use the designated HTTP port

    logging.info(f"Starting FastAPI server via uvicorn.run on http://{host}:{port}")
    try:
        # Point uvicorn to the FastAPI app instance in *this* file
        # Format is "filename_without_py:app_variable_name"
        # Since we are in __main__, we can pass the 'app' object directly
        uvicorn.run(app, host=host, port=port)
    except Exception as e:
         logging.error(f"Failed to start server with uvicorn.run. Error: {e}", exc_info=True)

    logging.info("--- Script Main Block: server finished ---") 