#!/usr/bin/env node

/**
 * configure-claude.js
 *
 * Installs Claude Code hooks, scripts, and config into a target project's .claude/ directory.
 * Also checks global ~/.claude/settings.json against the expected manifest.
 *
 * Usage: node configure-claude.js [target-directory]
 *   target-directory defaults to cwd
 */

const fs = require('fs');
const path = require('path');

const CONFIG_REPO = path.resolve(__dirname, '..');
const HOOKS_JSON = path.join(CONFIG_REPO, 'hooks', 'hooks.json');
const GLOBAL_MANIFEST = path.join(CONFIG_REPO, 'config', 'global-settings.json');
const SCRIPTS_HOOKS = path.join(CONFIG_REPO, 'scripts', 'hooks');
const SCRIPTS_LIB = path.join(CONFIG_REPO, 'scripts', 'lib');
const HOME_SETTINGS = path.join(require('os').homedir(), '.claude', 'settings.json');
const HOME_SETTINGS_LOCAL = path.join(require('os').homedir(), '.claude', 'settings.local.json');
const KNOWN_MARKETPLACES = path.join(require('os').homedir(), '.claude', 'plugins', 'known_marketplaces.json');

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function readJsonSync(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function resolveHookPaths(obj, claudeConfigDir) {
  const json = JSON.stringify(obj);
  return JSON.parse(json.replace(/\$\{CLAUDE_CONFIG_DIR\}/g, claudeConfigDir));
}

function main() {
  const targetDir = path.resolve(process.argv[2] || process.cwd());
  const claudeDir = path.join(targetDir, '.claude');
  const settingsPath = path.join(claudeDir, 'settings.json');

  console.log(`\nConfiguring Claude Code for: ${targetDir}\n`);

  // 1. Create .claude/ directory
  fs.mkdirSync(claudeDir, { recursive: true });
  console.log(`  ✓ Ensured ${claudeDir} exists`);

  // 2. Copy scripts/hooks/ and scripts/lib/
  const destHooks = path.join(claudeDir, 'scripts', 'hooks');
  const destLib = path.join(claudeDir, 'scripts', 'lib');

  copyDirSync(SCRIPTS_HOOKS, destHooks);
  console.log(`  ✓ Copied hook scripts → ${destHooks}`);

  copyDirSync(SCRIPTS_LIB, destLib);
  console.log(`  ✓ Copied lib scripts  → ${destLib}`);

  // 3. Read hooks.json from config repo
  const hooksConfig = readJsonSync(HOOKS_JSON);
  if (!hooksConfig) {
    console.error('  ✗ Could not read hooks.json from config repo');
    process.exit(1);
  }

  // 4. Resolve ${CLAUDE_CONFIG_DIR} to target's .claude path
  const resolvedHooks = resolveHookPaths(hooksConfig.hooks, claudeDir);

  // 5. Merge hooks into target settings.json
  const existingSettings = readJsonSync(settingsPath) || {};
  const merged = {
    ...existingSettings,
    $schema: hooksConfig.$schema || existingSettings.$schema,
    hooks: resolvedHooks,
  };

  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + '\n');
  console.log(`  ✓ Merged hooks into ${settingsPath}`);

  // Verify no unresolved placeholders remain
  const written = fs.readFileSync(settingsPath, 'utf8');
  if (written.includes('${CLAUDE_CONFIG_DIR}')) {
    console.error('  ✗ WARNING: Unresolved ${CLAUDE_CONFIG_DIR} found in settings.json');
  } else {
    console.log('  ✓ All hook paths resolved (no ${CLAUDE_CONFIG_DIR} remaining)');
  }

  // 6. Check global settings against manifest
  console.log('\n--- Global settings check ---\n');
  const manifest = readJsonSync(GLOBAL_MANIFEST);
  if (!manifest) {
    console.log('  ⚠ Could not read global manifest, skipping global check');
  } else {
    checkGlobalSettings(manifest);
  }

  console.log('\nDone!\n');
}

function checkGlobalSettings(manifest) {
  const globalSettings = readJsonSync(HOME_SETTINGS);
  const globalLocal = readJsonSync(HOME_SETTINGS_LOCAL);
  let allGood = true;

  // Check marketplaces (prerequisite for plugins)
  if (manifest.marketplaces) {
    const knownMarketplaces = readJsonSync(KNOWN_MARKETPLACES) || {};
    const knownNames = Object.keys(knownMarketplaces);
    for (const marketplace of manifest.marketplaces) {
      if (knownNames.includes(marketplace.name)) {
        console.log(`  ✓ Marketplace: ${marketplace.name}`);
      } else {
        console.log(`  ✗ Marketplace missing: ${marketplace.name}`);
        console.log(`    → Install via: /plugin marketplace add ${marketplace.repo}`);
        allGood = false;
      }
    }
  }

  // Check plugins
  if (manifest.plugins) {
    const enabledPlugins = globalSettings?.enabledPlugins || {};
    for (const plugin of manifest.plugins) {
      if (enabledPlugins[plugin]) {
        console.log(`  ✓ Plugin: ${plugin}`);
      } else {
        console.log(`  ✗ Plugin missing: ${plugin}`);
        console.log(`    → Enable via Claude Code settings or add to ~/.claude/settings.json`);
        allGood = false;
      }
    }
  }

  // Check MCP servers
  if (manifest.mcpServers) {
    const enabledMcp = globalLocal?.enabledMcpjsonServers || [];
    for (const server of manifest.mcpServers) {
      if (enabledMcp.includes(server)) {
        console.log(`  ✓ MCP server: ${server}`);
      } else {
        console.log(`  ✗ MCP server missing: ${server}`);
        console.log(`    → Add "${server}" to enabledMcpjsonServers in ~/.claude/settings.local.json`);
        allGood = false;
      }
    }
  }

  // Check statusLine
  if (manifest.statusLine) {
    const currentStatus = globalSettings?.statusLine;
    if (currentStatus && currentStatus.command === manifest.statusLine.command) {
      console.log(`  ✓ StatusLine: ${manifest.statusLine.command}`);
    } else {
      console.log(`  ✗ StatusLine not configured: ${manifest.statusLine.command}`);
      console.log(`    → Add statusLine config to ~/.claude/settings.json`);
      allGood = false;
    }
  }

  if (allGood) {
    console.log('\n  All global settings match the manifest.');
  }
}

main();
