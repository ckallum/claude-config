# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Personal Claude Code configuration repository (dotfiles-style). Stores hooks, commands, scripts, plugins, skills, and agents that bootstrap new projects.

## Structure

```
hooks/       # Custom hooks (shell commands triggered by Claude Code events)
commands/    # Custom slash commands
scripts/     # Standalone utility scripts + configure-claude installer
config/      # Global settings manifest (plugins, MCP servers, statusLine)
plugins/     # Claude Code plugins
skills/      # Custom skills
agents/      # Custom agent configurations
```

## Versioning

Current version: **1.4**

When making changes to this repo:
1. Bump the version in both CLAUDE.md and README.md
2. Add a line item to the changelog below

## Changelog

- **1.4** — Added marketplace checks to `configure-claude.js`; manifest now includes `marketplaces` array
- **1.3** — Added `configure-claude.js` installer script, `config/global-settings.json` manifest; skill now invokes the script directly
- **1.2** — Added `configure-claude` skill: installs hooks and scripts into any project's `.claude/` directory
- **1.1** — Added hooks system: hooks.json config, 6 hook scripts (session lifecycle, console.log checks, compact suggestions), lib utilities (utils, package-manager, session-aliases, session-manager)
- **1.0** — Initial setup: repo structure, CLAUDE.md, README.md
