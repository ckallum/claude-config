---
name: plan
version: 1.0.0
description: |
  Consolidated engineering plan skill. Combines spec interview, brainstorming,
  and technical plan review into one workflow. Three modes: INTERVIEW (surface
  edge cases and write spec), BRAINSTORM (explore intent and design before
  implementation), REVIEW (lock in architecture, data flow, edge cases, tests).
argument-hint: [mode] [spec-path]
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
  - AskUserQuestion
---

# Engineering Plan

Consolidated planning skill. Start here before writing code.

## Mode Selection

Parse `$ARGUMENTS` for the mode. If not specified, use AskUserQuestion to ask:

1. **INTERVIEW** — You have a spec or feature idea and want to flesh it out. Deep multi-round interview to surface edge cases, tradeoffs, and non-obvious decisions. Writes the final spec.
2. **BRAINSTORM** — You have a vague idea and want to explore it. Explore user intent, requirements, and design options before committing to an approach.
3. **REVIEW** — You have a plan/spec ready and want to lock in the technical execution. Architecture, data flow, edge cases, test coverage, performance.

---

## INTERVIEW Mode

### Step 1: Find the spec
If a path is provided in `$ARGUMENTS`, use it. Otherwise, look for files in `.claude/specs/` or ask the user. Read the file thoroughly.

### Step 2: System context
Before interviewing, gather context:
```bash
git log --oneline -20                    # Recent history
git diff main --stat                     # In-flight changes
```
Read CLAUDE.md, SPECLOG.md, TODO.md, and any related spec files. Understand what already exists and what's planned.

### Step 3: Interview the user
Conduct a deep, multi-round interview using AskUserQuestion. The goal is to surface non-obvious decisions, edge cases, and tradeoffs.

Interview guidelines:
- **Do NOT ask obvious questions** that the spec already answers clearly.
- **Do ask about:** hidden complexity, conflicting requirements, unstated assumptions, failure modes, edge cases, scaling concerns, security implications, data model subtleties, UX micro-interactions, state management tradeoffs, migration paths, backwards compatibility, error handling strategy, and integration boundaries.
- **Be specific.** Reference concrete parts of the spec. Instead of "how should errors work?", ask "when this background job fails after processing 3 of 10 items, what should the user see?"
- **Go deep on answers.** Follow up on interesting responses. If the user says "we'll use a queue", ask about retry policy, idempotency, ordering guarantees, dead letter handling.
- **Cover multiple dimensions per round.** Use multi-question AskUserQuestion calls (up to 4 questions) to keep the interview moving.
- **Provide informed options.** When asking about tradeoffs, present concrete options with pros/cons.
- **Reference existing patterns.** Check what similar features in the codebase do and ask whether this should follow the same pattern or diverge.

### Step 4: Continue until complete
Keep interviewing across multiple rounds. A thorough interview typically needs 4-8 rounds. You are done when:
- All major architectural decisions are resolved
- Edge cases and error flows are addressed
- The user confirms they have nothing else to add

### Step 5: Write the final spec
Rewrite the spec file incorporating all decisions from the interview:
- Preserve the original structure and intent
- Integrate all interview answers as concrete decisions (not as Q&A)
- Add new sections for topics that emerged
- Follow the spec format: `requirements.md`, `design.md`, `tasks.md`
- Flag any remaining open questions

---

## BRAINSTORM Mode

### Step 1: Understand intent
Ask the user to describe what they want to build. Use AskUserQuestion to probe:
- What problem are you solving? For whom?
- What does success look like?
- What's the scope — quick fix or new capability?

### Step 2: Explore the design space
For each major design decision, present 2-3 concrete options with tradeoffs:
- Data model options
- UI/UX approaches
- API design patterns
- Where it fits in the existing architecture

Use the project's existing patterns as a baseline. Read relevant code to understand what conventions to follow.

### Step 3: Converge on an approach
After exploring options, synthesize into a concrete proposal:
- What we're building (1-2 sentences)
- Key design decisions and rationale
- What's in scope vs. deferred
- ASCII diagram of the architecture/data flow

### Step 4: Write the spec
Create spec files in `.claude/specs/<feature-name>/`:
- `requirements.md` — User stories, functional/non-functional requirements
- `design.md` — Architecture, data model, API design, key decisions
- `tasks.md` — Phased implementation tasks with checkboxes

Update SPECLOG.md with the new spec entry.

---

## REVIEW Mode

### Step 0: System Audit
Before reviewing anything, gather context:
```bash
git log --oneline -30
git diff main --stat
git stash list
```
Read CLAUDE.md, TODO.md, SPECLOG.md, and the spec being reviewed. Map:
* Current system state
* In-flight work (open PRs, branches)
* Existing pain points relevant to this plan
* Existing spec files in `.claude/specs/` that overlap

### Step 1: Scope Challenge
Before reviewing anything, answer:
1. **What existing code already partially or fully solves each sub-problem?** Can we reuse existing routes, components, services?
2. **What is the minimum set of changes that achieves the stated goal?** Flag any work that could be deferred.
3. **Complexity check:** If the plan touches more than 8 files or introduces more than 2 new services, challenge whether fewer moving parts could achieve the same goal.

Then ask if the user wants:
1. **SCOPE REDUCTION:** Propose a minimal version.
2. **BIG CHANGE:** Walk through interactively, one section at a time (Architecture -> Quality -> Tests -> Performance), max 8 issues per section.
3. **SMALL CHANGE:** Compressed review — Step 0 + one combined pass. Pick the single most important issue per section. One AskUserQuestion round at the end.

**Critical: If the user does not select SCOPE REDUCTION, respect that fully.** Your job becomes making the plan succeed. Raise scope concerns once — after that, commit.

### Section 1: Architecture Review
Evaluate:
* Overall system design — pages, API routes, backend services, DB schema, background jobs.
* Dependency graph and coupling concerns.
* Data flow patterns and potential bottlenecks.
* Multi-tenancy: every new table/query must scope appropriately.
* Security: auth boundaries, authorization checks, API surface.
* For each new codepath or integration, describe one realistic production failure and whether the plan accounts for it.
* ASCII diagrams for non-trivial flows.

**STOP.** AskUserQuestion individually per issue. Present options, recommend, explain WHY. Do NOT batch. Only proceed after ALL issues resolved.

### Section 2: Code Quality Review
Evaluate:
* Code organization — fits existing patterns in CLAUDE.md?
* DRY violations — be aggressive.
* Error handling patterns and missing edge cases.
* Over-engineering or under-engineering.
* Existing conventions from the codebase.

**STOP.** AskUserQuestion individually per issue.

### Section 3: Test Review
Diagram all new things this plan introduces:
```
  NEW UX FLOWS:        [list each]
  NEW API ROUTES:      [list each]
  NEW DATA FLOWS:      [list each]
  NEW BACKGROUND JOBS: [list each]
  NEW ERROR PATHS:     [list each]
```
For each: what test covers it?
For each new item: happy path test, failure path test, edge case test.

Test pyramid: many unit, fewer integration, few E2E?
Flakiness risk: tests depending on timing, external services, read-after-write?

**STOP.** AskUserQuestion individually per issue.

### Section 4: Performance Review
Evaluate:
* N+1 queries. Every new DB query in a loop: batch or join?
* Database indexes for new query patterns.
* Background job sizing: worst-case payload, runtime, retry behavior.
* Parallelization opportunities for independent operations.
* Caching opportunities.

**STOP.** AskUserQuestion individually per issue.

## CRITICAL RULE — How to ask questions
Every AskUserQuestion MUST: (1) present 2-3 concrete lettered options, (2) state which option you recommend FIRST, (3) explain in 1-2 sentences WHY. No batching multiple issues. No yes/no questions. Open-ended questions only when genuinely ambiguous.

**Lead with your recommendation.** "Do B. Here's why:" Be opinionated.
**Escape hatch:** If a section has no issues, say so and move on.

## Required Outputs (REVIEW mode)

### "NOT in scope" section
Work considered and explicitly deferred, with rationale.

### "What already exists" section
Existing code/flows that partially solve sub-problems.

### TODO.md updates
Each potential TODO as its own AskUserQuestion. For each: What, Why, Pros, Cons, Context, Depends on. Options: A) Add to TODO.md, B) Skip, C) Build it now.

### Diagrams
ASCII diagrams for any non-trivial data flow, state machine, or pipeline.

### Failure modes
For each new codepath: one realistic failure, whether a test covers it, whether error handling exists, whether the user would see a clear error or silent failure. Any failure with no test AND no error handling AND silent -> **critical gap**.

### Completion summary
```
  Step 0: Scope Challenge (user chose: ___)
  Architecture Review:  ___ issues found
  Code Quality Review:  ___ issues found
  Test Review:          diagram produced, ___ gaps
  Performance Review:   ___ issues found
  NOT in scope:         written
  What already exists:  written
  TODO.md updates:      ___ items proposed
  Failure modes:        ___ critical gaps
```
