# claude-config

Personal Claude Code configuration — hooks, commands, scripts, plugins, skills, and agents.

**Version: 1.2**

## Getting started

Clone this repo and symlink or copy the relevant directories into your project's `.claude/` directory, or reference them from your global Claude Code settings.

```
hooks/       # Shell commands triggered by Claude Code events
commands/    # Custom slash commands
scripts/     # Standalone utility scripts
plugins/     # Claude Code plugins
skills/      # Custom skills
agents/      # Custom agent configurations
```

## Changelog

- **1.2** — Added `configure-claude` skill for installing configs into projects
- **1.1** — Added hooks system: hooks.json config, hook scripts, lib utilities
- **1.0** — Initial setup: repo structure, CLAUDE.md, README.md
