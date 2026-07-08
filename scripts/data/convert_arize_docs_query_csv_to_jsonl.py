"""
Converts the Arize docs questions CSV to JSONL.
"""

import argparse
import json

import pandas as pd

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("input_csv_path", type=str, help="Path to the Arize docs questions CSV.")
    parser.add_argument(
        "output_jsonl_path",
        type=str,
        help="Path to the output JSONL file.",
    )
    args = parser.parse_args()

    query_df = pd.read_csv(args.input_csv_path)[["Question"]].rename(columns={"Question": "query"})
    records = query_df.to_dict(orient="records")
    with open(args.output_jsonl_path, "w") as f:
        for record in records:
            f.write(json.dumps(record) + "\n")
