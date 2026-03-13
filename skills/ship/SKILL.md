---
name: ship
version: 1.0.0
description: |
  Fully automated ship workflow. Merges main, runs tests, does pre-landing review,
  splits bisectable commits, pushes, and creates PR. Also handles branch cleanup.
  Replaces: commit-push-pr, verification-before-completion, clean_gone.
argument-hint: [clean]
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Skill
  - Agent
  - AskUserQuestion
---

# Ship: Fully Automated Ship Workflow

You are running the `/ship` workflow. This is a **non-interactive, fully automated** workflow. Do NOT ask for confirmation at any step unless specified. The user said `/ship` which means DO IT.

## Arguments

- `/ship` — full ship workflow (default)
- `/ship clean` — clean up stale local branches marked as `[gone]` on remote, including worktrees

---

## Clean Mode

If `$ARGUMENTS` contains "clean":

1. Run `git fetch --prune` to update remote tracking info.
2. List branches marked as gone: `git branch -vv | grep ': gone]'`
3. For each gone branch:
   - Check if it has an associated worktree: `git worktree list`
   - If worktree exists, remove it: `git worktree remove <path> --force`
   - Delete the branch: `git branch -D <branch>`
4. Report what was cleaned up, then **STOP**.

---

## Ship Mode (default)

**Only stop for:**
- On `main` branch (abort)
- Merge conflicts that can't be auto-resolved (stop, show conflicts)
- Test failures (stop, show failures)
- Pre-landing review finds CRITICAL issues and user chooses to fix
- Anything that would lose work

**Never stop for:**
- Uncommitted changes (always include them)
- CHANGELOG content (auto-generate from diff)
- Commit message approval (auto-commit)

---

## Step 1: Pre-flight

1. Check the current branch. If on `main`, **abort**: "You're on main. Ship from a feature branch."

2. Run `git status` (never use `-uall`). Uncommitted changes are always included.

3. Run `git diff origin/main...HEAD --stat` and `git log origin/main..HEAD --oneline` to understand what's being shipped.

---

## Step 2: Merge origin/main (BEFORE tests)

Fetch and merge `origin/main` into the feature branch so tests run against the merged state:

```bash
git fetch origin main && git merge origin/main --no-edit
```

**If merge conflicts:** Try to auto-resolve simple ones (CHANGELOG ordering, lock files). If complex, **STOP** and show them.

**If already up to date:** Continue silently.

---

## Step 3: Run tests (on merged code) — PARALLEL AGENTS

Check `git diff origin/main --name-only` to determine which areas changed. Read CLAUDE.md and package.json to discover the project's test commands.

Dispatch **parallel sub-agents** for each applicable test suite using the Agent tool. Launch all agents in a **single message** (multiple Agent tool calls). Each agent should run the appropriate test command for the changed area and report pass/fail count and any failures.

Example agent prompts (adapt to the project's actual test commands):
```
prompt: "Run the test suite: <test-command>. Report pass/fail count and any failures."
description: "<area> tests"
```

Wait for all test agents to complete. Collect results.

**If any test fails:** Show the failures and **STOP**. Do not proceed.

**If all pass:** Continue — just note the counts briefly.

---

## Step 4: Pre-Landing Review + Simplify — PARALLEL AGENTS

After tests pass, dispatch **two parallel agents** in a single message:

**Agent A — Pre-landing review:**
```
prompt: "Run a pre-landing code review on the diff between origin/main and HEAD. Run `git diff origin/main` to get the full diff. Apply a two-pass review:

Pass 1 (CRITICAL): SQL/data safety, auth boundary violations, background job safety, XSS, file upload issues.
Pass 2 (INFORMATIONAL): Missing error handling, console.log/debug statements, ORM gotchas, framework gotchas, convention violations.

Output format: 'Pre-Landing Review: N issues (X critical, Y informational)' followed by findings with file:line references and suggested fixes. Categorize each as CRITICAL or INFORMATIONAL."
description: "Pre-landing review"
```

**Agent B — Code simplification:**
```
prompt: "Review all files changed between origin/main and HEAD (run `git diff origin/main --name-only` to find them). For each changed file, check for: code that could be reused from existing utilities, unnecessarily complex logic that could be simplified, redundant code, inconsistent patterns vs the rest of the codebase. Read CLAUDE.md conventions section first. Output a list of specific simplification suggestions with file:line references. If a suggestion is safe and obvious, apply the fix directly using Edit. Only apply fixes that preserve exact functionality."
description: "Simplify changed code"
```

Wait for both agents. Process results:

1. **Simplify agent results:** If it made edits, stage them. If it only suggested changes, apply the safe ones.

2. **Review agent results:** Parse findings into CRITICAL and INFORMATIONAL.

3. Apply the two-pass review logic:

**Pass 1 (CRITICAL):**
- SQL/Data safety: raw SQL interpolation, missing tenant scoping, TOCTOU races
- Auth boundary violations: missing auth checks, missing scope enforcement
- Background job safety: non-idempotent operations, missing error handling
- XSS: unescaped user content rendered as HTML
- File upload: missing MIME validation, path traversal

**Pass 2 (INFORMATIONAL):**
- Missing error handling in API routes
- `console.log` / debug statements left in code
- ORM gotchas relevant to the project's ORM
- Framework-specific gotchas (missing cleanup, missing deps arrays, etc.)
- Missing parallelization for independent operations
- Convention violations from CLAUDE.md

3. Output: `Pre-Landing Review: N issues (X critical, Y informational)`

4. **If CRITICAL issues found:** For EACH critical issue, use AskUserQuestion with the problem, recommended fix, and options:
   - A) Fix it now (recommended)
   - B) Acknowledge and ship anyway
   - C) False positive — skip

   If user chose A on any issue, apply fixes, commit them (`git add <fixed-files> && git commit -m "fix: apply pre-landing review fixes"`), then **re-run from Step 3** to verify fixes don't break tests.

5. **If only informational:** Output them and continue. Include in PR body.

6. **If no issues:** Output `Pre-Landing Review: No issues found.` and continue.

---

## Step 5: CHANGELOG (auto-generate)

1. Read `CHANGELOG.md` header to know the format. If no CHANGELOG.md exists, skip this step.

2. Auto-generate entries from **ALL commits on the branch**:
   - Use `git log origin/main..HEAD --oneline` for every commit being shipped
   - Use `git diff origin/main...HEAD` for the full diff
   - Categorize into: `### Added`, `### Changed`, `### Fixed`
   - Write concise, descriptive bullet points
   - Insert under `## [Unreleased]` section
   - Follow Keep a Changelog format

**Do NOT ask the user to describe changes.** Infer from the diff and commit history.

---

## Step 6: Commit (bisectable chunks)

**Goal:** Create small, logical commits that work well with `git bisect`.

1. Analyze the diff and group changes into logical commits. Each commit = one coherent change.

2. **Commit ordering** (earlier first):
   - **Schema/migrations:** new DB tables, schema changes
   - **Backend:** new config, services, background jobs (with their tests)
   - **API routes:** new/modified routes (with their tests)
   - **Frontend:** components, pages (with their tests)
   - **CHANGELOG:** always in the final commit

3. **Rules for splitting:**
   - A component and its test file go in the same commit
   - An API route and its test go in the same commit
   - Migrations are their own commit (or grouped with the schema they support)
   - If the total diff is small (< 50 lines across < 4 files), a single commit is fine

4. **Each commit must be independently valid** — no broken imports.

5. Commit messages: `<type>: <summary>` (type = feat/fix/chore/refactor/docs)
   Only the **final commit** gets the co-author trailer:

```bash
git commit -m "$(cat <<'EOF'
chore: update changelog

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Step 7: Push

Push to the remote with upstream tracking:

```bash
git push -u origin $(git branch --show-current)
```

---

## Step 8: Create PR

Create a pull request using `gh`:

```bash
gh pr create --title "<type>: <summary>" --body "$(cat <<'EOF'
## Summary
<bullet points from CHANGELOG>

## Pre-Landing Review
<findings from Step 4, or "No issues found.">

## Test plan
- [x] Tests pass (N tests)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Output the PR URL** — this should be the final output the user sees.

---

## Important Rules

- **Never skip tests.** If tests fail, stop.
- **Never skip the pre-landing review.** Run it every time.
- **Never force push.** Use regular `git push` only.
- **Never ask for confirmation** except for CRITICAL review findings.
- **Split commits for bisectability** — each commit = one logical change.
- **The goal is: user says `/ship`, next thing they see is the review + PR URL.**
