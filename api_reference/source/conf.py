"""
Configuration file for the Sphinx documentation builder.

This file only contains a selection of the most common options. For a full
list see the documentation:
https://www.sphinx-doc.org/en/master/usage/configuration.html
"""

# -- Path setup --------------------------------------------------------------

import os
import sys

# Path setup for autodoc
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE_DIR, "src", "phoenix"))
sys.path.insert(0, os.path.join(BASE_DIR, "packages", "phoenix-evals", "src", "phoenix"))

# Sphinx-related utility functions
import utils
import phoenix

# -- Generation setup --------------------------------------------------------

def setup(app):
    app.add_css_file("custom.css")
    app.add_js_file("custom.js")
    app.connect("source-read", utils.clean_doc_output)  # Remove unnecessary headers

# -- Project information -----------------------------------------------------

project = "Phoenix API Reference"
copyright = "2024, Arize AI"
author = "Arize AI"

# -- General configuration ---------------------------------------------------

source_suffix = [".rst", ".md", ".txt"]

extensions = [
    "sphinx.ext.autodoc",
    "sphinx.ext.autosummary",
    "sphinx.ext.napoleon",
    "myst_parser",
]

# Add any paths that contain templates here, relative to this directory.
templates_path = ["_templates"]

# List of patterns, relative to source directory, that match files
# and directories to ignore when looking for source files.
# This pattern also affects html_static_path and html_extra_path.
exclude_patterns = []

add_module_names = False

# -- Extension configuration -------------------------------------------------

# Napoleon
napoleon_google_docstring = True
napoleon_numpy_docstring = True

# Autosummary
autosummary_generate = True  # Generate API documentation when building

# MyST
# This allows us to use ::: to denote directives, useful for admonitions
myst_enable_extensions = ["colon_fence", "linkify", "substitution"]
myst_heading_anchors = 2
myst_substitutions = {"rtd": "[Read the Docs](https://readthedocs.org/)"}

# Autodoc
# autodoc_class_signature = 'separated'  # Separate the signature from the class title
autoclass_content = "class"  # Only include the class docstring, not the __init__ method docstring
autodoc_typehints = "none"
add_function_parentheses = False
autodoc_preserve_defaults = True
autodoc_typehints_description_target = "documented_params"

autodoc_default_options = {
    "members": True,
    "private-members": False,
    "special-members": "",
    "undoc-members": False,
    "inherited-members": False,
    "show-inheritance": True,
}

# -- Internationalization ----------------------------------------------------

# specifying the natural language populates some key tags
language = "en"

# -- Versioning --------------------------------------------------------------

json_url = "https://arize-phoenix.readthedocs.io/en/latest/_static/switcher.json"

# Based off the pydata theme config file:
# https://github.com/pydata/pydata-sphinx-theme/blob/main/docs/conf.py

# Define the version we use for matching in the version switcher.
version_match = os.environ.get("READTHEDOCS_VERSION")
release = phoenix.__version__

# If READTHEDOCS_VERSION doesn't exist, we're not on RTD
# If it is an integer, we're in a PR build and the version isn't correct.
# If it's "latest" → change to "dev" (that's what we want the switcher to call it)
if not version_match or version_match.isdigit() or version_match == "latest":
    # For local development, infer the version to match from the package.
    if "dev" in release or "rc" in release:
        version_match = "dev"
        # We want to keep the relative reference if we are in dev mode
        # but we want the whole url if we are effectively in a released version
        json_url = "_static/switcher.json"
    else:
        version_match = f"v{release}"
elif version_match == "stable":
    version_match = f"v{release}"

# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = "pydata_sphinx_theme"
# pygments_style = "sphinx"  # Name of the Pygments (syntax highlighting) style to use.
html_static_path = ["_static"]
html_css_files = ["custom.css"]
html_js_files = ["custom.js"]
html_show_sphinx = False

html_theme_options = {
    "logo": {
        "text": "Phoenix API",
        "image_light": "logo.png",
        "image_dark": "logo_dark.png",
    },
    "icon_links": [
        {
            "name": "GitHub",
            "url": "https://github.com/Arize-ai/phoenix",
            "icon": "fa-brands fa-github",
        },
        {
            "name": "Twitter",
            "url": "https://x.com/ArizePhoenix",
            "icon": "fa-brands fa-twitter",
        },
    ],
    "external_links": [
        {"name": "Docs", "url": "https://docs.arize.com/phoenix"},
    ],
    "navbar_align": "content",
    "navbar_start": ["navbar-logo", "version-switcher"],
    "switcher": {
        "json_url": json_url,
        "version_match": version_match,
    },
    "footer_start": [],
    "footer_end": ["copyright"],
}

html_sidebars = {"**": ["sidebar-nav-bs"]}
