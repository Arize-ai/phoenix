import os
import sys

sys.path.insert(0, os.path.abspath("../../"))
sys.path.insert(0, os.path.abspath("../../src/phoenix"))
# sys.path.insert(0, os.path.abspath('../../packages/phoenix-evals/src/phoenix/evals'))


# https://stackoverflow.com/questions/57610288/showing-only-private-methods-with-sphinx-autodoc
# https://stackoverflow.com/questions/64351260/how-to-document-only-a-subset-of-functions-in-sphinx
def include_only_tagged(app, what, name, obj, skip, options):
    inclusion_tag_format = ".. only:: {}"  # can be any pattern here, choose what works for you
    for tag in app.tags.tags:
        if obj.__doc__ is not None and inclusion_tag_format.format(tag) in obj.__doc__:
            return False
    return True


def setup(app):
    if len(app.tags.tags) > 0:
        app.connect("autodoc-skip-member", include_only_tagged)


# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

project = "Phoenix"
copyright = "2024, Arize"
author = "Arize"

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

extensions = ["sphinx.ext.autodoc", "sphinx.ext.napoleon"]

# Napoleon settings
napoleon_google_docstring = True
napoleon_numpy_docstring = True

templates_path = ["_templates"]
exclude_patterns = []


# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = "sphinx_rtd_theme"
html_static_path = ["_static"]
