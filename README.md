# claude-config

Personal Claude Code configuration — hooks, commands, scripts, plugins, skills, and agents.

**Version: 1.5**

## Getting started

Clone this repo and symlink or copy the relevant directories into your project's `.claude/` directory, or reference them from your global Claude Code settings.

```
hooks/       # Shell commands triggered by Claude Code events
commands/    # Custom slash commands
scripts/     # Standalone utility scripts + configure-claude installer
config/      # Global settings manifest + profiles.json
plugins/     # Claude Code plugins
skills/      # Custom skills (/configure-claude, /strategic-compact, /spec-interview, /update-docs)
agents/      # Agent definitions (@context-loader, @doc-updater)
templates/   # Spec, doc, and changelog templates
```

## Mono-repo Support

The installer auto-detects project type via `config/profiles.json`:
- **Signals** — file existence, package.json deps/fields, subdirectory presence
- **Profiles** — `base`, `typescript`, `python`, `frontend`, `backend`, `monorepo-root`
- Each profile specifies which plugins, skills, agents, and templates to install
- Mono-repos get per-workspace installation with workspace-specific profiles

```bash
# Install into a mono-repo with backend/ and frontend/
node scripts/configure-claude.js /path/to/monorepo
```

## Agents

- **`@context-loader`** — Reads all spec state, git history, and produces a prioritized briefing for the session
- **`@doc-updater`** — Detects changed workspaces, fans out parallel sub-agents to update docs, then updates root tracking files

## Spec-driven Development

When installed with the `monorepo-root` profile, the installer creates:
- `.claude/specs/` — templates for requirements, design, and tasks
- `SPECLOG.md` — tracks spec status across the project
- `CHANGELOG.md` — keep-a-changelog format
- `docs/` — documentation folder at root and each workspace

## Changelog

- **1.5** — Mono-repo support + spec-driven development: profile-based installer, agents, templates, spec-aware hooks
- **1.4** — Added marketplace checks to `configure-claude.js`; manifest now includes `marketplaces` array
- **1.3** — Added `configure-claude.js` installer script + `config/global-settings.json` manifest
- **1.2** — Added `configure-claude` skill for installing configs into projects
- **1.1** — Added hooks system: hooks.json config, hook scripts, lib utilities
- **1.0** — Initial setup: repo structure, CLAUDE.md, README.md
