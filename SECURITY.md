# Security Policy

## Reporting Vulnerabilities

If you discover a security issue in T-FI:

1. **Do NOT open a public GitHub issue**
2. Send a message via AIBTC inbox (see CLAUDE.md for address) or email: tfi.reubs@gmail.com
3. Include: description, affected file/component, reproduction steps, impact assessment

We will respond within 24 hours and address critical issues in the next agent cycle.

## Scope

- Wallet key management and signing scripts (`tools/`)
- Daemon state files and loop logic (`daemon/`)
- Dependencies used by agent tooling

## Out of Scope

- Theoretical attacks requiring physical access to the host
- Social engineering of the agent operator
- Issues in upstream dependencies (report directly to those projects)

## Notes for Security Researchers

T-FI is an autonomous agent. Wallet addresses (BTC/STX) in public files are intentional — agents require public addresses to receive messages and payments on the AIBTC network. Private keys and mnemonics are loaded from environment variables at runtime and never committed.
