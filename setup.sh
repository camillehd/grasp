#!/usr/bin/env bash
set -e

echo "==> Setting up Grasp"

# ── .env ─────────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "  ✎  Created .env — add your Anthropic API key:"
  echo "     ANTHROPIC_API_KEY=sk-ant-..."
  echo ""
fi

# ── Backend ───────────────────────────────────────────────────────────────────
echo "==> Installing Python dependencies"
cd backend

# pydantic-core requires Python ≤ 3.13; prefer 3.12 explicitly
PYTHON=""
for candidate in python3.12 python3.13 python3.11; do
  if command -v "$candidate" &>/dev/null; then
    PYTHON="$candidate"
    break
  fi
done
if [ -z "$PYTHON" ]; then
  echo "ERROR: Python 3.12 or 3.13 is required. Install with: brew install python@3.12"
  exit 1
fi
echo "  Using $($PYTHON --version)"

rm -rf .venv
"$PYTHON" -m venv .venv
source .venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
cd ..

# ── Frontend ──────────────────────────────────────────────────────────────────
echo "==> Installing frontend dependencies"
cd frontend
npm install --silent
cd ..

echo ""
echo "✓ Setup complete. To run Grasp:"
echo ""
echo "  Terminal 1 (backend):"
echo "    cd backend && source .venv/bin/activate && uvicorn main:app --reload"
echo ""
echo "  Terminal 2 (frontend):"
echo "    cd frontend && npm run dev"
echo ""
echo "  Then open http://localhost:5173"
