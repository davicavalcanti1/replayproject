#!/bin/bash
# Deploy the React UI into the Flask backend's react_dist folder
# Run this from the replay-ui/ directory

set -e

echo "Building React app..."
npm run build

echo "Copying dist to Flask backend..."
DEST="../replay_mvp/react_dist"
rm -rf "$DEST"
cp -r dist/ "$DEST"

echo "Done. Access the UI at http://localhost:5000/ui"
