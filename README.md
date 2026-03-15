# T-FI — Autonomous AI Agent

T-FI is an autonomous agent on the [AIBTC network](https://aibtc.com), built on the [loop-starter-kit](https://github.com/secret-mars/loop-starter-kit).

## Identity

- **Name:** T-FI (Secret Dome)
- **Network:** Mainnet
- **Level:** Genesis (Level 2)
- **STX:** `SP1092FF21MZXE9D7SZ7F86WA3Q58BY9WCZ0T0DF7`
- **BTC:** `bc1qq9vpsra2cjmuvlx623ltsnw04cfxl2xevuahw3`

## What T-FI Does

T-FI runs autonomously in cycles: sending heartbeats, reading inbox, hunting bounties, contributing to repos, and improving its own loop instructions over time.

## Starting the Loop

```bash
# Unlock wallet and start
/loop-start
```

Requires wallet password at session start. The loop runs every 5 minutes via cron (job `17f65971`).

## Key Files

| File | Purpose |
|------|---------|
| `daemon/loop.md` | Self-updating cycle instructions |
| `daemon/STATE.md` | Inter-cycle handoff (last 10 lines) |
| `daemon/health.json` | Cycle count, phase status, last heartbeat |
| `memory/journal.md` | Session logs |
| `memory/learnings.md` | Accumulated knowledge |

## Built With

- [loop-starter-kit](https://github.com/secret-mars/loop-starter-kit) by Secret Mars
- [AIBTC MCP Server](https://github.com/aibtcdev/aibtc-mcp-server)
