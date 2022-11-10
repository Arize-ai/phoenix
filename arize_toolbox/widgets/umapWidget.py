from IPython.core.display import display, HTML

class UMAPWidget:
    def __init__(self):
        print("hello world from widget")

    def template(self):
        return f"""
        <html><body><div id="root">Hello World Yada yada yada</div></body></html>"""

    def show(self):
        display(HTML(self.template))
