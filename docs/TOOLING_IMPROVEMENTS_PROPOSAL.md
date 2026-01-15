# Tooling Improvements Proposal

**Date**: 2026-01-14
**Based on**: VBL Adopt vs /bs:quality Gap Analysis

## Problem Statement

Current tooling has complementary gaps:
- **VBL Adopt**: Finds issues but doesn't fix them
- **/bs:quality**: Fixes issues but may miss specialized scans (OWASP, secrets)

**Result**: Manual workflow required (run adopt → read reports → run quality)

---

## Proposed Changes

### 1. Enhance /bs:quality with Pre-Flight Security Scans

**Add Step 0.5: Security Pre-Flight (before agents)**

```bash
### Step 0.5: Security Pre-Flight Checks (New)

# Run before spawning agents to catch issues agents might miss

echo "🔒 Running security pre-flight checks..."

# 1. Secret scanning (Gitleaks)
if command -v gitleaks &> /dev/null; then
  echo "  → Scanning for secrets..."
  gitleaks detect --no-git --source . --report-format json --report-path .gitleaks-report.json || {
    echo "❌ Secrets detected! Review .gitleaks-report.json"
    SECURITY_BLOCKERS+=("Hardcoded secrets found")
  }
fi

# 2. OWASP Top 10 scan (create-qa-architect)
if [ "$QUALITY_LEVEL" = "98" ]; then
  echo "  → Running OWASP Top 10 scan..."
  npx create-qa-architect@latest --security-only --json > .owasp-report.json || {
    echo "⚠️  OWASP issues detected! Review .owasp-report.json"
    SECURITY_BLOCKERS+=("OWASP Top 10 violations")
  }
fi

# 3. Dependency vulnerabilities
echo "  → Checking dependencies..."
npm audit --audit-level=high --json > .npm-audit.json 2>&1 || {
  HIGH_VULNS=$(cat .npm-audit.json | jq '.metadata.vulnerabilities.high // 0')
  CRITICAL_VULNS=$(cat .npm-audit.json | jq '.metadata.vulnerabilities.critical // 0')
  if [ "$HIGH_VULNS" -gt 0 ] || [ "$CRITICAL_VULNS" -gt 0 ]; then
    echo "⚠️  High/Critical vulnerabilities found!"
    SECURITY_BLOCKERS+=("$HIGH_VULNS high + $CRITICAL_VULNS critical vulnerabilities")
  fi
}

# If blockers found, report and optionally auto-fix
if [ ${#SECURITY_BLOCKERS[@]} -gt 0 ]; then
  echo ""
  echo "🚨 Security Pre-Flight Failed:"
  for blocker in "${SECURITY_BLOCKERS[@]}"; do
    echo "  - $blocker"
  done
  echo ""

  if [ "$AUTO_FIX_SECURITY" = "true" ]; then
    echo "🔧 Auto-fixing security issues..."

    # Spawn security-auditor agent with specific findings
    Task(subagent_type: "security-auditor",
         prompt: "Fix security issues found in pre-flight:

         Gitleaks: $(cat .gitleaks-report.json 2>/dev/null || echo 'N/A')
         OWASP: $(cat .owasp-report.json 2>/dev/null || echo 'N/A')

         Loop until all security blockers resolved.")
  else
    echo "⚠️  Run with --auto-fix-security to address these before continuing"
    exit 1
  fi
fi

echo "✅ Security pre-flight passed"
```

**New flags:**
```bash
/bs:quality --level 98 --security-deep    # Enable OWASP + Gitleaks scans
/bs:quality --auto-fix-security           # Auto-spawn security-auditor for findings
```

---

### 2. Add /bs:audit Command (VBL Adopt + Quality Integration)

**New command: `/bs:audit`**

```markdown
---
description: "Comprehensive audit + automated fixing (VBL Adopt → /bs:quality)"
argument-hint: "/bs:audit → full scan + auto-fix | --report-only → scan without fixing"
---

# /bs:audit - Comprehensive Audit with Auto-Fix

**Combines VBL Adopt's discovery with /bs:quality's fixing.**

## Usage

```bash
/bs:audit                    # Full audit → auto-fix → update backlog
/bs:audit --report-only      # Audit without fixing (just reports)
/bs:audit --fix-critical     # Auto-fix critical issues only
/bs:audit --update-backlog   # Update BACKLOG.md with findings
```

## Implementation

### Step 1: Run VBL Adopt (Discovery)

```bash
echo "📊 Running comprehensive audit (VBL Adopt)..."

# Run create-qa-architect comprehensive scan
npx create-qa-architect@latest --comprehensive --json > .vbl-adopt-report.json

# Generate standard docs
npx create-qa-architect@latest --comprehensive

echo "✅ Audit complete. Reports generated:"
echo "  - docs/ARCHITECTURE-REVIEW.md"
echo "  - docs/CODE-REVIEW.md"
echo "  - docs/SECURITY-AUDIT.md"
echo "  - docs/ADOPTION-SUMMARY.md"
```

### Step 2: Parse Findings

```bash
# Extract issues from reports
SECURITY_SCORE=$(cat .vbl-adopt-report.json | jq '.security.score')
ARCHITECTURE_SCORE=$(cat .vbl-adopt-report.json | jq '.architecture.score')
CODE_SCORE=$(cat .vbl-adopt-report.json | jq '.code.score')

# Count critical issues
CRITICAL_ISSUES=$(cat .vbl-adopt-report.json | jq '[.security.issues[], .architecture.issues[], .code.issues[]] | map(select(.severity == "critical")) | length')

echo ""
echo "📊 Audit Summary:"
echo "  Security: $SECURITY_SCORE/100"
echo "  Architecture: $ARCHITECTURE_SCORE/100"
echo "  Code Quality: $CODE_SCORE/100"
echo "  Critical Issues: $CRITICAL_ISSUES"
```

### Step 3: Update Backlog (if --update-backlog)

```bash
if [ "$UPDATE_BACKLOG" = "true" ]; then
  echo ""
  echo "📝 Updating BACKLOG.md with findings..."

  # Use AI to parse reports and generate backlog items
  # Prompt: "Parse the VBL Adopt reports and add issues to BACKLOG.md
  #          following the existing format. Group by:
  #          - CRITICAL (Security Score < 50)
  #          - HIGH (Architecture/Code gaps)
  #          - MEDIUM (Suggestions)
  #
  #          For each issue:
  #          - Assign ID (SEC-*, ARCH-*, CODE-*)
  #          - Extract impact from report
  #          - Suggest fix from report
  #          - Estimate effort based on complexity"

  echo "✅ BACKLOG.md updated with VBL Adopt findings"
fi
```

### Step 4: Auto-Fix (if not --report-only)

```bash
if [ "$REPORT_ONLY" != "true" ]; then
  echo ""
  echo "🔧 Starting auto-fix workflow..."

  # Determine quality level based on issues
  if [ "$CRITICAL_ISSUES" -gt 0 ]; then
    QUALITY_LEVEL=98  # Use comprehensive fixing for critical issues
  else
    QUALITY_LEVEL=95  # Standard fixing otherwise
  fi

  if [ "$FIX_CRITICAL" = "true" ] && [ "$CRITICAL_ISSUES" -gt 0 ]; then
    # Spawn security-auditor agent with VBL Adopt findings
    echo "🚨 Fixing $CRITICAL_ISSUES critical issues..."

    Task(subagent_type: "security-auditor",
         prompt: "Fix critical security issues found by VBL Adopt:

         $(cat docs/SECURITY-AUDIT.md)

         Focus on critical issues only. Loop until resolved.")
  else
    # Run full quality loop
    echo "🎯 Running /bs:quality --level $QUALITY_LEVEL to fix all issues..."
    /bs:quality --level $QUALITY_LEVEL --scope all
  fi
fi
```

### Step 5: Report

```markdown
✅ Audit Complete

**VBL Adopt Scores:**
- Security: ${SECURITY_SCORE}/100
- Architecture: ${ARCHITECTURE_SCORE}/100
- Code Quality: ${CODE_SCORE}/100

**Critical Issues:** ${CRITICAL_ISSUES}

**Actions Taken:**
$(if --report-only: "Reports generated (no fixes applied)")
$(if --fix-critical: "$CRITICAL_ISSUES critical issues fixed")
$(if auto-fix: "Quality loop completed at ${QUALITY_LEVEL}%")

**Next Steps:**
- Review reports in docs/
- Check BACKLOG.md for remaining issues
- Run /bs:quality --merge when ready to ship
```
```

---

### 3. Enhance VBL Adopt Integration

**Add to existing VBL Adopt (if you control it):**

```bash
# After generating reports, optionally trigger auto-fix
if [ "$AUTO_FIX" = "true" ]; then
  echo ""
  echo "🔧 Auto-fix enabled. Spawning /bs:quality..."

  # Hand off to /bs:quality with findings
  /bs:quality --level 98 --scope all --vbl-adopt-findings=.vbl-adopt-report.json
fi
```

**New VBL Adopt flags:**
```bash
vbl adopt --auto-fix              # Run audit then spawn /bs:quality
vbl adopt --update-backlog        # Auto-update BACKLOG.md
vbl adopt --incremental           # Only scan changed files since last run
```

---

## Recommended Workflow Changes

### Old Workflow (Manual)
```bash
# 1. Run VBL Adopt
vbl adopt
# → Read 3 reports manually
# → Manually add issues to BACKLOG.md
# → Decide what to fix

# 2. Run quality loop
/bs:quality --level 98
# → May miss issues VBL Adopt found
# → No knowledge of VBL Adopt findings
```

### New Workflow (Automated)
```bash
# Option 1: Full automation
/bs:audit
# → VBL Adopt scan
# → Auto-update BACKLOG.md
# → Spawn /bs:quality to fix
# → One command, zero manual steps

# Option 2: Staged approach
/bs:audit --report-only          # Discovery phase
# Review reports
/bs:audit --fix-critical         # Fix critical issues only
/bs:quality --merge              # Final quality + ship

# Option 3: Quarterly health check
/bs:audit --update-backlog       # Scan + update backlog
# Work through backlog over time
/bs:quality --scope changed      # Daily quality checks
```

---

## Implementation Priority

### Phase 1: Quick Wins (< 4 hours)
1. ✅ Add Gitleaks pre-flight to /bs:quality (Step 0.5)
2. ✅ Add --security-deep flag to /bs:quality
3. ✅ Add --update-backlog to VBL Adopt (AI parses reports → BACKLOG.md)

### Phase 2: Integration (1-2 days)
4. ✅ Create /bs:audit command
5. ✅ Test VBL Adopt → /bs:quality handoff
6. ✅ Add incremental mode to VBL Adopt

### Phase 3: Polish (2-3 days)
7. ✅ Add quality score tracking to .qualityrc.json (VBL Adopt scores)
8. ✅ Create /bs:audit --status dashboard
9. ✅ Document workflow in README

---

## Expected Benefits

### Before
- **Manual effort**: 2-3 hours (run adopt, read reports, update backlog, run quality)
- **Coverage gaps**: /bs:quality may miss OWASP/secrets
- **Context loss**: Manual translation from reports to fixes

### After
- **One command**: `/bs:audit` (30-90 min autonomous)
- **Zero gaps**: VBL Adopt discovery + /bs:quality fixing
- **Auto-backlog**: Issues automatically tracked
- **Smart fixing**: Agents receive VBL Adopt findings as context

---

## Compatibility

**Backward compatible:**
- `/bs:quality` still works as before
- `vbl adopt` still works as standalone
- New flags are optional

**Migration path:**
```bash
# Old users can keep using:
/bs:quality --level 98

# New users can use integrated flow:
/bs:audit

# Power users can combine:
/bs:audit --fix-critical
/bs:quality --scope changed  # Daily
/bs:quality --merge          # Before PR
```

---

## Recommendation

**Implement Phase 1 immediately** (< 4 hours):
1. Add Gitleaks to /bs:quality Step 0.5
2. Add --update-backlog to VBL Adopt
3. Test on KeyFlash

**Ship Phase 2 within 1 week** (new /bs:audit command)

**This eliminates the gap between discovery and fixing.**
