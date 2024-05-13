"""
pip install openpyxl
"""

import tempfile
import urllib.request

import pandas as pd

if __name__ == "__main__":
    with tempfile.NamedTemporaryFile() as tmp:
        urllib.request.urlretrieve(
            "https://avibase.bsc-eoc.org/downloads/PETERS_DATABASE_version_1.xlsx",
            tmp.name,
        )
        birds = pd.read_excel(tmp.name, sheet_name="PETERS 1-15, PETERS2 v.1")
        print(
            '[\n    "'
            + '",\n    "'.join(
                birds.loc[:, "Species"]
                .sort_values()
                .drop_duplicates()
                .sample(100, random_state=42)
                .str.lower()
                .str.replace(" ", "-")
                .sort_values()
            )
            + '",\n]'
        )
