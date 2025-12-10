#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${BOLD}========================================${NC}"
    echo -e "${BOLD}  Phoenix Development Environment Setup${NC}"
    echo -e "${BOLD}========================================${NC}"
    echo ""
}

print_step() {
    echo -e "${BOLD}▶ $1${NC}"
}

print_success() {
    echo -e "  ${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "  ${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "  ${RED}✗${NC} $1"
}

# Try to make uv available in current session
load_uv() {
    if [ -f "$HOME/.local/bin/env" ]; then
        . "$HOME/.local/bin/env"
    fi
    # Also try cargo bin path (older uv installations)
    if [ -d "$HOME/.cargo/bin" ]; then
        export PATH="$HOME/.cargo/bin:$PATH"
    fi
}

# Try to make nvm available in current session
load_nvm() {
    export NVM_DIR="$HOME/.nvm"
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        . "$NVM_DIR/nvm.sh"
    fi
}

# Check if uv is available
check_uv() {
    load_uv
    command -v uv &> /dev/null
}

# Check if nvm is available (it's a shell function, not a command)
check_nvm() {
    load_nvm
    type nvm &> /dev/null 2>&1
}

# Check if node is available
check_node() {
    command -v node &> /dev/null
}

# Check if pnpm is available
check_pnpm() {
    command -v pnpm &> /dev/null
}

print_header

echo "This script will set up your development environment for Phoenix."
echo ""
echo "The following tools are required:"
echo "  • uv - Python package manager"
echo "  • nvm - Node Version Manager"
echo "  • node - JavaScript runtime (via nvm)"
echo "  • pnpm - Node package manager"
echo "  • tox - Python testing tool"
echo ""
read -p "Do you want to proceed? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi

echo ""

# ============================================================================
# Step 1: uv
# ============================================================================
print_step "Checking uv..."

if check_uv; then
    print_success "uv is already installed ($(uv --version 2>/dev/null || echo 'version unknown'))"
else
    echo "  Installing uv..."
    if curl -LsSf https://astral.sh/uv/0.8.6/install.sh | sh; then
        load_uv
        if check_uv; then
            print_success "uv installed successfully"
        else
            print_error "uv was installed but is not available in PATH"
            print_warning "Try: source \$HOME/.local/bin/env"
            exit 1
        fi
    else
        print_error "Failed to install uv"
        exit 1
    fi
fi

# ============================================================================
# Step 2: nvm
# ============================================================================
print_step "Checking nvm..."

if check_nvm; then
    print_success "nvm is already installed"
else
    echo ""
    print_warning "nvm is not installed or not loaded in your shell."
    echo ""
    echo "  Please install nvm by running:"
    echo ""
    echo -e "    ${BOLD}curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash${NC}"
    echo ""
    echo "  After installation, either:"
    echo "    1. Restart your terminal, OR"
    echo "    2. Run: source ~/.nvm/nvm.sh"
    echo ""
    echo "  Then run 'make setup' again."
    echo ""
    exit 1
fi

# ============================================================================
# Step 3: node (via nvm)
# ============================================================================
print_step "Checking node..."

if [ ! -f ".nvmrc" ]; then
    print_error ".nvmrc file not found"
    exit 1
fi

NODE_VERSION=$(cat .nvmrc | tr -d 'v' | tr -d '[:space:]')
CURRENT_NODE=$(node --version 2>/dev/null | tr -d 'v' || echo "")

if [ "$CURRENT_NODE" = "$NODE_VERSION" ]; then
    print_success "node v$NODE_VERSION is already installed and active"
else
    echo "  Installing node v$NODE_VERSION via nvm..."
    if nvm install "$NODE_VERSION" && nvm use "$NODE_VERSION"; then
        print_success "node v$NODE_VERSION installed and activated"
    else
        print_error "Failed to install node v$NODE_VERSION"
        exit 1
    fi
fi

# ============================================================================
# Step 4: tox and tox-uv
# ============================================================================
print_step "Installing tox and tox-uv..."

if uv tool install tox --with tox-uv 2>/dev/null || uv tool upgrade tox --with tox-uv 2>/dev/null; then
    print_success "tox and tox-uv installed"
else
    # Try again, it might already be installed
    if uv tool list 2>/dev/null | grep -q tox; then
        print_success "tox and tox-uv already installed"
    else
        print_error "Failed to install tox and tox-uv"
        exit 1
    fi
fi

# ============================================================================
# Step 5: pnpm
# ============================================================================
print_step "Checking pnpm..."

PNPM_VERSION="10.2.0"

if check_pnpm; then
    CURRENT_PNPM=$(pnpm --version 2>/dev/null || echo "")
    if [ "$CURRENT_PNPM" = "$PNPM_VERSION" ]; then
        print_success "pnpm@$PNPM_VERSION is already installed"
    else
        echo "  Updating pnpm to $PNPM_VERSION..."
        if npm i -g pnpm@$PNPM_VERSION; then
            print_success "pnpm@$PNPM_VERSION installed"
        else
            print_error "Failed to install pnpm"
            exit 1
        fi
    fi
else
    echo "  Installing pnpm@$PNPM_VERSION..."
    if npm i -g pnpm@$PNPM_VERSION; then
        print_success "pnpm@$PNPM_VERSION installed"
    else
        print_error "Failed to install pnpm"
        exit 1
    fi
fi

# ============================================================================
# Step 6: Copy .env file
# ============================================================================
print_step "Checking app/.env..."

if [ -f "app/.env" ]; then
    print_success "app/.env already exists"
elif [ -f "app/.env.example" ]; then
    cp app/.env.example app/.env
    print_success "Created app/.env from app/.env.example"
else
    print_warning "app/.env.example not found, skipping"
fi

# ============================================================================
# Done!
# ============================================================================
echo ""
echo -e "${GREEN}${BOLD}========================================${NC}"
echo -e "${GREEN}${BOLD}  Setup completed successfully! 🎉${NC}"
echo -e "${GREEN}${BOLD}========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Run 'make dev' to start the development server"
echo ""
echo -e "${YELLOW}Note:${NC} If you open a new terminal, you may need to run:"
echo "  source \$HOME/.local/bin/env   # for uv"
echo "  source \$HOME/.nvm/nvm.sh      # for nvm"
echo ""
