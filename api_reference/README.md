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
- index.md: Main entrypoint for the API reference. This file must be in the `source` directory. For documentation to show up on the API reference, there must be a path (does not have to be direct) defined in index.md to the target documentation file.
- requirements.txt: This file is necessary for management of dependencies on the readthedocs platform and its build process.
- make files: Not required but useful in generating static HTML pages locally.

`requirements.txt` contains all Sphinx-related dependencies. Although this file is mainly for the readthedocs build process, to run and build locally, you must download all dependencies found in `requirements.txt` (local Phoenix packages such as packages/phoenix-evals should be installed as a dev dependency using `-e`). Paths for local dependencies in this file must be defined from the reference of the location of `.readthedocs.yaml` (most likely the root).

## Building the Documentation

### Sphinx-apidoc

If the API reStructuredText (rst) or Markdown (md) files already exist in the `api` directory, you can skip the generation step with apidoc and directly modify those files.

However, if you are starting from scratch or need to reset/regenerate the API documentation, you must first generate the files formatted as either Markdown or reStructuredText that includes Sphinx autodoc directives. This is automatically handled by the sphinx-apidoc command, which generates rst files. These generated files are placed in source/output. Keep in mind that any manually added content, such as examples, page structure, or module autodoc settings, will be overwritten if these files are replaced in the source/api directory.

The typical command used to generate the API reference files:

```
sphinx-apidoc -o ./source/output ../path/to/module --separate -M
```

where `path/to/module` refers to the target module. The command above is written to be executed in the `/api_reference` directory, though the paths can be adjusted to run from anywhere.

- Command options: https://www.sphinx-doc.org/en/master/usage/extensions/autodoc.html

This process generates reStructuredText files with autodoc directives for all modules in the specified package. The generated files instruct Sphinx on how to build the documentation based on the docstrings in the codebase. After running the command, the generated documentation will be found in `api_reference/source/output`. Move the relevant files from `source/output` to `source/api`. The current directory structure (`source/api) is not a strict requirement but is currently set up to ensure that the outputs from the sphinx-apidoc command do not accidentally overwrite documentation files that we want to preserve. This separation helps safeguard manually edited content, such as examples or specific page structures, from being overwritten during the automatic generation of API reference files.

### Autodoc

The files generated using apidoc can be edited to specify certain documentation generation behavior using directive options. Autodoc directives instruct the autodoc extension to extract docstrings from files and automatically generate API documentation. Autodoc directives (for rst) typically look something like:

```
.. automodule:: module_name
   :members:
   :no-undoc-members:
   :exclude-members:
   ...

.. autoclass:: module_name::class_name
   :members:
   ...

.. automethod:: module_name.class_name::function_name
```

where `.. automodule:: module_name` is an autodoc directive and `:members` is a directive option.

Documentation (and a list of all directive options) for Sphinx's autodoc can be found here:

- https://www.sphinx-doc.org/en/master/usage/extensions/autodoc.html

### Index.md

Once the newly generated files are in `source/api`, for the new documentation to show up, add a path under `{toctree}` in `index.md` to the module. This would look something like (Sphinx assumes the file extension):

```
api/module
```

This path does not have to be direct - take for instance `evals.rst`. Index refers to `evals.rst`, which in turn references several evals submodules.

### conf.py

All configurations for Sphinx are placed in this file. This file deals with configs such as page theme, navbar and sidebar settings, extensions and extension settings, custom CSS file settings, etc.

Custom CSS and JavaScript files should be placed in `_static`.

### HTML Static Sites

Once the rst files are created using autodoc and index.md has a way to reach the files in its toctree, the documentation can be rendered into static HTML pages. Make the static HTML sites using:

```
make clean
make html
```

or

```
make clean html
```

and the HTML sites should be built in the `api_reference/build` directory.

NOTE: All custom static files should be placed in `source/_static`.

## PyData Theme

The PyData theme that we use for our API reference has its own theme-related configurations that change the behavior of Sphinx. These configuration options can be found here: https://pydata-sphinx-theme.readthedocs.io/en/stable/

## Read the docs

Sphinx serves solely as a documentation generator and does not offer hosting capabilities for our documentation. To host the documentation and enable automatic updates linked to changes on the GitHub repo, we need to use Read the Docs. As Phoenix is an open-source project, Read the Docs is free under the community version.

### .readthedocs.yaml

Configurations for readthedocs can be found in the root directory in the file `/.readthedocs.yaml`. It must have the correct path to both Sphinx's `conf.py` file and to the `requirements.txt` in the API reference's directory. Once there are valid rst or md files for Phoenix's modules, a valid `.readthedocs.yaml`, and valid `conf.py`, readthedocs will automatically build our documentation. When a new commit is pushed to the Phoenix repository, readthedocs receives a webhook and a new build of the references is rendered to match the new commit. Whenever a new tag is updated on the repo, that tag will also be automatically built and updated to be public as per settings set on `Automation Rules` on readthedocs.

### api_reference/requirements.txt

This file is used by readthedocs to download the correct dependencies to build and render the API docs. The dependencies also include local Phoenix packages. This file is read at the root level and any references to local dependencies should reflect this.

### Versioning

The Read the Docs version build automation is configured under the `Automation Rules` in the admin settings of the Read the Docs platform. The `Automatic Version Build and Activation (Tag)` rule governs the process of automatically building and categorizing new Phoenix versions upon release. This rule does not cover the continuous integration (CI) process triggered by updates to the main branch. Instead, it ensures that users can access previous versions of Phoenix. The current state of the main branch in the Phoenix GitHub repository is always labeled as `latest`, regardless of its actual version. To update the version control in the reference's version dropdown within the navigation bar, the switcher.json file must be manually edited.

For reference:

- https://docs.readthedocs.io/en/stable/automation-rules.html
