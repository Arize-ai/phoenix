# Phoenix OTEL Documentation

This directory contains the Sphinx documentation for the `arize-phoenix-otel` package.

## Setup

To build the documentation locally:

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   pip install -e ..  # Install phoenix-otel package in development mode
   ```

2. Build the documentation:
   ```bash
   make html
   ```

3. View the documentation:
   ```bash
   open build/html/index.html
   ```

## Structure

- `source/conf.py` - Sphinx configuration
- `source/index.md` - Main documentation page
- `source/api/` - API reference files
- `source/_static/` - Static assets (CSS, images, etc.)
- `requirements.txt` - Python dependencies for building docs

## Read the Docs

This documentation is automatically built and deployed to Read the Docs when:
- Changes are pushed to the main branch
- New tags are created

The Read the Docs configuration is in `.readthedocs.yaml` in the package root.

## Updating Documentation

To update the API documentation:

1. If adding new modules, run `sphinx-apidoc` to generate new `.rst` files
2. Update `source/api/otel.rst` to include new classes/functions
3. Update `source/index.md` if needed
4. Test locally with `make html`
5. Commit and push changes 