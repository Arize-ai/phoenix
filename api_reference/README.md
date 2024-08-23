# Maintenance README for Phoenix Sphinx API Documentation

This API reference provides comprehensive details for Phoenix's API. The documentation covers only public, user-facing API endpoints offered in Phoenix. The main GitBook-based documentation for Phoenix is located in phoenix/docs.

Maintaining the API reference consists of two parts:

1. Building the documentation with Sphinx
2. Hosting and CI with readthedocs

## Configuration

```
api_reference
 ┣ source
 ┃ ┃ ┣ custom.css
 ┃ ┃ ┣ logo.png
 ┃ ┃ ┗ switcher.json
 ┃ ┣ api
 ┃ ┃ ┣ client.rst
 ┃ ┃ ┣ evals.rst
 ┃ ┃ ┣ experiments.rst
 ┃ ┃ ┣ inferences_schema.rst
 ┃ ┃ ┗ session.rst
 ┃ ┃ ┗ ...
 ┃ ┣ conf.py
 ┃ ┗ index.md
 ┣ Makefile
 ┣ README.md
 ┣ make.bat
 ┗ requirements.txt
```

- conf.py: All sphinx-related configuration is done here and is necessary to run Sphinx.
- index.md: Main entrypoint for the API reference. This file must be in the `source` directory.
- requirements.txt: This file is necessary for readthedocs to manage dependecies.
- make files: Not required but useful in generating static HTML pages locally.

To run and build locally, download all dependencies found in `requirements.txt` (especially packages/phoenix-evals as a dev dependency `-e`).

## Building the Documentation

### Api-doc

If the API reStructuredText (rst) or Markdown (md) files are already present in the `api` directory, skip this step and modify those files directly.

If you are starting from scratch or want to re-generate those pages, you must first generate the documentation using Markdown or reStructuredText files that contain Sphinx autodoc directives. This is done automatically using sphinx-apidoc (which outputs rst files). However, content that was manual edits such as examples, page organization, module autodoc settings, etc. will be lost. The typical command used for this API reference is:

```
sphinx-apidoc -o ./source/output ../path/to/module --separate -M
```

where `path/to/module` refers to the module.

This automatically generates reStructuredText with autodoc-related directives for all modules of the specified package. These files direct Sphinx when building on how to generate our documentation from the docstrings in our codebase.

### Autodoc

The files generated using apidoc can be edited to specify certain documentation generation behavior using directive options. Autodoc directives instruct the autodoc extension to extract docstrings from files and automatically generate API documentation. Autodoc directives (for rst) typically look something like:

```
.. automodule:: module_name
   :members:
```

where `.. automodule:: module_name` is an autodoc directive and `:members` is a directive option.

Documentation (and a list of all directive options) for Sphinx can be found here:

- https://www.sphinx-doc.org/en/master/man/sphinx-apidoc.html
- https://www.sphinx-doc.org/en/master/usage/extensions/autodoc.html

### HTML Static Sites

Once the rst files are created using autdoc, for the documentation to be rendered, index.md should have some way to reach them in its toctree. After the correct path setup, make the static HTML sites using:

```
make clean
make html
```

or

```
make clean html
```

and the HTML sites should be built in the `build` directory.

Note: All custom static files should be placed in `_static`.

## PyData Theme

The PyData theme that we use for our API reference has its own theme-related configurations that change the behavior of Sphinx. These configuration options can be found here: https://pydata-sphinx-theme.readthedocs.io/en/stable/

## Readthedocs

Configurations for readthedocs is found in the root directory as `.readthedocs.yaml`. It must have the correct path to both Sphinx's `conf.py` file and to the `requirements.txt` in the API reference's directory. Once there are valid rst or md files for Phoenix's modules, a valid `.readthedocs.yaml`, and valid `conf.py`, readthedocs will automatically build our documentation. When a new commit is pushed to the Phoenix repository, readthedocs receives a webhook and a new build of the references is rendered to match the new commit. Whenever a new tag is updated on the repo, that tag will also be automatically built and updated to be public as per settings set on `Automation Rules` on readthedocs.

Version control for the reference's version dropdown must be manually be updated in `switcher.json`.
