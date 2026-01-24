import json
import sqlite3

import numpy as np

DATABASE_NAME = "examples/agent_framework_comparison/db/example_traces.db"
TABLE_NAME = "traces"


def save_df_to_db(df):
    def handle_nested_types(y):
        try:
            if isinstance(y, np.ndarray):
                return y.tolist()
            elif isinstance(y, (dict, list)):
                return json.dumps(
                    {k: handle_nested_types(v) for k, v in y.items()}
                    if isinstance(y, dict)
                    else [handle_nested_types(item) for item in y]
                )
            else:
                return y
        except Exception as e:
            print(f"Error handling nested type: {e}")
            return y

    # Unnest the nested types and convert to string since sqlite3 doesn't support nested types
    df = df.map(handle_nested_types)
    df = df.map(str)
    df.to_sql(
        name=TABLE_NAME,
        con=sqlite3.connect(DATABASE_NAME),
        if_exists="replace",
        index=False,
    )


def run_query(sql_query):
    # Connect to the SQLite database
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()

    try:
        # Execute the SQL query
        cursor.execute(sql_query)

        # Fetch all results if it's a SELECT query
        if sql_query.strip().upper().startswith("SELECT"):
            results = cursor.fetchall()
        else:
            # Commit the changes for non-SELECT queries
            conn.commit()
            results = cursor.rowcount

    except sqlite3.Error as e:
        # Handle any SQL errors
        results = f"An error occurred: {e}"

    # Close the connection
    conn.close()

    return results


def get_schema():
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()

    # Get the schema for the traces table
    cursor.execute(f"PRAGMA table_info({TABLE_NAME});")
    columns = cursor.fetchall()

    schema = [
        {
            "name": col[1],
            "type": col[2],
            "notnull": col[3],
            "default_value": col[4],
            "pk": col[5],
        }
        for col in columns
    ]

    conn.close()
    return schema


def get_table():
    return TABLE_NAME


if __name__ == "__main__":
    print(run_query("SELECT attributes.retrieval.documents FROM traces"))
