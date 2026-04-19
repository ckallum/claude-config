# Changelog

All notable changes to this repository.

Current version: **2.5**

## [2.5] — 2026-04-19

### Added
- `scripts/lib/pr-body-parser.cjs` — utility for splitting/reassembling PR bodies on level-2 (`##`) headers. Used by `/receiving-pr-feedback` to regenerate dynamic sections across feedback rounds.
- `/receiving-pr-feedback` Step 4.5 — update PR description after fixes land. Regenerates Summary / Important Files / Test Results / Development Flow, preserves static sections (How It Works / Pre-Landing Review / Doc Completeness), and appends a Revision History entry per round.
- `/ship` Step 7.5 — generate a Mermaid `flowchart TD` Development Flow diagram from `.claude/flow-trace-${CLAUDE_SESSION_ID}.jsonl` (same rules as `/flow`). Skipped silently when no trace exists.
- `/review` checklist — three additional checks: lifecycle state-variable resets on deactivation, completeness grep for mechanical "all X converted" refactors, and tests for changed return types or error contracts.

### Changed
- `skills/ship/pr-template.md` — documented as the shared template for `/ship`, `/execute`, `/receiving-pr-feedback`, and parallel agents. Adds a `## Revision History` placeholder (omitted on initial PR, appended by `/receiving-pr-feedback`) and tightens the Development Flow copy.
- `/ship` Step 8 — inserts `## Development Flow` between How It Works and Important Files when trace data exists.

## [2.4] — 2026-04-16

### Added
- `--sync` flag — re-runs installer against all repos listed in `config/targets.json`
- `--copy` flag — falls back to file copying instead of symlinks (for portability)
- `config/targets.json` — manifest of target repos for `--sync`
- Git post-commit hook — auto-syncs to targets when hooks/skills/agents/scripts/config change
- `syncParentAssets()` — symlinks shared skills and agents into `~/Projects/.claude/` for hierarchy-based inheritance
- `mergeHooks()` — origin-aware hook merge that preserves project-specific hooks across re-installs

### Changed
- Hook scripts now symlinked instead of copied — changes in calsuite propagate instantly
- Lib scripts now symlinked instead of copied
- `hooks.json` entries tagged with `"_origin": "calsuite"` to enable merge-aware installs
- `installForProfile()` accepts `opts.copy` to control symlink vs copy behavior

## [2.3] — 2026-04-15

### Added
- `/learn` skill — manage cross-session learnings (patterns, pitfalls, preferences). Review, search, prune, export. Stored at `.context/learnings/` per project.
- CLAUDE.md "Routing" section — intent → file pointer table so sessions don't re-read the whole file.
- CLAUDE.md "Codify on repeat" rule — propose a skill the second time a request shape repeats.
- `/retro` Step 14 — reads `~/.claude/analytics/skill-usage.jsonl` and surfaces skills used heavily / abandoned / never used.
- `/retro` Step 15 — learning loop: for each "Improve" item, propose a concrete rule update to the responsible skill file.

### Changed
- CLAUDE.md slimmed to a routing document; full changelog moved here.

## [2.2]

Flow trace and ship sweep-fix: `flow-trace.cjs` PreToolUse hook captures Skill/Agent invocations to per-session JSONL, `/flow` skill generates Mermaid workflow diagrams, `/ship` embeds Development Flow in PR body, `/ship` Step 8 now triages swept issues and fixes minor items inline before PR creation.

## [2.1]

Lint-directed agents: ESLint config auto-install, `agent-rules.json` structural lint rules, `lint-gate.js` pre-commit hook, `eslint-check.js` post-edit hook, `/lint-rule-gen` skill, Guardian architectural boundary rules (cross-layer imports, test colocation, file placement).

## [2.0]

Consolidated skills: `/plan` (interview + brainstorm + review), `/plan-ceo` (founder-mode plan review), `/ship` (automated test + review + PR pipeline), `/retro` (weekly engineering retrospective with trend tracking).

## [1.9]

Pre-commit review gate: `review-gate.js` hook + `@code-reviewer` agent for convention-aware code reviews before commits.

## [1.8]

Guardian autonomous approval system: smart PreToolUse hook with configurable deny/warn rules, audit logging, and mode-based permissions.

## [1.7]

Context7 MCP server and `/context7` skill for current library documentation lookup.

## [1.6]

`@browser` agent (agent-browser CLI), Excalidraw MCP integration for `@doc-updater` diagrams, MCP auto-installation in configure script, monorepo workspace plugin check fix.

## [1.5]

Mono-repo support + spec-driven development: profile-based installer (`config/profiles.json`), spec/doc templates, `@context-loader` and `@doc-updater` agents, `/update-docs` skill, spec-aware session hooks.

## [1.4]

Added marketplace checks to `configure-claude.js`; manifest now includes `marketplaces` array.

## [1.3]

Added `configure-claude.js` installer script, `config/global-settings.json` manifest; skill now invokes the script directly.

## [1.2]

Added `configure-claude` skill: installs hooks and scripts into any project's `.claude/` directory.

## [1.1]

Added hooks system: hooks.json config, 6 hook scripts (session lifecycle, console.log checks, compact suggestions), lib utilities (utils, package-manager, session-aliases, session-manager).

## [1.0]

Initial setup: repo structure, CLAUDE.md, README.md.
