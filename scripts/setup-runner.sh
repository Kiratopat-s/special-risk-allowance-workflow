#!/usr/bin/env bash
set -euo pipefail

# GitHub Actions Self-Hosted Runner Setup for SRAW
# Run this once on the Ubuntu server that hosts the application.

RUNNER_VERSION="2.321.0"
RUNNER_ARCH="linux-x64"
RUNNER_DIR="$HOME/actions-runner"

echo "=== SRAW Self-Hosted Runner Setup ==="
echo ""

# --- Prerequisites ---

echo "Checking prerequisites..."

for cmd in docker curl git; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: $cmd is not installed. Please install it first."
    exit 1
  fi
done

if ! docker compose version &>/dev/null; then
  echo "Error: Docker Compose (v2 plugin) is not installed."
  exit 1
fi

echo "All prerequisites met."
echo ""

# --- Install Bun ---

if ! command -v bun &>/dev/null; then
  echo "Installing Bun 1.3.14..."
  curl -fsSL https://bun.sh/install | bash -s -- bun-v1.3.14
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  echo "Bun installed: $(bun --version)"
else
  echo "Bun already installed: $(bun --version)"
fi
echo ""

# --- Download Runner ---

mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

if [ ! -f "./run.sh" ]; then
  echo "Downloading GitHub Actions runner v${RUNNER_VERSION}..."
  curl -fsSL -o actions-runner.tar.gz \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
  tar xzf actions-runner.tar.gz
  rm actions-runner.tar.gz
  echo "Runner downloaded and extracted."
else
  echo "Runner already downloaded."
fi
echo ""

# --- Configure Runner ---

if [ ! -f ".runner" ]; then
  echo "To configure the runner, you need a registration token from:"
  echo "  GitHub repo > Settings > Actions > Runners > New self-hosted runner"
  echo ""
  read -rp "Enter your GitHub repository URL (e.g., https://github.com/owner/repo): " REPO_URL
  read -rp "Enter your registration token: " RUNNER_TOKEN
  echo ""

  ./config.sh \
    --url "$REPO_URL" \
    --token "$RUNNER_TOKEN" \
    --labels "self-hosted,linux,x64,sraw" \
    --name "sraw-runner-$(hostname)" \
    --unattended

  echo "Runner configured."
else
  echo "Runner already configured."
fi
echo ""

# --- Install as systemd Service ---

echo "Installing runner as systemd service..."
sudo ./svc.sh install
sudo ./svc.sh start

echo ""
echo "=== Setup Complete ==="
echo "Runner is installed and running as a systemd service."
echo "Verify it appears as 'Online' in your GitHub repo under Settings > Actions > Runners."
echo ""
echo "Service management:"
echo "  sudo ./svc.sh status    # Check status"
echo "  sudo ./svc.sh stop      # Stop runner"
echo "  sudo ./svc.sh start     # Start runner"
echo "  sudo ./svc.sh uninstall # Remove service"
