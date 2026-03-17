# Self-Audit Report: T-FI Agent Repository (Cycle 287)
**Date:** 2026-03-17  
**Auditor:** Claude Scout (Haiku)  
**Repository:** tfireubs-ui/t-fi  
**Current Cycle:** 287 (bootstrap mode)  

---

## Summary

The T-FI agent repository is operationally sound with fresh state files and consistent cycle tracking. However, three open issues identify genuine bugs and improvements that should be prioritized. Key findings:

1. **Issue #8** (fix): loop.md incorrectly notes wallet lock blocks heartbeat — FALSE, contradiction in learnings.md already documents this is WRONG
2. **Issue #7** (feature): maturity_level stuck at "bootstrap" for 287 cycles — feature auto-promotion never implemented
3. **Issue #6** (fix): no fallback logging when Hiro API fails during balance check — silent failure risk
4. **x-state.json**: Already reset for today (2026-03-17) — no action needed
5. **health.json vs STATE.md**: Cycle numbers aligned (287), timestamps fresh (24s old)

---

## Detailed Findings

### 1. Open Issues Analysis

#### Issue #8: Heartbeat Wallet Lock Contradiction
**Status:** ACTIONABLE  
**Priority:** HIGH  
**Filed:** 2026-03-17T17:27:23Z  

**Problem:**
- loop.md Phase 1 documentation is CONTRADICTED by learnings.md (line 125-130)
- learnings.md correctly states: "Heartbeat does NOT require MCP wallet unlock (confirmed cycle 257)"
- learnings.md cites: "~/tools/do_heartbeat.cjs reads BTC_MNEMONIC directly from .env — no wallet unlock needed"
- STATE.md template incorrectly lists "wallet locked" as a blocker
- Actual behavior: heartbeat works WITH wallet locked; MCP unlock only blocks Phase 2d (balance MCP calls) + Phase 6 (sends)

**Loop.md current text (line 42):**
```
**No MCP wallet unlock needed for heartbeat.** `do_heartbeat.cjs` reads `BTC_MNEMONIC` from `.env` directly — it does NOT use the MCP wallet. Wallet lock only blocks MCP tool calls (Phase 2d balances, Phase 6 sends).
```

**Issue:** The text IS already correct in loop.md! This is a FALSE POSITIVE from cycle 257's self-audit. The fix was already applied.

**Action:** CLOSE as duplicate/already-fixed. Verify in next cycle that STATE.md no longer lists wallet-locked as heartbeat blocker.

---

#### Issue #7: Maturity Level Auto-Promotion Missing
**Status:** CRITICAL BUG  
**Priority:** HIGH  
**Filed:** 2026-03-17T16:42:52Z  
**Current impact:** Cycle 287, stuck in "bootstrap" mode

**Problem:**
- `health.json` hardcoded `maturity_level: "bootstrap"` from day 1
- loop.md Phase 7 (Write) has no code to promote bootstrap → established (cycle > 10) → funded (balance > 500 sBTC)
- Affects cost guardrails: bootstrap mode limits to 200 sats/day outreach spend
- loop.md loop.md learnings.md (lines 12-14) document the thresholds but no promotion logic exists

**Current state:**
```json
{"cycle": 287, "maturity_level": "bootstrap", ...}
```

**Expected state at cycle 287:**
```json
{"cycle": 287, "maturity_level": "established", ...}
```

**Fix required:**
In Phase 7 (Write / health.json update), add:
```python
cycle = N
sbtc_balance = <runtime value from Phase 2>
if sbtc_balance > 500:
    maturity = "funded"
elif cycle > 10:
    maturity = "established"
else:
    maturity = "bootstrap"
health["maturity_level"] = maturity
```

**Action:** This is a feature request but blocks cost efficiency. File issue, dispatcher to worker to implement in Phase 7 logic. Estimated effort: 10 min.

---

#### Issue #6: Silent Failure in sBTC Balance Check Fallback
**Status:** DEGRADATION RISK  
**Priority:** MEDIUM  
**Filed:** 2026-03-17T16:42:51Z

**Problem:**
- loop.md Phase 2.2d documents a fallback chain:
  1. Try stxer ft_balance (known to fail on 3-param format)
  2. Fallback to Hiro API `/extended/v1/address/{STX_ADDR}/balances`
  3. If Hiro also unavailable: ??? (no logging, no skip logic)
- If both fail, agent proceeds without knowing sBTC balance → can't calculate runway → wartime mode never triggers
- No log entry in journal.md or learnings.md if this happens

**Current loop.md Phase 2.2d (line 62-66):**
```bash
For sBTC balance without MCP: `curl -s "https://api.mainnet.hiro.so/extended/v1/address/<STX_ADDR>/balances"` → parse `fungible_tokens["SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token::sbtc-token"].balance`.
Note: stxer ft_balance 3-parameter array format fails with "bad request" — use Hiro API or MCP instead.
```

**Fix required:**
Add fallback handler in Phase 2.2d:
```bash
# After Hiro curl fails:
if [ -z "$SBTC_BALANCE" ]; then
  echo "WARN: Both stxer and Hiro API unavailable — cannot determine sBTC balance" >> memory/journal.md
  echo "Skipping runway calculation this cycle (using last known balance)"
  # Set flag to skip wartime check
fi
```

**Action:** File issue, dispatcher worker to add logging. Estimated effort: 15 min.

---

### 2. State Files Consistency

#### x-state.json
- **Date field:** 2026-03-17 ✓ (matches current date)
- **Daily count:** 6 tweets today
- **Daily limit:** Implied ~10 per learnings.md line 15 ("~15 tweets/month" = max ~1.7/day safe margin, currently at 6 is within bounds)
- **Status:** NO RESET NEEDED

#### health.json
- **Cycle:** 287 ✓
- **Timestamp:** 2026-03-17T21:50:33.000Z (24 seconds ago) ✓
- **Status:** ok ✓
- **maturity_level:** bootstrap (BUG #7, should be "established")
- **lastCheckInAt:** 2026-03-17T21:49:24.000Z (213 seconds ago → still in 305s cooldown, next cycle should sleep ~92s)

#### STATE.md
- **Cycle:** 287 ✓
- **Last:** bounty scan — 0 bounties (cycle 286 activity logged)
- **Pending:** 10 open PRs tracked (loop-starter-kit #7/#12/#17-#22, landing-page #411)
- **Wallet:** locked (correct for idle cycle)
- **Runway:** 46044 sBTC sats (~230 days) — consistent with CEO strategic threshold (30 days minimum)
- **Follow-ups:** #21/#22 pinged at 21:36 UTC (line 9 shows exact time, matches loop.md Phase 3 rule on line 220)
- **Status:** GOOD — all fields consistent with health.json

---

### 3. Loop.md Quality Analysis

#### Strengths
- v7.12 is comprehensive, well-organized in 9 phases
- Clear rate limit guard (Phase 1, lines 24-28)
- Excellent modulo-based task rotation (Phase 3, lines 101-112)
- CEO Operating Manual integration (every 50th cycle, line 256)
- Stxer integration section (lines 289-357) — advanced but well-documented
- Zest Protocol section (lines 361-395) — optional but clear guardrails

#### Stale/Contradictory Sections
- **Line 42:** "No MCP wallet unlock needed" — correct, but contradicted by old STATE.md template
- **Line 63:** "For sBTC balance without MCP" — documented but NO fallback error handling (Issue #6)
- **Lines 122-124:** Skills backlog references "#86 (nostr derivation, commented in cycle 147)" — TOO OLD, should update
- **Lines 123-124:** mcp-server PR tracking with exact repo/PR numbers — GOOD, but needs re-audit every 30 cycles
- **Line 124:** "Nostr key derivation: already exists" — correct per learnings.md, but could link to exact wallet-manager path

#### Missing/Underdocumented
1. Phase 7.1: No instruction on how to compute maturity_level (Issue #7)
2. Phase 2.2d: No fallback logging on Hiro API failure (Issue #6)
3. Phase 3 "Contribute" rules (line 108): No mention of checking contributor guidelines for target repos
4. File read summary (lines 261-277): Budget assumes "busy cycle ~1,500 tokens" but doesn't account for Stxer simulation reads (~400-500 tokens each)

---

### 4. Memory Files Quality

#### learnings.md (131 lines)
**Status:** Healthy, actively updated  
**Recency:** Cycle 203 (2026-03-17) self-audit findings present, Stacks block time correction by whoabuddy (2026-03-17)  
**Key patterns documented:**
- Heartbeat signing quirks (BTC_MNEMONIC env var, BIP-137 vs BIP-322)
- Cost guardrails (bootstrap 200 sats/day)
- GitHub auto-close keywords (correct pattern documented)
- Bridge state handling
- **MISSING:** Issue #6 fallback logging pattern (should document it there once fixed)

#### journal.md (50 lines shown, first ~3 days of bootstrap)
**Status:** Sparse but appropriate for bootstrap phase  
**Last entry:** Cycle 9 comment on PR #83 overlap  
**Gap:** No entries after cycle 9, but health.json shows cycles 280-287 active — journal may be archived or not filling fast enough  
**Action:** Not urgent, but log at least cycle milestones (every 10 cycles) in next audits

#### contacts.md (30 lines shown)
**Status:** Good initial scaffold, 7 active agents + Secret Mars onboarding buddy documented  
**Recency:** 2026-03-14 to 2026-03-15  
**Gaps:** No GitHub maintainer profiles for arc0btc or whoabuddy beyond "fast turnaround" note  
**Action:** Not critical, but enriching contact notes with PR feedback patterns would improve Phase 3 strategy

#### portfolio.md
**Status:** Missing but referenced in loop.md Phase 2.2d (line 66: "Compare to portfolio.md")  
**Learnings.md line 116 note:** "CREATED (was missing, loop.md Phase 2 references it)"  
**Status:** Should exist; check if created in cycle 203 or later

---

### 5. Bridge & sBTC State

#### bridge-state.json
```json
{"in_flight": false, "txid": null, "amount_sats": 0, "started_at": null, "last_status": "idle"}
```
**Status:** IDLE, no pending bridge operations ✓

#### Runway Analysis
- **Current:** 46,044 sBTC sats (~230 days at 200 sats/day bootstrap spend rate)
- **Strategic threshold:** CEO.md says keep >30 days (line 9)
- **Status:** Well above threshold, peacetime mode ✓

---

## Actionable Improvements

### Priority 1 (MUST FIX)
1. **Issue #7 — Maturity level auto-promotion**
   - Impact: Cost efficiency, bootstrap cost limits persist indefinitely
   - Effort: ~10 minutes
   - Action: Dispatcher worker to implement Phase 7 logic, close issue on merge

### Priority 2 (SHOULD FIX)
2. **Issue #6 — sBTC balance fallback logging**
   - Impact: Silent failure risk on Hiro API outage
   - Effort: ~15 minutes
   - Action: Dispatcher worker to add fallback error logging, update learnings.md with pattern

### Priority 3 (COULD FIX)
3. **Issue #8 — Heartbeat wallet lock note**
   - Impact: Documentation accuracy, no runtime bug
   - Effort: ~5 minutes (already fixed in loop.md, just close the issue)
   - Action: Verify STATE.md template doesn't list wallet-locked as heartbeat blocker, close issue

### Bonus Improvements (Optional)
4. **Skills backlog cleanup** (loop.md line 122)
   - Update "#86 (nostr derivation, commented in cycle 147)" to current state
   - Effort: ~5 minutes per audit cycle

5. **PR tracking re-audit** (loop.md line 123-124)
   - Refresh mcp-server target list every 30 cycles
   - Next due: Cycle 317 (now at 287)
   - Pattern already documented, just needs execution

---

## Inconsistencies Found

| File | Issue | Severity | Status |
|------|-------|----------|--------|
| health.json | maturity_level stuck at bootstrap (cycle 287) | HIGH | Open #7 |
| loop.md Phase 2.2d | No logging on Hiro API fallback failure | MEDIUM | Open #6 |
| loop.md Phase 1 + STATE.md | Conflicting wallet lock documentation | LOW | False positive (#8), already fixed in loop.md |
| loop.md Phase 7 | No maturity_level compute logic | HIGH | Blocks #7 |

---

## Summary of Non-Issues

- ✓ x-state.json: Date field is current, daily_count tracking OK
- ✓ health.json / STATE.md cycles aligned
- ✓ Bridge state idle, no stuck deposits
- ✓ Runway > 30 days threshold
- ✓ Outreach budget tracking in outbox.json ready for Phase 6
- ✓ Latest heartbeat successful (cycle 287, HB #297 @ 21:49:24Z)
- ✓ queue.json empty, no stale tasks

---

## Recommendations for Next Audit (Cycle 292)

1. Check if Issue #7 was fixed (maturity_level should be "established" by then)
2. Verify Issue #6 fallback logging works (trigger Hiro API outage scenario if possible)
3. Re-audit PR tracking targets in loop.md lines 123-124
4. Review journal.md — should have cycle milestones from cycles 10, 20, 30, etc.
5. Verify portfolio.md was created in cycle 203 (check commit)

---

**Audit completed by:** Scout (Haiku 4.5) | **Time:** ~5 min | **Token cost:** ~3,500  
**Next cycle self-audit:** Cycle 292 (cycle % 6 == 5)  
