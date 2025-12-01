#!/bin/bash
# Smart Test Strategy - keyflash
# Generated pattern from create-qa-architect
# https://www.aibuilderlab.com/cqa
set -e

echo "🧠 Analyzing changes for optimal test strategy..."

# Environment variable overrides
if [[ "$SKIP_SMART" == "1" ]]; then
  echo "⚠️  SKIP_SMART=1 - Running comprehensive tests"
  npm run test:all 2>/dev/null || npm run test
  exit 0
fi

if [[ "$FORCE_COMPREHENSIVE" == "1" ]]; then
  echo "🔴 FORCE_COMPREHENSIVE=1 - Running all tests"
  npm run test:all 2>/dev/null || npm run test
  exit 0
fi

if [[ "$FORCE_MINIMAL" == "1" ]]; then
  echo "⚪ FORCE_MINIMAL=1 - Running lint only"
  npm run lint && npm run format:check
  exit 0
fi

# Collect metrics
CHANGED_FILES=$(git diff --name-only HEAD~1..HEAD 2>/dev/null | wc -l | tr -d ' ')
CHANGED_LINES=$(git diff --stat HEAD~1..HEAD 2>/dev/null | tail -1 | grep -o '[0-9]* insertions' | grep -o '[0-9]*' || echo "0")
CURRENT_BRANCH=$(git branch --show-current)
HOUR=$(date +%H)
DAY_OF_WEEK=$(date +%u)

# Project-specific high-risk patterns (SEO keyword research tool)
HIGH_RISK_FILES=$(git diff --name-only HEAD~1..HEAD 2>/dev/null | grep -E "(api/|lib/|src/services/|config/)" || true)
API_FILES=$(git diff --name-only HEAD~1..HEAD 2>/dev/null | grep -E "api/" || true)
CONFIG_FILES=$(git diff --name-only HEAD~1..HEAD 2>/dev/null | grep -E "(package\.json|\.env|config)" || true)
TEST_FILES=$(git diff --name-only HEAD~1..HEAD 2>/dev/null | grep -E "test|spec" || true)

# Calculate risk score (0-10)
RISK_SCORE=0

# File-based risk
[[ -n "$HIGH_RISK_FILES" ]] && RISK_SCORE=$((RISK_SCORE + 4))
[[ -n "$API_FILES" ]] && RISK_SCORE=$((RISK_SCORE + 2))
[[ -n "$CONFIG_FILES" ]] && RISK_SCORE=$((RISK_SCORE + 2))

# Size-based risk
[[ $CHANGED_FILES -gt 10 ]] && RISK_SCORE=$((RISK_SCORE + 2))
[[ $CHANGED_FILES -gt 20 ]] && RISK_SCORE=$((RISK_SCORE + 3))
[[ $CHANGED_LINES -gt 200 ]] && RISK_SCORE=$((RISK_SCORE + 2))

# Branch-based risk
case $CURRENT_BRANCH in
  main|master|production) RISK_SCORE=$((RISK_SCORE + 3)) ;;
  hotfix/*) RISK_SCORE=$((RISK_SCORE + 4)) ;;
  release/*) RISK_SCORE=$((RISK_SCORE + 2)) ;;
  develop) RISK_SCORE=$((RISK_SCORE + 1)) ;;
esac

# Time pressure adjustment (strip leading zeros)
HOUR_NUM=$((10#$HOUR))
if [[ $HOUR_NUM -ge 9 && $HOUR_NUM -le 17 && $DAY_OF_WEEK -le 5 ]]; then
  SPEED_BONUS=true
else
  SPEED_BONUS=false
fi

# Display analysis
echo "📊 Analysis Results:"
echo "   📁 Files: $CHANGED_FILES"
echo "   📏 Lines: $CHANGED_LINES"
echo "   🌿 Branch: $CURRENT_BRANCH"
echo "   🎯 Risk Score: $RISK_SCORE/10"
echo "   ⚡ Speed Bonus: $SPEED_BONUS"
echo ""

# Decision logic
# NOTE: test:commands and test:e2e are ALWAYS excluded from pre-push (run in CI only)
# - test:commands: Takes 60-70s even optimized, verifies npm scripts work
# - test:e2e: Requires browser, CI has better infrastructure
# These run in GitHub Actions on every PR and push to main

if [[ $RISK_SCORE -ge 7 ]]; then
  echo "🔴 HIGH RISK - Comprehensive validation (pre-push)"
  echo "   • Unit + integration + config + quality + smoke + security audit"
  echo "   • (command + e2e tests run in CI only)"
  npm run lint && npm run format:check && npm run test:unit && npm run test:integration && npm run test:config && npm run test:quality && npm run test:smoke && npm run security:audit
elif [[ $RISK_SCORE -ge 4 ]]; then
  echo "🟡 MEDIUM RISK - Standard validation"
  echo "   • Fast tests + integration + smoke"
  npm run lint && npm run format:check && npm run test:unit && npm run test:integration && npm run test:smoke
elif [[ $RISK_SCORE -ge 2 || "$SPEED_BONUS" == "false" ]]; then
  echo "🟢 LOW RISK - Fast validation"
  echo "   • Lint + format + unit tests only"
  npm run lint && npm run format:check && npm run test:unit
else
  echo "⚪ MINIMAL RISK - Quality checks only"
  echo "   • Lint + format check"
  npm run lint && npm run format:check
fi

echo ""
echo "💡 Tip: Run 'npm run test:all && npm run test:e2e' locally for full validation"
