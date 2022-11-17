import os
import json
from random import random
from IPython.core.display import HTML, display  # type: ignore

import arize_toolbox

BASE_PATH = arize_toolbox.__path__[0]  # type: ignore
STATIC_PATH = os.path.join(BASE_PATH, "nbextension", "static")

"""Loads the compiled Javascript bundle"""


def load_js():
    return open(os.path.join(STATIC_PATH, "index.js"), encoding="utf-8").read()


def random_position(offset):
    return {
        "position": [
            random() + offset,
            random() + offset,
            random() + offset,
        ]
    }


def generate_data(length: int, offset: int):
    data = [None] * length
    return list(map(lambda r: random_position(offset), data))


class UMAPWidget:
    def template(self):
        json_data = self.to_json()
        return f"""
        <html>
            <script>{load_js()}</script>
                <body>
                    <div id='root'>
                    </div>
                </body>
            <script>window.renderUMAPWidget({json_data});</script>
        </html>
        """

    # Temporary static json representation of UMAP Drift data

    def to_json(self):
        data = {
            "primaryData": generate_data(100, 0),
            "referenceData": generate_data(100, 1),
        }
        return json.dumps(data)

    def show(self):
        display(HTML(self.template()))
