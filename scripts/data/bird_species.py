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
        spc = birds.loc[:, "Species"]
        ascii_only = spc.apply(lambda s: s.isascii())
        pair_only = spc.apply(lambda s: len(s.replace("-", " ").split()) == 2)
        species = (
            spc.loc[ascii_only & pair_only]
            .sort_values()
            .drop_duplicates()
            .str.lower()
            .str.replace(" ", "-")
        )
        print(
            '[\n    "'
            + '",\n    "'.join(
                species.sample(
                    100,
                    random_state=42,
                ).sort_values()
            )
            + '",\n]'
        )
