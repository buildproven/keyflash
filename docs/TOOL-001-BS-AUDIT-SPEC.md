# TOOL-001: /bs:audit Integrated Workflow

**Status**: 💡 Planned
**Priority**: 🔥 High Value - Next Up
**Effort**: M (1-2 days for complete implementation, < 4 hours for Phase 1)
**ID**: TOOL-001

---

## Problem Statement

**Current workflow is manual and fragmented:**

```bash
# Step 1: Run VBL Adopt (10 min)
vbl adopt

# Step 2: Read reports manually (30 min)
# - Open docs/ARCHITECTURE-REVIEW.md
# - Open docs/CODE-REVIEW.md
# - Open docs/SECURITY-AUDIT.md
# - Take notes on issues

# Step 3: Update BACKLOG.md manually (20 min)
# - Parse issues from reports
# - Assign IDs (SEC-*, ARCH-*, CODE-*)
# - Estimate effort
# - Write impact/fix descriptions

# Step 4: Run quality loop (90 min)
/bs:quality --level 98

# Total: 150 min + manual context switching + risk of missing issues
```

**Pain points:**

- ❌ Manual context switching between tools
- ❌ Reports don't feed into fixing agents
- ❌ Risk of missing issues during translation
- ❌ /bs:quality may miss OWASP/secret scans that VBL Adopt catches
- ❌ No audit trail of what was found vs fixed

---

## Solution: Integrated One-Command Workflow

```bash
/bs:audit
# → Runs VBL Adopt comprehensive scan (10 min)
# → Auto-parses reports to BACKLOG.md (AI-powered, 2 min)
# → Spawns /bs:quality with VBL Adopt findings as context (90 min)
# → Commits all changes with audit summary
# Total: 102 min, zero manual steps
```

**Key improvements:**

- ✅ One command from audit to ship-ready
- ✅ Zero manual translation
- ✅ VBL Adopt findings feed directly to agents
- ✅ Auto-updates backlog with proper formatting
- ✅ Comprehensive coverage (OWASP + secrets + code quality)

---

## Implementation Phases

### Phase 1: Quick Wins (< 4 hours) - **SHIP THIS FIRST**

**Add security pre-flight to /bs:quality:**

```bash
# New Step 0.5 in /bs:quality (before agents spawn)

### Step 0.5: Security Pre-Flight Checks

if [ "$SECURITY_DEEP" = "true" ] || [ "$QUALITY_LEVEL" = "98" ]; then
  echo "🔒 Running security pre-flight..."

  # 1. Secret scanning (Gitleaks)
  gitleaks detect --source . --report-format json --report-path .gitleaks-report.json

  # 2. OWASP Top 10 scan
  npx create-qa-architect@latest --security-only --json > .owasp-report.json

  # 3. Dependency audit
  npm audit --audit-level=high --json > .npm-audit.json

  # Parse findings
  SECURITY_BLOCKERS=()
  # ... extract critical issues ...

  # If blockers found, spawn security-auditor with context
  if [ ${#SECURITY_BLOCKERS[@]} -gt 0 ]; then
    Task(subagent_type: "security-auditor",
         prompt: "Fix security pre-flight findings:

         Gitleaks: $(cat .gitleaks-report.json)
         OWASP: $(cat .owasp-report.json)

         Loop until clean.")
  fi
fi
```

**Add --update-backlog to VBL Adopt wrapper:**

```bash
# After VBL Adopt generates reports, parse and update BACKLOG.md

if [ "$UPDATE_BACKLOG" = "true" ]; then
  echo "📝 Updating BACKLOG.md..."

  # Use AI to parse reports
  # Prompt: "Parse VBL Adopt reports and add to BACKLOG.md:
  #         - Extract issues from ARCHITECTURE-REVIEW.md, CODE-REVIEW.md, SECURITY-AUDIT.md
  #         - Assign IDs: SEC-*, ARCH-*, CODE-*
  #         - Group by priority: CRITICAL (score < 50), HIGH (score 50-80), MEDIUM (score 80-90)
  #         - Format: | ID | Issue | Category | Effort | Status |
  #         - Add details section with impact and fix
  #         - Follow existing BACKLOG.md format exactly"

  # AI parses and updates BACKLOG.md
  git add BACKLOG.md
  git commit -m "chore: Update backlog with VBL Adopt findings"
fi
```

**New flags added:**

```bash
/bs:quality --security-deep        # Enable OWASP + Gitleaks scans
/bs:quality --auto-fix-security    # Auto-spawn security-auditor for findings
vbl adopt --update-backlog         # Auto-parse reports to BACKLOG.md
```

**Testing:**

```bash
# Test on KeyFlash
cd ~/Projects/keyflash
/bs:quality --level 98 --security-deep
# → Should run Gitleaks + OWASP before agents
# → Should catch SEC-021, SEC-022 that were missed before

vbl adopt --update-backlog
# → Should auto-add 21 items to BACKLOG.md
# → Verify formatting matches existing entries
```

**Deliverables:**

- ✅ Modified `/bs:quality` command with Step 0.5
- ✅ New `--security-deep` flag
- ✅ VBL Adopt wrapper with `--update-backlog`
- ✅ Test report showing gap elimination

**Effort**: 3-4 hours

---

### Phase 2: Integration (1-2 days)

**Create new /bs:audit command:**

````markdown
---
description: 'Comprehensive audit + automated fixing (VBL Adopt → /bs:quality)'
argument-hint: '/bs:audit → scan + fix | --report-only → scan only'
---

# /bs:audit - Integrated Audit Workflow

## Usage

```bash
/bs:audit                    # Full: scan → update backlog → auto-fix
/bs:audit --report-only      # Scan only (no fixing)
/bs:audit --fix-critical     # Fix critical issues only (not all)
/bs:audit --update-backlog   # Update backlog even in report-only mode
```
````

## Implementation

### Step 1: Run VBL Adopt

```bash
npx create-qa-architect@latest --comprehensive --json > .vbl-adopt-report.json
npx create-qa-architect@latest --comprehensive  # Generate MD reports
```

### Step 2: Parse Findings

```bash
SECURITY_SCORE=$(jq '.security.score' .vbl-adopt-report.json)
ARCH_SCORE=$(jq '.architecture.score' .vbl-adopt-report.json)
CODE_SCORE=$(jq '.code.score' .vbl-adopt-report.json)
CRITICAL_COUNT=$(jq '[.security.issues[], .architecture.issues[], .code.issues[]] | map(select(.severity == "critical")) | length' .vbl-adopt-report.json)
```

### Step 3: Update Backlog (if enabled)

```bash
if [ "$UPDATE_BACKLOG" = "true" ]; then
  # AI parses reports and updates BACKLOG.md
  # (Same as Phase 1 --update-backlog implementation)
fi
```

### Step 4: Auto-Fix (if not --report-only)

```bash
if [ "$REPORT_ONLY" != "true" ]; then
  if [ "$FIX_CRITICAL" = "true" ]; then
    # Spawn security-auditor with critical issues only
    Task(subagent_type: "security-auditor",
         prompt: "Fix critical issues from VBL Adopt:

         $(cat docs/SECURITY-AUDIT.md | grep -A5 'CRITICAL')

         Focus on critical severity only.")
  else
    # Run full quality loop with VBL Adopt context
    QUALITY_LEVEL=98  # Use 98% for comprehensive fixing
    /bs:quality --level $QUALITY_LEVEL --scope all --vbl-context=.vbl-adopt-report.json
  fi
fi
```

### Step 5: Report Results

```markdown
✅ /bs:audit Complete

**VBL Adopt Scores:**

- Security: ${SECURITY_SCORE}/100
- Architecture: ${ARCH_SCORE}/100
- Code Quality: ${CODE_SCORE}/100

**Critical Issues:** ${CRITICAL_COUNT}

**Actions Taken:**

- Reports generated in docs/
- BACKLOG.md updated with ${NEW_ITEMS_COUNT} items
- Quality loop completed (${ISSUES_FIXED} issues fixed)
- Committed as: ${COMMIT_HASH}

**Next Steps:**

- Review docs/SECURITY-AUDIT.md for remaining issues
- Check BACKLOG.md for prioritization
- Run /bs:quality --merge when ready to ship
```

````

**New command file:** `~/.claude/commands/bs/audit.md`

**Testing:**
```bash
# Test full workflow
/bs:audit
# → Should run VBL Adopt
# → Should update BACKLOG.md
# → Should spawn /bs:quality
# → Should commit with summary

# Test report-only mode
/bs:audit --report-only
# → Should generate reports only
# → Should NOT run /bs:quality

# Test fix-critical mode
/bs:audit --fix-critical
# → Should fix only critical severity issues
# → Faster than full quality loop
````

**Deliverables:**

- ✅ New `/bs:audit` command
- ✅ Integration between VBL Adopt and /bs:quality
- ✅ Handoff mechanism (VBL findings → agent context)
- ✅ Test suite for all modes

**Effort**: 1-2 days

---

### Phase 3: Polish (Optional)

**Add audit history tracking:**

```json
// .qualityrc.json
{
  "history": {
    "lastReady": { ... },
    "lastPerfect": { ... },
    "audits": [
      {
        "timestamp": "2026-01-14T12:00:00Z",
        "scores": {
          "security": 75,
          "architecture": 85,
          "code": 90
        },
        "critical": 3,
        "high": 12,
        "medium": 8,
        "fixed": {
          "critical": 3,
          "high": 10,
          "medium": 5
        }
      }
    ]
  }
}
```

**Create audit status dashboard:**

```bash
/bs:audit --status
# → Shows audit history
# → Trend analysis (scores improving/declining)
# → Time to fix critical issues
```

**Add incremental mode:**

```bash
/bs:audit --incremental
# → Only scans files changed since last audit
# → Faster for daily checks (5-10 min vs 90 min)
# → Updates only affected sections of BACKLOG.md
```

**Deliverables:**

- ✅ Audit history in .qualityrc.json
- ✅ Status dashboard command
- ✅ Incremental scanning mode

**Effort**: 2-3 days

---

## Value Proposition

### Time Savings

**Before (Manual):**

- VBL Adopt scan: 10 min
- Read 3 reports: 30 min
- Update BACKLOG.md: 20 min
- Run /bs:quality: 90 min
- **Total: 150 min** (2.5 hours)

**After (Automated):**

- `/bs:audit`: 102 min (1.7 hours)
- Zero manual steps
- **Savings: 48 min per run** (32% faster)

**Annual impact** (2-3 runs per week):

- 48 min × 2.5 runs/week × 52 weeks = **104 hours/year saved**
- Equivalent to 2.6 weeks of full-time work

---

### Quality Improvements

**Before:**

- ❌ /bs:quality agents may miss OWASP-specific scans
- ❌ Secret scanning not integrated
- ❌ Manual transcription errors (report → backlog → fixes)
- ❌ Context lost between tools

**After:**

- ✅ 100% coverage (VBL Adopt OWASP + Gitleaks + /bs:quality agents)
- ✅ Zero transcription errors (AI-powered parsing)
- ✅ VBL findings feed directly to agents
- ✅ Full audit trail (what was found, what was fixed, what remains)

---

### Developer Experience

**Before:**

```bash
# Feels like homework
vbl adopt                    # "Ugh, now I have to read 3 reports"
# ... 30 min of reading ...  # "Did I get everything?"
# ... 20 min of typing ...   # "Hope I formatted this right"
/bs:quality --level 98       # "Finally, the actual fixing"
```

**After:**

```bash
# Feels like magic
/bs:audit                    # "One command, I'll check back in 90 min"
# ... coffee break ...
# Returns to: "✅ All done, 21 issues fixed, ready to ship"
```

---

## Success Metrics

**Phase 1 (Quick Wins):**

- ✅ /bs:quality catches SEC-021, SEC-022 (secrets previously missed)
- ✅ BACKLOG.md auto-updated with 21 items in correct format
- ✅ Zero manual BACKLOG.md edits needed

**Phase 2 (Integration):**

- ✅ /bs:audit runs end-to-end without errors
- ✅ Time reduced from 150 min to 102 min (32% improvement)
- ✅ Zero issues missed (100% coverage)

**Phase 3 (Polish):**

- ✅ Audit history tracked for trend analysis
- ✅ Incremental mode reduces daily checks to < 10 min

---

## Risks & Mitigations

| Risk                                      | Likelihood | Impact | Mitigation                                   |
| ----------------------------------------- | ---------- | ------ | -------------------------------------------- |
| AI parsing of reports is inaccurate       | Medium     | High   | Validate output format, test with 10 samples |
| Gitleaks/OWASP scans add significant time | Low        | Medium | Run in parallel, cache results               |
| VBL Adopt + /bs:quality version conflicts | Low        | High   | Pin versions, test compatibility             |
| Handoff loses context between tools       | Medium     | High   | JSON-based findings file, structured handoff |

---

## Dependencies

**Required:**

- VBL Adopt (installed)
- /bs:quality command (exists)
- create-qa-architect@latest (npm package)
- Gitleaks (optional but recommended)

**Nice to have:**

- jq (for JSON parsing)
- Git (for commit automation)

---

## Rollout Plan

### Week 1: Phase 1 Implementation

**Day 1-2**: Add security pre-flight to /bs:quality

- Implement Step 0.5 (Gitleaks + OWASP)
- Add `--security-deep` flag
- Test on KeyFlash

**Day 3-4**: Add backlog auto-update

- AI prompt for parsing reports
- Test BACKLOG.md formatting
- Validate 21 items correctly added

**Day 5**: Integration testing

- Run full flow: VBL Adopt → update backlog → /bs:quality
- Fix any gaps
- Document in CHANGELOG.md

### Week 2: Phase 2 Implementation

**Day 1-2**: Create /bs:audit command structure

- Scaffold command file
- Implement Steps 1-5
- Basic testing

**Day 3**: Implement handoff mechanism

- VBL findings → JSON
- /bs:quality reads JSON as context
- Agents receive findings

**Day 4-5**: Testing & refinement

- Test all modes (--report-only, --fix-critical, default)
- Edge case handling
- Documentation

### Week 3: Phase 3 (Optional)

- Audit history tracking
- Status dashboard
- Incremental mode

---

## Alternative Approaches Considered

### Alternative 1: Enhance VBL Adopt Only

**Pros**: Single tool, simpler architecture
**Cons**: VBL Adopt is discovery-focused, would need full agent framework
**Decision**: Rejected - /bs:quality already has autonomous agents

### Alternative 2: Enhance /bs:quality Only

**Pros**: Single command, no VBL Adopt dependency
**Cons**: Would need to rebuild all VBL Adopt scanning capabilities
**Decision**: Rejected - VBL Adopt's OWASP/Gitleaks scanners are proven

### Alternative 3: Build New Tool

**Pros**: Clean slate, perfect integration
**Cons**: Months of work, duplication of existing capabilities
**Decision**: Rejected - Integration is faster and leverages existing tools

### Alternative 4: Keep Manual Workflow (Status Quo)

**Pros**: Zero implementation effort
**Cons**: Wastes 104 hours/year, error-prone, poor developer experience
**Decision**: Rejected - ROI too compelling to ignore

---

## Next Steps

1. **Approve this spec** (Decision: Proceed with Phase 1 or full implementation?)
2. **Phase 1 implementation** (< 4 hours)
3. **Test on KeyFlash** (Validate gap elimination)
4. **Ship Phase 1** (Update vibelab-claude-setup)
5. **Evaluate Phase 2** (Based on Phase 1 success)

---

## References

- Full proposal: `docs/TOOLING_IMPROVEMENTS_PROPOSAL.md`
- Gap analysis: `docs/VBL_ADOPT_VS_BS_QUALITY_ANALYSIS.md`
- Current /bs:quality: `~/.claude/commands/bs/quality.md`
- VBL Adopt docs: `docs/ADOPTION-SUMMARY.md`

---

**Questions? Contact: Brett Stark**
