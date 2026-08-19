#!/bin/bash
# Start ITPAS backend server (requires Node.js 18+)
cd "$(dirname "$0")"
if ! command -v node &>/dev/null; then
  echo "Node.js is required. Install from https://nodejs.org/"
  exit 1
fi
echo "Starting ITPAS server..."
node server.js
