# Included by the root Makefile. Harbor requires a separate Python interpreter.
MCP_DIR := evals/mcp
MCP_PYTHON := $(MCP_DIR)/.venv/bin/python

.PHONY: mcp mcp-setup
mcp-setup:
	uv sync --project $(MCP_DIR) --python 3.13 --locked
	$(MCP_PYTHON) $(MCP_DIR)/runtime.py

mcp:
	PYTHONPATH=$(MCP_DIR):. $(MCP_PYTHON) $(MCP_DIR)/main.py $(ARGS)
