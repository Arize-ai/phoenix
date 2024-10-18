# Makefile for common development tasks

# Check if uv is installed
check-uv:
	@if ! command -v uv &> /dev/null; then \
		echo "Warning: 'uv' is not installed. Please install it from https://github.com/astral-sh/uv?tab=readme-ov-file#installation"; \
		exit 1; \
	fi

# Check if nvm is installed
# Look in NVM_DIR for nvm.sh
check-nvm:
	@if [ ! -f "${NVM_DIR}/nvm.sh" ]; then \
		echo "Warning: 'nvm' is not installed. Please install it from https://github.com/nvm-sh/nvm#installing-and-updating"; \
		exit 1; \
	fi

nvm:
	. ${NVM_DIR}/nvm.sh && nvm use && $(NVMCMD)

venv:
	. .venv/bin/activate && $(VENVCMD)

with-sources:
	. .venv/bin/activate && . ${NVM_DIR}/nvm.sh && $(CMD)

# Install dependencies
deps: check-uv check-nvm
	uv python install 3.12
	. ${NVM_DIR}/nvm.sh && nvm install
	make nvm NVMCMD="npm install -g pnpm"
	uv tool install pre-commit
	uv sync --all-extras

# Run backend development server
dev-backend:
	make venv VENVCMD="tox r -e phoenix_main -- --dev serve"

# Run frontend development server
dev-frontend:
	make nvm NVMCMD="cd app && pnpm install && pnpm run dev:ui"

# Run both backend and frontend development servers
dev:
	make with-sources CMD="cd app && pnpm install && pnpm run dev"

clean:
	rm -rf ./app/node_modules
	rm -rf .venv
	rm -rf .tox
