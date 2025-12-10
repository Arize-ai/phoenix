#!/bin/bash

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "This setup script will install the following tools (if not already installed):"
echo "  - uv (Python package manager)"
echo "  - node (version from .nvmrc) - requires nvm to be installed"
echo "  - tox and tox-uv (Python testing tools)"
echo "  - pnpm (Node package manager)"
echo ""
echo "Note: nvm (Node Version Manager) must be installed manually before running this script."
echo ""
read -p "Do you want to proceed? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi

INSTALLED_ITEMS=()

# Check and install uv
# First try to source uv env if it exists, then check if uv is available
if [ -f "$HOME/.local/bin/env" ]; then
    source "$HOME/.local/bin/env"
fi

# Check if uv is in PATH or exists in the expected location
if ! command -v uv &> /dev/null && [ ! -f "$HOME/.local/bin/uv" ]; then
    echo "Installing uv..."
    curl -LsSf https://astral.sh/uv/0.8.6/install.sh | sh
    INSTALLED_ITEMS+=("uv")
    
    # Source uv env to add it to PATH for current session
    if [ -f "$HOME/.local/bin/env" ]; then
        source "$HOME/.local/bin/env"
    fi
else
    echo "uv is already installed"
fi

# Check if nvm is available - nvm is a shell function, so we need to source it first
if [ -d "$HOME/.nvm" ]; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Check if nvm is available (as a function)
if ! type nvm &> /dev/null; then
    echo ""
    echo -e "${YELLOW}nvm (Node Version Manager) is not available.${NC}"
    echo ""
    echo "Please install nvm manually by running:"
    echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash"
    echo ""
    echo "Then restart your terminal or run:"
    echo "  export NVM_DIR=\"\$HOME/.nvm\""
    echo "  [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\""
    echo ""
    echo "After installing nvm, please run 'make setup' again to continue."
    exit 1
else
    echo "nvm is available"
fi

# Install and use node version from .nvmrc
if [ -f ".nvmrc" ]; then
    NODE_VERSION=$(cat .nvmrc | tr -d 'v')
    echo "Installing and using node version $NODE_VERSION from .nvmrc..."
    nvm install "$NODE_VERSION"
    nvm use "$NODE_VERSION"
    INSTALLED_ITEMS+=("node v$NODE_VERSION")
else
    echo "Warning: .nvmrc file not found"
fi

# Install tox and tox-uv
echo "Installing tox and tox-uv..."
uv tool install tox --with tox-uv
INSTALLED_ITEMS+=("tox and tox-uv")

# Install pnpm
echo "Installing pnpm..."
npm i -g pnpm@10.2.0
INSTALLED_ITEMS+=("pnpm@10.2.0")

# Copy .env.example to .env if .env doesn't exist
if [ -f "app/.env.example" ] && [ ! -f "app/.env" ]; then
    echo "Creating app/.env from app/.env.example..."
    cp app/.env.example app/.env
    INSTALLED_ITEMS+=("app/.env (from .env.example)")
elif [ -f "app/.env" ]; then
    echo "app/.env already exists, skipping copy"
fi

# Success message
echo ""
echo -e "${GREEN}✓ Setup completed successfully!${NC}"
echo ""
echo "The following tools were installed:"
for item in "${INSTALLED_ITEMS[@]}"; do
    echo -e "  ${GREEN}✓${NC} $item"
done
echo ""
echo -e "${YELLOW}Note:${NC} If this is a new shell session, you may need to:"
echo "  - Source uv: source \$HOME/.local/bin/env"
echo "  - Source nvm: source ~/.nvm/nvm.sh"
echo "  - Or restart your terminal to load these changes automatically"
