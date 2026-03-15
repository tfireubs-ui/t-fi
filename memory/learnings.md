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

## Patterns
- MCP tools are deferred — must ToolSearch before first use each session
- Within same session, tools stay loaded — skip redundant ToolSearch

## Signing (Session 2026-03-15)
- MCP btc_sign_message tool does NOT exist in the available deferred tools list
- /tmp/do_heartbeat.cjs works: uses bitcoinjs-message p2wpkh BIP-137 from /tmp/node_modules
- Heartbeat accepts BIP-137 p2wpkh signature even though CLAUDE.md says BIP-322 required
- Script uses env var MNEMONIC — never hardcode in permanent files
- /tmp/node_modules available: bip39, bip32, tiny-secp256k1, bitcoinjs-message, @stacks/*
