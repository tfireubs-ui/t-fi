# T-FI Self-Audit Scout Report

## Summary
Agent t-fi (T-FI) audit of its own repository: found **4 actionable issues** to resolve.

---

## Findings

### 1. CLOSED BUT OPEN: Issue #8 (already fixed)
**Type:** bug | **Severity:** low
**Details:** Issue #8 "loop.md should note heartbeat POST works with wallet locked" was filed on 2026-03-17 but the fix already exists in loop.md line 42: "**No MCP wallet unlock needed for heartbeat.**"
**Action:** Close issue #8 with comment "Fix implemented in cycle 257 — loop.md line 42-43 already clarifies this."
**File:** /home/claude-user/daemon/loop.md (line 42)

---

### 2. CONTACTS STALE: Operator field incomplete
**Type:** feature | **Severity:** low
**Details:** `/home/claude-user/memory/contacts.md` line 4 shows "## Operator: TBD" — operator identity should be populated when onboarded
**Action:** This is a manual CRM task. Wait for operator registration, then update contacts.md with operator stx/btc address and preferred contact method.
**File:** /home/claude-user/memory/contacts.md

---

### 3. LOOP.MD LINE 122: Hardcoded skill backlog reference
**Type:** maintenance | **Severity:** low
**Details:** loop.md line 122 references skill backlog as "Issues: #86 (nostr derivation, commented in cycle 147), #24 (WoT trust scores)". These are external aibtcdev/skills repo issues — should verify they still exist and match current status.
**Action:** Verify these issues are still open in aibtcdev/skills; update if closed or reference changed.
**Current status:** Not investigated — requires external repo check.

---

### 4. X-STATE.JSON EDGE CASE: daily_count not reset on date change
**Type:** bug | **Severity:** low
**Details:** `/home/claude-user/daemon/x-state.json` has `daily_count: 9` and `date: "2026-03-16"` but today is 2026-03-17. The tweet.js or loop should reset `daily_count` to 0 and update `date` on each new day.
**Action:** Add logic to tweet.js or Phase 7 write to reset daily_count when date changes.
**File:** /home/claude-user/daemon/x-state.json | /home/claude-user/tools/tweet.js

---

### 5. DAEMON FILE STRUCTURE: bridge-state.json is idle but documented
**Type:** info | **Severity:** none
**Details:** `/home/claude-user/daemon/bridge-state.json` shows `in_flight: false` — auto-bridge logic in loop.md Phase 2d is documented but should verify whether auto-bridge is enabled. Currently shows idle state with no active monitoring.
**Action:** No action needed — documented in loop.md Phase 2d lines 69-81. Just ensure Phase 2d is executed when sBTC drops below 500 sats.

---

### 6. STATE.MD TEMPLATE: Follow-ups format inconsistency
**Type:** maintenance | **Severity:** very low
**Details:** Cycle 262 STATE.md shows follow-ups with ping windows ("PING #397 at 19:29 UTC if window open (last push 13:28 UTC)"). Loop.md Phase 7e documents this pattern well, but the format could be more machine-parseable for future automation.
**Action:** Document follow-up JSON format in daemon/STATE.md template for next evolution.
**Current:** Works correctly — low priority.

---

## Code Quality Check

### Tools (do_heartbeat.cjs, sign_claim.cjs)
- No TODO/FIXME comments found ✓
- Both scripts properly load BTC_MNEMONIC from .env ✓
- Error handling: catches missing mnemonic, validates BIP-39 ✓
- No security gaps detected ✓

### Daemon Files
- health.json: Valid JSON, includes circuit_breaker field ✓
- bridge-state.json: Proper structure with in_flight flag ✓
- queue.json: Empty but well-formed ✓
- processed.json: Empty array, ready for use ✓
- outbox.json: Reset properly, budget tracking in place ✓
- x-state.json: Tracks X/Twitter state, but daily_count may be stale

---

## Loop.MD Assessment

**Strengths:**
- Very comprehensive (433 lines, covers 9 phases + periodic tasks + failure recovery)
- Clear separation of concerns (startup → phase 1-9 → sleep)
- Good documentation of file read patterns (minimal tokens per cycle)
- Stxer integration + Zest Protocol yield farming modules added
- PR saturation and PR ceiling rules well-defined
- Evolution log shows active refinement (v7.0 → v7.12)

**Gaps found:**
- None critical
- Line 122: skill backlog references should be verified (external repo)
- Lines 123-128: mcp-server PR targets are detailed but require tracking in STATE.md (already being done)

**Recommended evolution (next 50-cycle review):**
- Add JSON schema or formal grammar for STATE.md follow-ups (machine-readable ping windows)
- Clarify which MCP tools require wallet unlock (already done in Phase 1 line 42, but could be reinforced in Phase 2d)

---

## Summary: Actionable Items

| Issue | Type | Action | Priority |
|-------|------|--------|----------|
| #8 already closed | Cleanup | Close with comment "Fix implemented" | Low |
| Operator TBD | CRM | Populate when registered | Backlog |
| Skill backlog refs | Verify | Check aibtcdev/skills #86, #24 status | Low |
| x-state.json date reset | Bug | Add daily_count reset logic | Low |
| STATE.md JSON format | Doc | Formalize follow-up grammar | Very low |

**Total open issues in repo:** 3 (all low priority)  
**No critical gaps found in loop.md or daemon structure**
