# configure-claude

Install all Claude Code configs from this repository into the current project's `.claude/` directory.

## What it does

1. Copies `hooks/hooks.json` into the target project's `.claude/settings.json` (merging the hooks key if settings already exist)
2. Copies `scripts/hooks/` and `scripts/lib/` into the target project's `.claude/scripts/` directory
3. Rewrites `${CLAUDE_CONFIG_DIR}` references in hooks.json to use the actual installed path

## Usage

Run `/configure-claude` from any project to install this config into that project.

## Instructions for Claude

When this skill is invoked:

1. Determine the target project directory. If the current working directory is this config repo itself, ask the user which project to configure. Otherwise, use the current working directory.

2. Ensure the target has a `.claude/` directory (create if needed).

3. Copy the scripts:
   ```bash
   cp -r <config-repo>/scripts/hooks/ <target>/.claude/scripts/hooks/
   cp -r <config-repo>/scripts/lib/ <target>/.claude/scripts/lib/
   ```

4. Read the target's `.claude/settings.json` if it exists. Merge the `hooks` key from `<config-repo>/hooks/hooks.json` into it. If no settings.json exists, create one from hooks.json.

5. In the merged settings.json, replace all occurrences of `${CLAUDE_CONFIG_DIR}` with the actual path: `<target>/.claude` — so script references resolve correctly.

6. Report what was installed and any files that were overwritten.

**Important**: Do not overwrite existing non-hook keys in the target's settings.json. Only merge the `hooks` key.
