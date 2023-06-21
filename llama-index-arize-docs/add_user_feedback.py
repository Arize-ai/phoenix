"""
Add user feedback to query data.
"""


import argparse

import pandas as pd


def add_user_feedback(query_data, user_feedback):
    pd.read_parquet("data/queries.parquet").to_csv("data/queries.csv", index=False)

    # Read in query data


if __name__ == "__main__":
    argparser = argparse.ArgumentParser()
    argparser.add_argument("input_query_data_path", type=str, help="path to input query data")
    argparser.add_argument("output_query_data_path", type=str, help="path to output query data")
    parser = argparser.parse_args()

    query_df = pd.read_parquet(parser.input_query_data_path)
    user_feedback_df = pd.read_parquet(parser.input_user_feedback_path)
