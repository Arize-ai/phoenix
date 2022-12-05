"""
Loads the compiled Javascript bundle
"""
import json
import os
from random import random

from IPython.core.display import HTML, display  # type: ignore

import phoenix

BASE_PATH = phoenix.__path__[0]  # type: ignore
STATIC_PATH = os.path.join(BASE_PATH, "nbextension", "static")


def load_js():
    return open(
        os.path.join(STATIC_PATH, "index.js"),
        encoding="utf-8",
    ).read()


def load_style():
    return """
        body {
            font-family: 'Roboto', sans-serif;
            }
    """


def random_point(offset: int, id: int):
    return {
        "position": [
            random() + offset,
            random() + offset,
            random() + offset,
        ],
        "metaData": {"id": id},
    }


def generate_data(length: int, offset: int, id_offset: int):
    data = enumerate([None] * length)
    return list(
        map(
            lambda i: random_point(offset, id=i[0] + id_offset),
            data,
        )
    )


def demo_json():
    data = {
        "primaryData": generate_data(100, 0, 0),
        "referenceData": generate_data(100, 1, 100),
    }
    return json.dumps(data)


class UMAPWidget:
    def __init__(self, json: str):
        self.json = json

    def template(self, json_data: str):
        return f"""
        <html>
            <script>{load_js()}</script>
            <style>{load_style()}</style>
                <body>
                    <div id='root'>
                    </div>
                </body>
            <script>window.renderUMAPWidget({json_data});</script>
        </html>
        """

    # Temporary static json representation of UMAP Drift data

    def show(self):
        display(HTML(self.template(self.json)))
