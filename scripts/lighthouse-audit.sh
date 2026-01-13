#!/bin/bash
# Run Lighthouse audit on deployed site

set -e

SITE_URL="${1:-http://localhost:3000}"

echo "🔍 Running Lighthouse audit on: $SITE_URL"
echo ""

# Install lighthouse if not present
if ! command -v lighthouse &> /dev/null; then
    echo "📦 Installing Lighthouse CLI..."
    npm install -g lighthouse
fi

# Run Lighthouse audit
echo "⚡ Running Lighthouse..."
lighthouse "$SITE_URL" \
    --output=html \
    --output=json \
    --output-path=./lighthouse-report \
    --preset=desktop \
    --quiet \
    --chrome-flags="--headless --no-sandbox"

echo ""
echo "✅ Lighthouse audit complete!"
echo "📊 Report saved to: lighthouse-report.html"
echo ""

# Extract scores from JSON
if command -v jq &> /dev/null; then
    echo "📈 Lighthouse Scores:"
    jq -r '.categories | to_entries[] | "\(.key): \(.value.score * 100)"' lighthouse-report.json
else
    echo "💡 Install jq to see scores in terminal: brew install jq"
fi

echo ""
echo "🌐 Open report: open lighthouse-report.html"
