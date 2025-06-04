"""
Configuration file for the Phoenix OTEL Sphinx documentation builder.
"""

# -- Path setup --------------------------------------------------------------

import os
import sys

# Path setup for autodoc
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(BASE_DIR, "src", "phoenix"))

# -- Project information -----------------------------------------------------

project = "Phoenix OTEL API Reference"
copyright = "2025, Arize AI"
author = "Arize AI"

# The version info for the project you're documenting
try:
    from phoenix.otel import __version__ as version

    release = version
except ImportError:
    version = "latest"
    release = "latest"

# -- General configuration ---------------------------------------------------

source_suffix = [".rst", ".md", ".txt"]

extensions = [
    "sphinx.ext.autodoc",
    "sphinx.ext.autosummary",
    "sphinx.ext.napoleon",
    "myst_parser",
    "sphinx_design",
]

# Add any paths that contain templates here, relative to this directory.
templates_path = ["_templates"]

# List of patterns, relative to source directory, that match files
# and directories to ignore when looking for source files.
exclude_patterns = []

add_module_names = False

# -- Extension configuration -------------------------------------------------

# Napoleon
napoleon_google_docstring = True
napoleon_numpy_docstring = True

# Autosummary
autosummary_generate = True

# MyST
myst_enable_extensions = ["colon_fence", "linkify", "substitution"]
myst_heading_anchors = 2

# Autodoc
autoclass_content = "class"
autodoc_typehints = "none"
add_function_parentheses = False
add_module_names = False
autodoc_preserve_defaults = True

autodoc_default_options = {
    "members": True,
    "private-members": False,
    "special-members": "",
    "undoc-members": False,
    "inherited-members": False,
    "show-inheritance": False,
}

# -- Internationalization ----------------------------------------------------

language = "en"

# -- Versioning --------------------------------------------------------------

json_url = "https://arize-phoenix-otel.readthedocs.io/en/latest/_static/switcher.json"
version_match = os.environ.get("READTHEDOCS_VERSION")

if not version_match or version_match.isdigit() or version_match == "stable":
    version_match = f"v{release}"

# -- Options for HTML output -------------------------------------------------

html_theme = "pydata_sphinx_theme"
html_static_path = ["_static"]
html_css_files = ["custom.css"]
html_show_sphinx = False

# Configure navbar based on whether we're on Read the Docs or local
navbar_start = ["navbar-logo"]
theme_switcher = {}

# Only show version switcher on Read the Docs
if os.environ.get("READTHEDOCS"):
    navbar_start.append("version-switcher")
    theme_switcher = {
        "json_url": json_url,
        "version_match": version_match,
    }

html_theme_options = {
    "logo": {
        "text": "Phoenix OTEL API",
        "image_light": "logo.png",
        "image_dark": "logo.png",
    },
    "icon_links": [
        {
            "name": "GitHub",
            "url": "https://github.com/Arize-ai/phoenix",
            "icon": "fa-brands fa-github",
        },
        {
            "name": "PyPI",
            "url": "https://pypi.org/project/arize-phoenix-otel/",
            "icon": "fa-brands fa-python",
        },
    ],
    "external_links": [
        {"name": "Main Phoenix Docs", "url": "https://arize.com/docs/phoenix"},
        {"name": "Phoenix API Reference", "url": "https://arize-phoenix.readthedocs.io/"},
    ],
    "navbar_align": "content",
    "navbar_start": navbar_start,
    "secondary_sidebar_items": [],
    "footer_start": [],
    "footer_end": ["copyright"],
    "navigation_depth": 3,
    "collapse_navigation": True,
}

# Add switcher config only if on Read the Docs
if theme_switcher:
    html_theme_options["switcher"] = theme_switcher

html_sidebars = {
    "**": ["custom_sidebar.html"],
    "index": [],
}
