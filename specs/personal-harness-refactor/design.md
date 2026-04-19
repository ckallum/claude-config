# Design: Personal Harness Distribution Refactor

## Context

Calsuite is a personal dotfiles-style config harness. Its assets (hooks, skills, agents, configs) are installed into per-user target repos under `~/Projects/`. The current installer conflates three distinct distribution problems into one mechanism, which leaks machine-specific paths into committed files and silently overwrites downstream edits.

Downstream review (verity, PR #453) surfaced the critical symptom: committing `.claude/settings.json` populated by calsuite produces 24 occurrences of `/Users/callumke/Projects/verity/.claude/...` absolute paths, breaking every other collaborator's checkout and CI. Earlier in the same conversation we also confirmed that the `copyDirSync`-based skill distribution unconditionally clobbered local target edits on every `--sync`.

## Goals

1. **Nothing calsuite writes into a target repo's tracked files should break another collaborator's checkout.** Machine-specific state (absolute paths, symlinks to calsuite, any personal tooling) lives in gitignored paths only.
2. **Shared content (skills, agents, review checklists) can still be committed and team-visible** — but the installer must never silently overwrite a target's local edits to that content.
3. **First-time and upgrading targets both work.** Targets onboarded before any given protocol change must migrate without data loss and without a manual big-bang command.

## Non-goals

- LLM-mediated sync. Mechanical sync is the baseline; `/reconcile-targets` (agentic) is a separate follow-up skill.
- Profile curation for skills. Every non-internal skill flows to every target; invocation-time descriptions govern what Claude actually uses.
- Supporting calsuite being checked out at arbitrary paths. We require it on the user's machine, but the location is configurable via `$CALSUITE_DIR` (default `~/Projects/calsuite`).

## Architecture

Three distribution tiers, each sized to the portability requirement of the asset it carries.

```mermaid
flowchart LR
    subgraph SRC["calsuite/ (source of truth)"]
        direction TB
        S1["scripts/hooks/*.cjs<br/>scripts/lib/*.cjs"]
        S2["hooks/hooks.json<br/>(template w/ $CALSUITE_DIR)"]
        S3["skills/*<br/>agents/*<br/>review checklist, templates"]
        S4["config/*.json<br/>config/lint-configs/*<br/>templates/specs/"]
    end

    subgraph PERSONAL["target/.claude/settings.local.json (gitignored)"]
        P1["Hook wiring<br/>absolute paths via $CALSUITE_DIR"]
    end

    subgraph SHARED["target/.claude/* (committed, team-visible)"]
        T1["skills/<name>/SKILL.md<br/>agents/<name>.md<br/>(with _origin: calsuite@sha frontmatter)"]
        T2["config/guardian-rules.json<br/>config/agent-rules.json<br/>.eslintrc.json<br/>(copied, no-overwrite)"]
    end

    subgraph RUNTIME["$CALSUITE_DIR (user's local checkout)"]
        R1["scripts/hooks/ and scripts/lib/<br/>(invoked directly from calsuite — no symlinks)"]
    end

    S1 -.->|resolved at runtime<br/>from settings.local.json| R1
    S2 -->|installer<br/>$CALSUITE_DIR-templated| P1
    S3 -->|installer<br/>copy + _origin + skip-on-divergence| T1
    S4 -->|installer<br/>copy-no-overwrite| T2
```

**Key shift from current state:**

| Asset | Current | New |
|---|---|---|
| Hook scripts | Symlinked into `target/.claude/scripts/hooks/` (absolute filesystem symlinks) | Not copied or symlinked — hook commands in `settings.local.json` reference `$CALSUITE_DIR/scripts/hooks/*.cjs` directly. `.claude/scripts/` is no longer populated by the installer. |
| Hook wiring (JSON) | `resolveHookPaths()` pre-resolves `${CLAUDE_CONFIG_DIR}` to an absolute path, written into `settings.json` (committed) | Written to `settings.local.json` (gitignored) with `$CALSUITE_DIR` absolute paths. `resolveHookPaths` deleted. |
| Skills and agents | `copyDirSync`/`copyFileSync` → unconditional overwrite on every `--sync` | Copied with `_origin: calsuite@<sha>` frontmatter, safe-overwrite protocol (see below) |
| Parent-level symlinks | `syncParentAssets()` creates `~/Projects/.claude/skills/` and `agents/` — load-bearing for the (never-supported) parent-dir inheritance model | Removed. `syncParentAssets()` + `PARENT_CLAUDE_DIR` are deleted as dead code. |

## The `_origin` safe-overwrite protocol

Every calsuite-distributed skill / agent file carries a frontmatter marker stamped at install time:

```yaml
---
_origin: calsuite@a49a827
...
---
```

`a49a827` is calsuite's HEAD commit sha at the moment the file was written into the target.

On every `--sync`, the installer decides what to do with each dest file by running through this matrix:

| Dest file state | Action |
|---|---|
| Does not exist | Write calsuite's current content, stamp `_origin: calsuite@<current-sha>`. |
| Has `_origin: calsuite@<sha>`, content matches calsuite's content at `<sha>` | Safe to overwrite — stamp with `<current-sha>`. |
| Has `_origin: calsuite@<sha>`, content differs from calsuite's content at `<sha>` | User edited after install — skip. Log: `skills/ship/SKILL.md: user-modified, skipped. Use --reconcile to resolve.` |
| Has `_origin: <anything-else>` (e.g. `_origin: verity`) | User claimed ownership — never touch. |
| No `_origin` marker, content byte-identical to calsuite's **current** version | Pristine pre-protocol file — stamp `_origin: calsuite@<current-sha>` in place, no content change. Auto-migrates silently. |
| No `_origin` marker, content differs from calsuite's current | Pre-protocol edit **or** stale old version — can't tell which. Skip. Log prominently: `skills/ship/SKILL.md: no _origin marker and content diverges. Skipped. Run --reconcile skills/ship to resolve.` |

**Migration semantics** — the matrix auto-handles existing targets without a separate migration command:
- Targets onboarded after this lands get `_origin` from day one.
- Targets onboarded before this lands have no `_origin`. If they never diverged from what calsuite shipped, they fall into the fifth row (byte-identical → auto-stamp). If they did diverge or are stale, they fall into the sixth row (skip + flag).
- In either case: **no data loss**.

**Content-at-sha lookup** — calsuite is a git repo on the user's machine. To compare dest against calsuite's content at `<sha>`, the installer runs `git show <sha>:<path>` inside `$CALSUITE_DIR`. No separate manifest to maintain.

**Frontmatter-only diffs** — comparing dest content against calsuite content must exclude the `_origin` line itself (since calsuite's source never has `_origin` but dest always does once stamped). Simplest implementation: strip any `_origin:` line from both sides before diffing.

## The gitignore layer

The installer manages gitignore entries in every target repo (root + detected monorepo workspaces):

```
# calsuite (personal harness) — never commit
.claude/settings.local.json
```

That single line is sufficient **given** the architecture above — hook scripts are no longer placed under `.claude/scripts/`, so there's nothing else machine-specific to ignore.

Installer behavior:
- On install, read target's `.gitignore`. If the calsuite line is missing, append it under a `# calsuite (personal harness)` comment header.
- In monorepos, do the same in each detected workspace (`backend/.gitignore`, `frontend/.gitignore`, etc.).
- Never remove entries the user has added. Only additive.

## `$CALSUITE_DIR` resolution

The installer resolves calsuite's location in this order:
1. `$CALSUITE_DIR` env var, if set.
2. Default: `~/Projects/calsuite` (resolved via `os.homedir()`).
3. Fallback: `path.resolve(__dirname, '..')` (the installer is always inside calsuite).

The resolved value is written as a literal absolute path into target's `settings.local.json`. Users who keep calsuite elsewhere set `CALSUITE_DIR=/path/to/theirs` in their shell profile before running the installer.

Each collaborator runs the installer themselves — there is no expectation that `settings.local.json` is portable across developers.

## Key Decisions

| Decision | Options Considered | Choice | Rationale |
|----------|-------------------|--------|-----------|
| Where hook wiring lives | `settings.json` (committed) · `settings.local.json` (gitignored) · `~/.claude/settings.json` (user-global) | `settings.local.json` | Hooks are personal tooling but reference per-project `$CALSUITE_DIR` paths. User-global loses project scoping. Committed version breaks every collaborator. |
| Hook scripts distribution | Symlink into target's `.claude/scripts/` · Copy into target · Reference calsuite directly via `$CALSUITE_DIR` | Reference directly | Symlinks broke for non-Callum checkouts; copies added machine-state to the tracked tree. Direct reference keeps `.claude/scripts/` out of the picture entirely. |
| Skill/agent distribution | Inherit from `~/Projects/.claude/` (docs-confirmed broken) · Symlink per-target (edits leak upstream) · Copy with `_origin` (this) | Copy with `_origin` | User explicitly picked this in conversation. Preserves local divergence and doesn't require a load-bearing undocumented hierarchy. |
| Migration strategy | Big-bang `--migrate` command · Stamp-on-first-write with content-hash check (this) · Assume all pre-protocol files are managed | Stamp with content check | Auto-handles the common case (unchanged file → auto-stamp) without forcing users through a migration flow. Safely skips divergent files for explicit reconciliation. |
| Content comparison method | Stored hash manifest · `git show <sha>:path` (this) | `git show` | Calsuite is already a git repo; no manifest to maintain. Bounded I/O per file. |
| Keep `syncParentAssets()`? | Keep (dormant) · Delete | Delete | Dead code under the real hierarchy rules. Its symlinks at `~/Projects/.claude/` do nothing today and create stale state tomorrow. |
| Precedence of target `settings.json` | Touched by installer · Untouched (this) | Untouched | Team-shared settings are the team's to own. Calsuite has no business writing there. |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Target has a pre-protocol file that's been edited locally; installer sees divergence and skips. User doesn't notice the log line and the file stays stale. | Medium | Medium — user keeps running old skill behavior | Log divergences prominently at the top of `--sync` output (not just per-file). Include a `--reconcile <path>` helper that interactively prompts to keep local, adopt calsuite's version, or three-way merge. |
| `$CALSUITE_DIR` resolution depends on shell env; editor or CI run of Claude Code may not inherit it | Low | Low — hooks fail to fire | Default fallback (`~/Projects/calsuite`) covers the common case. Hook commands that fail gracefully (early-exit on missing file) keep the runtime robust. |
| Content comparison excludes `_origin:` line — if the line is malformed (e.g. hand-edited to break YAML) the parse step could fail and the file gets skipped incorrectly | Low | Low | Tolerant parse: if frontmatter is invalid YAML, treat as "no `_origin`" and fall into the migration path. |
| User adds a new skill directly in target's `.claude/skills/` without `_origin`; calsuite has a skill with the same name. First sync auto-migrates by filename match, clobbering the user's skill. | Low | High — silent data loss | Auto-stamp only when dest content is **byte-identical** to calsuite's current version. Different content → skip + flag. Filename collision alone does NOT trigger overwrite. |
| Monorepo workspace detection misses a workspace, so its gitignore doesn't get the calsuite line; a collaborator checks out and sees `settings.local.json` | Low | Medium — embarrassment, not data loss | Detection is already exercised by the existing per-workspace install flow. Regression test: `/tmp/test-monorepo` fixture with detectable backend/frontend dirs. |
| Stale `~/Projects/.claude/` dirs from the old `syncParentAssets()` model linger after this refactor ships | Certain | Low — cosmetic only | Call this out in the CHANGELOG migration note. Optionally add a `--prune-stale` flag for opt-in cleanup. |

## Dependencies

- Calsuite must be a reachable git repo on the user's machine (required for `git show <sha>:<path>` lookups).
- Target repos use `.claude/settings.local.json` as defined by Claude Code's native precedence — no custom patching of Claude Code.
- `$CALSUITE_DIR` (optional) in user's shell profile if calsuite lives outside `~/Projects/calsuite`.

## Out of scope / future work

- `/reconcile-targets` agentic skill — on-demand LLM-mediated review of flagged divergences, upstream/cross-port decisions, PR opening. Second-layer on top of this mechanical sync.
- `--prune-stale` flag — opt-in cleanup of orphaned dirs/files left over from prior distribution models (old `.claude/skills/`, old `~/Projects/.claude/*`).
- `--reconcile <path>` interactive helper for individual file divergences.
- Hash manifest vs. `git show` — revisit if `git show` performance becomes a bottleneck with many targets.
