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
  const safeDir = claudeConfigDir.replace(/\\/g, '\\\\');
  return JSON.parse(json.replace(/\$\{CLAUDE_CONFIG_DIR\}/g, () => safeDir));
}

function installCcstatuslineConfig(manifest) {
  const ccstatuslineDir = path.join(require('os').homedir(), '.config', 'ccstatusline');
  const ccstatuslinePath = path.join(ccstatuslineDir, 'settings.json');
  const existing = readJsonSync(ccstatuslinePath);

  if (existing) {
    const backupPath = ccstatuslinePath + '.bak';
    fs.copyFileSync(ccstatuslinePath, backupPath);
    console.log(`  ✓ Backed up existing config → ${backupPath}`);
  }

  fs.mkdirSync(ccstatuslineDir, { recursive: true });
  fs.writeFileSync(ccstatuslinePath, JSON.stringify(manifest.ccstatusline, null, 2) + '\n');
  console.log(`  ✓ Installed ccstatusline config (v${manifest.ccstatusline.version}) → ${ccstatuslinePath}`);
}

function main() {
  // Handle --install-ccstatusline flag
  if (process.argv.includes('--install-ccstatusline')) {
    const manifest = readJsonSync(GLOBAL_MANIFEST);
    if (!manifest?.ccstatusline) {
      console.error('  ✗ No ccstatusline config found in manifest');
      process.exit(1);
    }
    installCcstatuslineConfig(manifest);
    return;
  }

  const targetDir = path.resolve(process.argv.filter(a => !a.startsWith('--'))[2] || process.cwd());
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
  if (!hooksConfig.hooks) {
    console.error('  ✗ hooks.json is missing "hooks" key');
    process.exit(1);
  }
  const resolvedHooks = resolveHookPaths(hooksConfig.hooks, claudeDir);

  // 5. Merge hooks and plugins into target settings.json
  const existingSettings = readJsonSync(settingsPath) || {};
  const manifest = readJsonSync(GLOBAL_MANIFEST);
  const pluginsToEnable = {};
  if (manifest?.plugins) {
    for (const plugin of manifest.plugins) {
      pluginsToEnable[plugin] = true;
    }
  }
  const merged = {
    ...existingSettings,
    ...(hooksConfig.$schema ? { $schema: hooksConfig.$schema } : {}),
    hooks: resolvedHooks,
    enabledPlugins: { ...existingSettings.enabledPlugins, ...pluginsToEnable },
  };

  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + '\n');
  console.log(`  ✓ Merged hooks into ${settingsPath}`);
  if (manifest?.plugins) {
    console.log(`  ✓ Enabled ${manifest.plugins.length} plugins in project settings`);
  }

  // Verify no unresolved placeholders remain
  const written = fs.readFileSync(settingsPath, 'utf8');
  if (written.includes('${CLAUDE_CONFIG_DIR}')) {
    console.error('  ✗ WARNING: Unresolved ${CLAUDE_CONFIG_DIR} found in settings.json');
  } else {
    console.log('  ✓ All hook paths resolved (no ${CLAUDE_CONFIG_DIR} remaining)');
  }

  // 6. Check global settings against manifest
  console.log('\n--- Global settings check ---\n');
  if (!manifest) {
    console.log('  ⚠ Could not read global manifest, skipping global check');
  } else {
    checkGlobalSettings(manifest, settingsPath);
  }

  console.log('\nDone!\n');
}

function checkGlobalSettings(manifest, projectSettingsPath) {
  const globalSettings = readJsonSync(HOME_SETTINGS);
  const globalLocal = readJsonSync(HOME_SETTINGS_LOCAL);
  const projectSettings = readJsonSync(projectSettingsPath);
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

  // Check plugins (global or project-scoped)
  if (manifest.plugins) {
    const globalPlugins = globalSettings?.enabledPlugins;
    const projectPlugins = projectSettings?.enabledPlugins;
    if (!globalPlugins && !projectPlugins) {
      console.log(`  ⚠ No enabledPlugins found in global or project settings — skipping plugin check`);
    } else {
      for (const plugin of manifest.plugins) {
        if (globalPlugins?.[plugin]) {
          console.log(`  ✓ Plugin: ${plugin} (global)`);
        } else if (projectPlugins?.[plugin]) {
          console.log(`  ✓ Plugin: ${plugin} (project)`);
        } else {
          console.log(`  ✗ Plugin missing: ${plugin}`);
          console.log(`    → Enable via Claude Code settings or add to ~/.claude/settings.json`);
          allGood = false;
        }
      }
    }
  }

  // Check MCP servers
  if (manifest.mcpServers) {
    const rawMcp = globalLocal?.enabledMcpServers;
    const enabledMcp = Array.isArray(rawMcp)
      ? rawMcp
      : (rawMcp && typeof rawMcp === 'object')
        ? Object.keys(rawMcp).filter(k => rawMcp[k])
        : [];
    for (const server of manifest.mcpServers) {
      if (enabledMcp.includes(server)) {
        console.log(`  ✓ MCP server: ${server}`);
      } else {
        console.log(`  ✗ MCP server missing: ${server}`);
        console.log(`    → Add "${server}" to enabledMcpServers in ~/.claude/settings.local.json`);
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

  // Check ccstatusline config
  if (manifest.ccstatusline) {
    const ccstatuslinePath = path.join(require('os').homedir(), '.config', 'ccstatusline', 'settings.json');
    const currentConfig = readJsonSync(ccstatuslinePath);
    if (!currentConfig) {
      console.log(`  ✗ ccstatusline config missing: ${ccstatuslinePath}`);
      console.log(`    → Run with --install-ccstatusline to install`);
      allGood = false;
    } else if (currentConfig.version !== manifest.ccstatusline.version) {
      console.log(`  ✗ ccstatusline config version mismatch: v${currentConfig.version} (expected v${manifest.ccstatusline.version})`);
      console.log(`    → Run with --install-ccstatusline to update`);
      allGood = false;
    } else {
      console.log(`  ✓ ccstatusline config (v${currentConfig.version})`);
    }
  }

  if (allGood) {
    console.log('\n  All global settings match the manifest.');
  }
}

main();
