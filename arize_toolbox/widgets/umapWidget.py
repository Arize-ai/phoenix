import os

from IPython.core.display import HTML, display  # type: ignore

import arize_toolbox

BASE_PATH = arize_toolbox.__path__[0]  # type: ignore
STATIC_PATH = os.path.join(BASE_PATH, "nbextension", "static")

"""Loads the compiled Javascript bundle"""


def loadJS():
    return open(os.path.join(STATIC_PATH, "index.js"), encoding="utf-8").read()


class UMAPWidget:
    def template(self):
        return f"""
        <html>
            <script>{loadJS()}</script>
                <body>
                    <div id='root'>
                    </div>
                </body>
            <script>window.renderUMAPWidget();</script>
        </html>
        """

    def show(self):
        display(HTML(self.template()))
