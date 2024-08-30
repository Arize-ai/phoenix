# List of notebook files and their destination paths
NOTEBOOKS := \
	tutorials/quickstarts/evals_quickstart.ipynb:docs/quickstart/evals.md \
	tutorials/quickstarts/tracing_quickstart_openai.ipynb:docs/tracing/llm-traces-1.md \

# Default target
all: convert_notebooks

# Convert notebooks to markdown and move to destination
convert_notebooks:
	@for pair in $(NOTEBOOKS); do \
		file=$${pair%%:*}; \
		dest=$${pair#*:}; \
		echo "Converting $$file to Markdown..."; \
		jupyter nbconvert --to markdown "$$file"; \
		mdfile=$${file%.ipynb}.md; \
		echo "Moving $$mdfile to $$dest"; \
		mv "$$mdfile" "$$dest"; \
	done

# Clean up generated files
clean:
	@for pair in $(NOTEBOOKS); do \
		dest=$${pair#*:}; \
		echo "Removing $$dest"; \
		rm -f "$$dest"; \
	done

.PHONY: all convert_notebooks clean
