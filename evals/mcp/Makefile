# Included by the repository Makefile. All paths are relative to its root.
MCP_DIR := evals/mcp
MCP_PYTHON := $(MCP_DIR)/.venv/bin/python

.PHONY: mcp-setup mcp-test mcp-lint mcp-preflight mcp-smoke mcp-plugin-test
mcp-setup:
	uv sync --project $(MCP_DIR) --python 3.13 --locked
	$(MCP_PYTHON) $(MCP_DIR)/runtime.py

mcp-test:
	PYTHONPATH=$(MCP_DIR):. $(MCP_PYTHON) -m pytest -q $(MCP_DIR)/tests

mcp-lint:
	$(MCP_DIR)/.venv/bin/ruff check $(MCP_DIR)
	$(MCP_DIR)/.venv/bin/ruff format --check $(MCP_DIR)

mcp-preflight:
	$(MCP_PYTHON) $(MCP_DIR)/preflight.py $(ARGS)

mcp-smoke:
	$(MCP_PYTHON) $(MCP_DIR)/preflight.py --live

mcp-plugin-test:
	$(MCP_PYTHON) -m pytest -q -o addopts='' packages/phoenix-client/tests/client/harbor packages/phoenix-client/tests/client/helpers/atif

.PHONY: mcp-format
mcp-format:
	$(MCP_DIR)/.venv/bin/ruff format $(MCP_DIR)
	$(MCP_DIR)/.venv/bin/ruff check --fix $(MCP_DIR)
