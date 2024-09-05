# Define the root directory (adjust this path as needed)
ROOT_DIR := $(shell git rev-parse --show-toplevel)

# List of notebook files and their destination paths
NOTEBOOKS := \
	tutorials/quickstarts/evals_quickstart.ipynb:docs/quickstart/evals.md \
	tutorials/quickstarts/tracing_quickstart_openai.ipynb:docs/tracing/llm-traces-1.md \
	tutorials/quickstarts/evaluating_traces_quickstart.ipynb:docs/evaluation/how-to-evals/evaluating-phoenix-traces.md

# Default target
all: convert_notebooks

# Convert notebooks to markdown and move to destination
convert_notebooks:
	@for pair in $(NOTEBOOKS); do \
		file=$${pair%%:*}; \
		dest=$${pair#*:}; \
		echo "Converting $$file to Markdown..."; \
		jupyter nbconvert --to markdown "$(ROOT_DIR)/$$file"; \
		mdfile=$${file%.ipynb}.md; \
		echo "Moving $$mdfile to $$dest"; \
		mv "$(ROOT_DIR)/$$mdfile" "$(ROOT_DIR)/$$dest"; \
	done

# Clean up generated files
clean:
	@for pair in $(NOTEBOOKS); do \
		dest=$${pair#*:}; \
		echo "Removing $$dest"; \
		rm -f "$(ROOT_DIR)/$$dest"; \
	done

.PHONY: all convert_notebooks clean
