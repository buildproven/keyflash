#!/bin/bash
set -e

# Image Optimization Script
# Optimizes images for web delivery using native macOS tools

echo "🖼️  Optimizing images for web delivery..."

# Function to optimize PNG files
optimize_png() {
  local file="$1"
  local original_size=$(stat -f%z "$file")

  echo "  📦 Optimizing $(basename "$file")..."
  echo "     Original size: $(numfmt --to=iec-i --suffix=B $original_size 2>/dev/null || echo "${original_size}B")"

  # Use sips (built-in macOS tool) to optimize PNG
  # --setProperty format png: Ensure PNG format
  # --setProperty formatOptions 90: Set compression quality
  sips -s format png -s formatOptions 90 "$file" --out "${file}.tmp" >/dev/null 2>&1

  # Replace original if optimization was successful and smaller
  if [ -f "${file}.tmp" ]; then
    local new_size=$(stat -f%z "${file}.tmp")
    if [ $new_size -lt $original_size ]; then
      mv "${file}.tmp" "$file"
      local saved=$((original_size - new_size))
      local percent=$((saved * 100 / original_size))
      echo "     ✓ Optimized: $(numfmt --to=iec-i --suffix=B $new_size 2>/dev/null || echo "${new_size}B") (saved ${percent}%)"
    else
      rm "${file}.tmp"
      echo "     ℹ️  Already optimized"
    fi
  fi
}

# Find all PNG files in src directory
find src -name "*.png" -type f | while read -r file; do
  optimize_png "$file"
done

echo ""
echo "✅ Image optimization complete!"
echo ""
echo "Note: For better optimization, install optipng or pngquant:"
echo "  brew install optipng pngquant"
echo ""
echo "Advanced optimization:"
echo "  optipng -o7 -strip all src/app/apple-icon.png"
echo "  pngquant --quality=65-80 --ext .png --force src/app/apple-icon.png"
