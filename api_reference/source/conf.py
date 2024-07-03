"""
Configuration file for the Sphinx documentation builder.

This file only contains a selection of the most common options. For a full
list see the documentation:
https://www.sphinx-doc.org/en/master/usage/configuration.html
"""

# -- Path setup --------------------------------------------------------------
import os
import sys

sys.path.insert(0, os.path.abspath("../../"))
sys.path.insert(0, os.path.abspath("../../src/phoenix"))
sys.path.insert(0, os.path.abspath("../packages/phoenix-evals/src/phoenix"))

# -- Generation setup --------------------------------------------------------

def include_only_tagged(app, what, name, obj, skip, options):
    inclusion_tag_format = ".. only:: {}"  # can be any pattern here, choose what works for you
    for tag in app.tags.tags:
        if obj.__doc__ is not None and inclusion_tag_format.format(tag) in obj.__doc__:
            return False
    return True


def skip_member(app, what, name, obj, skip, options):

    if name == "__init__":
        return True

    if name.startswith("_"):
        return True

    if what == "attribute":
        return True

    return False


def filter_rst(app, docname, source):
    if source:
        processed = []
        in_automodule = False

        # Iterate over each line in the source
        for line in source[0].split("\n"):
            # Check for the start of the automodule block
            if ".. automodule::" in line:
                in_automodule = True

            # If line is empty and we are in the automodule block, continue to consider it inside
            if in_automodule and line.strip() == "":
                processed.append(line)
                continue  # Skip the reset of in_automodule until out of relevant content

            # Set in_automodule to false once out of the block
            if in_automodule and line.strip() and not line.startswith("   "):
                in_automodule = False

            # Replace the unwanted text outside automodule blocks
            if not in_automodule:
                if "Submodules" in line:
                    continue
                if "Module contents" in line:
                    continue
                if " package" in line:
                    line = line.replace(" package", "")  # Remove ' package'
                if " module" in line:
                    line = line.replace(" module", "")  # Remove ' module'

            # Append potentially modified line to new output
            processed.append(line)

        # Join the modified lines back into a single string
        source[0] = "\n".join(processed)


def setup(app):
    # if len(app.tags.tags) > 0:
    #     app.connect("autodoc-skip-member", include_only_tagged)
    app.connect("autodoc-skip-member", skip_member)
    app.connect("source-read", filter_rst)


# -- Project information -----------------------------------------------------
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

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

# Napoleon settings
napoleon_google_docstring = True
napoleon_numpy_docstring = True

# Generate API documentation when building
autosummary_generate = True

autodoc_class_signature = 'separated'  # Separate the signature from the class title
autoclass_content = 'class'  # Only include the class docstring, not the __init__ method docstring


autodoc_default_options = {
    'members': True,
    'private-members': False,
    'special-members': '__init__',
    'undoc-members': False,
    'inherited-members': False,
    'show-inheritance': True,
}

# autodoc_pydantic_model_show_json = False
# autodoc_pydantic_field_list_validators = False
# autodoc_pydantic_config_members = False
# autodoc_pydantic_model_show_config_summary = False
# autodoc_pydantic_model_show_validator_members = False
# autodoc_pydantic_model_show_validator_summary = False
# autodoc_pydantic_model_signature_prefix = "class"
# autodoc_pydantic_field_signature_prefix = "param"
# autodoc_member_order = "groupwise"
# autoclass_content = "both"
# autodoc_typehints_format = "short"
# autodoc_typehints = "both"

# Add any paths that contain templates here, relative to this directory.
templates_path = ["_templates"]

# List of patterns, relative to source directory, that match files and directories
# to ignore when looking for source files.
# This pattern also affects html_static_path and html_extra_path.
exclude_patterns = []

add_module_names = False

# -- MyST options ------------------------------------------------------------

# This allows us to use ::: to denote directives, useful for admonitions
myst_enable_extensions = ["colon_fence", "linkify", "substitution"]
myst_heading_anchors = 2
myst_substitutions = {"rtd": "[Read the Docs](https://readthedocs.org/)"}

# -- Internationalization ----------------------------------------------------

# specifying the natural language populates some key tags
language = "en"

# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = "pydata_sphinx_theme"
pygments_style = "sphinx"  # The name of the Pygments (syntax highlighting) style to use.
html_static_path = ["_static"]
html_css_files = ["custom.css"]

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
    "navbar_start": ["navbar-logo"],
    "header_links_before_dropdown": 5,
}

html_sidebars = {"**": ["sidebar-nav-bs"]}
