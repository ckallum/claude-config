# configure-claude

Install all Claude Code configs from this repository into a project's `.claude/` directory.

## What it does

1. Copies `scripts/hooks/` and `scripts/lib/` into the target project's `.claude/scripts/`
2. Reads `hooks/hooks.json`, resolves `${CLAUDE_CONFIG_DIR}` paths, and merges the `hooks` key into the target's `.claude/settings.json` (preserving existing keys)
3. Checks `~/.claude/settings.json` against `config/global-settings.json` and warns about any missing plugins, MCP servers, or statusLine config

## Usage

Run `/configure-claude` from any project to install this config into that project.

## Instructions for Claude

When this skill is invoked:

1. Determine the target project directory. If the current working directory is this config repo (`/Users/callumke/Projects/claude`), ask the user which project to configure. Otherwise, use the current working directory.

2. Run the installer script:
   ```bash
   node /Users/callumke/Projects/claude/scripts/configure-claude.js <target-directory>
   ```

3. Review the output and report what was installed to the user, including any global settings warnings.
