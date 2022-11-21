"""
This is a description for umapWidget
"""
import json
import os
from random import random

import phoenix
from IPython.core.display import HTML, display  # type: ignore

BASE_PATH = phoenix.__path__[0]  # type: ignore
STATIC_PATH = os.path.join(BASE_PATH, "nbextension", "static")

"""Loads the compiled Javascript bundle"""


def load_js():
    """
    It opens the file `index.js` in the `static` directory and returns the contents
    :return: The contents of the file index.js
    """
    return open(
        os.path.join(STATIC_PATH, "index.js"),
        encoding="utf-8",
    ).read()


def random_position(offset):
    """
    It returns a dictionary with a single key, "position", whose value is a list of three random
    numbers
    between 0 and 1

    :param offset: This is the offset from the origin
    :return: A dictionary with a key of "position" and a value of a list of three random numbers.
    """
    return {
        "position": [
            random() + offset,
            random() + offset,
            random() + offset,
        ]
    }


def generate_data(length: int, offset: int):
    """
    It generates a list of random positions, each of which is offset by a given amount

    :param length: the number of data points to generate
    :type length: int
    :param offset: The offset of the random position
    :type offset: int
    :return: A list of random positions.
    """
    data = [None] * length
    return list(
        map(
            lambda r: random_position(offset),
            data,
        )
    )


def demo_json():
    """
    It generates two arrays of 100 random numbers, and returns them as a JSON string
    :return: A JSON string
    """
    data = {
        "primaryData": generate_data(100, 0),
        "referenceData": generate_data(100, 1),
    }
    return json.dumps(data)


# > This class is a widget that allows the user to interactively explore the UMAP embedding of the
# data
class UMAPWidget:
    """
    TBD
    """

    def __init__(self, json: str):
        """
        This function takes a string as an argument and assigns it to the variable json

        :param json: The JSON string to be parsed
        :type json: str
        """
        self.json = json

    def template(self, json_data: str):
        """
        It takes a JSON string as input, and returns an HTML string that contains the JSON string
        as a
        JavaScript object

        :param json_data: This is the JSON data that will be passed to the JavaScript code
        :type json_data: str
        :return: A string that contains the HTML code for the UMAP widget.
        """
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

    def show(self):
        """
        > The function takes a JSON object and displays it in a nice HTML table
        """
        display(HTML(self.template(self.json)))
