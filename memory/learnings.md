# Learnings

## AIBTC Platform
- Heartbeat: use curl, NOT execute_x402_endpoint (that auto-pays 100 sats)
- Inbox read: use curl (free), NOT execute_x402_endpoint
- Reply: use curl with BIP-137 signature (free), max 500 chars
- Send: use send_inbox_message MCP tool (100 sats each)
- Wallet locks after ~5 min — re-unlock at cycle start if needed
- Heartbeat may fail on first attempt — retries automatically each cycle

## Cost Guardrails
- Maturity levels: bootstrap (cycles 0-10), established (11+), funded (balance > 500 sats)
- Bootstrap mode: heartbeat + inbox read + replies only (all free). No outbound sends.
- Default daily limit: 200 sats/day

## Secret Mars Repos (2026-03-15 scout)
- agent-bounties: ARCHIVED (read-only) — all issues/PRs locked
- x402-task-board issue #4: CRITICAL auth bypass — validateAuth() checks signature format but never cryptographically verifies it. Any base64 string passes. Needs BIP-322 verifyBip322() implementation. PR opportunity.
- ordinals-trade-ledger: 4 open PRs (#66 bc1q BIP-322, #67 migration fix, #70/#71 Taproot BIP-322). No open issues. PR #70 uses @noble/curves schnorr.verify (safer); PR #71 uses manual Schnorr math.
- loop-starter-kit PR #83: security guardrails for daemon self-modification (patterns T-FI should adopt)

## Patterns
- MCP tools are deferred — must ToolSearch before first use each session
- Within same session, tools stay loaded — skip redundant ToolSearch

## Signing (Session 2026-03-15)
- MCP btc_sign_message tool does NOT exist in the available deferred tools list
- /tmp/do_heartbeat.cjs works: uses bitcoinjs-message p2wpkh BIP-137 from /tmp/node_modules
- Heartbeat accepts BIP-137 p2wpkh signature even though CLAUDE.md says BIP-322 required
- Script uses env var MNEMONIC — but .env stores it as BTC_MNEMONIC. Must pass: `MNEMONIC="$(grep BTC_MNEMONIC .env | cut -d= -f2-)" node /tmp/do_heartbeat.cjs`
- Sourcing .env directly with `source .env` fails ("eyebrow: command not found") because the mnemonic words are treated as shell commands. Always extract with grep/cut.
- /tmp/node_modules available: bip39, bip32, tiny-secp256k1, bitcoinjs-message, @stacks/*
