#!/bin/bash
# Bundle analysis script for performance optimization

set -e

echo "📊 Analyzing bundle size..."

# Build with bundle analyzer
ANALYZE=true npm run build

# Check for large chunks
echo ""
echo "🔍 Large chunks (>100KB):"
find .next/static/chunks -name "*.js" -size +100k -exec ls -lh {} \; | awk '{print $5, $9}'

# Total bundle size
echo ""
echo "📦 Total bundle size:"
du -sh .next/static

# Recommendations
echo ""
echo "💡 Optimization recommendations:"
echo "  - Chunks >200KB: Consider code splitting"
echo "  - Chunks 100-200KB: Review for tree-shaking opportunities"
echo "  - Total >5MB: Investigate dependencies"
