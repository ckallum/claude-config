#!/usr/bin/env node

/**
 * Guardian — PreToolUse hook for semantic risk assessment.
 * Evaluates tool calls against configurable deny/warn rules.
 * Fail-open: if anything goes wrong, exits 0 (allows).
 */

const path = require('path');
const { readStdinJson, log, getClaudeDir, getSessionIdShort, ensureDir, appendFile, readFile, getDateString } = require('../lib/utils');

function loadRules() {
  // Check project-local config first, then fall back to co-located config/
  const projectConfig = path.join(process.cwd(), '.claude', 'config', 'guardian-rules.json');
  const repoConfig = path.resolve(__dirname, '..', '..', 'config', 'guardian-rules.json');

  const content = readFile(projectConfig) || readFile(repoConfig);
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function getMode(config) {
  return process.env.GUARDIAN_MODE || config.mode || 'supervised';
}

function matchRule(rule, tool, toolInput) {
  if (rule.tool !== tool) return false;

  // All match patterns must hit
  for (const [field, pattern] of Object.entries(rule.match)) {
    const value = toolInput[field] || '';
    try {
      if (!new RegExp(pattern, 'i').test(value)) return false;
    } catch (e) {
      process.stderr.write(`[Guardian] Bad regex in rule "${rule.id}" match.${field}: ${pattern} — ${e.message}\n`);
      return false; // bad regex → skip rule
    }
  }

  // No except pattern must hit
  if (rule.except) {
    for (const [field, pattern] of Object.entries(rule.except)) {
      const value = toolInput[field] || '';
      try {
        if (new RegExp(pattern, 'i').test(value)) return false;
      } catch (e) {
        process.stderr.write(`[Guardian] Bad regex in rule "${rule.id}" except.${field}: ${pattern} — ${e.message}\n`);
        // bad except regex → skip exception (rule still matches)
      }
    }
  }

  return true;
}

function getSummary(tool, toolInput) {
  if (tool === 'Bash') return toolInput.command || '';
  if (tool === 'Write' || tool === 'Edit' || tool === 'Read') return toolInput.file_path || '';
  return Object.values(toolInput).filter(v => typeof v === 'string').join(' ').slice(0, 120);
}

function auditLog(entry) {
  try {
    const logsDir = path.join(getClaudeDir(), 'guardian', 'logs');
    ensureDir(logsDir);
    const logFile = path.join(logsDir, `${getDateString()}.jsonl`);
    appendFile(logFile, JSON.stringify(entry) + '\n');
  } catch {
    // best-effort — never fail on audit logging
  }
}

async function main() {
  const input = await readStdinJson();
  const { tool, tool_input: toolInput } = input;
  if (!tool || !toolInput) process.exit(0);

  const config = loadRules();
  if (!config || !config.rules) process.exit(0);

  const mode = getMode(config);
  const session = getSessionIdShort();
  const summary = getSummary(tool, toolInput);

  const baseEntry = { ts: new Date().toISOString(), session, tool, summary, mode };

  // Check deny rules (first match wins)
  for (const rule of config.rules.deny || []) {
    if (matchRule(rule, tool, toolInput)) {
      auditLog({ ...baseEntry, decision: 'deny', rule_id: rule.id });
      log(`[Guardian] BLOCKED: ${rule.reason} (${rule.id})`);
      process.exit(1);
    }
  }

  // Check warn rules (first match wins)
  for (const rule of config.rules.warn || []) {
    if (matchRule(rule, tool, toolInput)) {
      auditLog({ ...baseEntry, decision: 'warn', rule_id: rule.id });
      log(`[Guardian] WARNING: ${rule.reason} (${rule.id})`);
      process.exit(0);
    }
  }

  // Allow — skip audit log unless GUARDIAN_LOG_LEVEL=all or sampled via GUARDIAN_LOG_ALLOW_N
  const logLevel = process.env.GUARDIAN_LOG_LEVEL || 'warn';
  const sampleN = Number(process.env.GUARDIAN_LOG_ALLOW_N) || 0;
  if (logLevel === 'all' || (sampleN > 0 && Math.random() < 1 / sampleN)) {
    auditLog({ ...baseEntry, decision: 'allow' });
  }
  process.exit(0);
}

main().catch(() => process.exit(0)); // fail-open
