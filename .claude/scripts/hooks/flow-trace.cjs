#!/usr/bin/env node
/**
 * Flow Trace — PreToolUse hook
 *
 * Captures Skill and Agent tool invocations as JSONL trace entries.
 * Used by /flow to generate Mermaid diagrams of the development workflow.
 *
 * Writes to: .claude/flow-trace-{CLAUDE_SESSION_ID}.jsonl (project-local)
 * Each entry: {"ts":"ISO","type":"skill|agent","name":"...","seq":N}
 *
 * Fail-open: any error exits 0 so it never blocks the user.
 * Target: < 50ms added latency.
 */

const fs = require('fs');
const path = require('path');

async function main() {
  // Read stdin JSON
  let data = '';
  await new Promise((resolve) => {
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', resolve);
    // Timeout safety — don't hang if stdin never closes
    setTimeout(resolve, 200);
  });

  if (!data.trim()) {
    process.exit(0);
  }

  const input = JSON.parse(data);
  const tool = input.tool_name || input.tool;
  const toolInput = input.tool_input || {};

  let entry;

  if (tool === 'Skill') {
    entry = {
      ts: new Date().toISOString(),
      type: 'skill',
      name: toolInput.skill || 'unknown',
      args: toolInput.args || null
    };
  } else if (tool === 'Agent') {
    entry = {
      ts: new Date().toISOString(),
      type: 'agent',
      name: toolInput.subagent_type || toolInput.description || 'unknown',
      description: toolInput.description || null
    };
  } else {
    // Not a tool we track
    process.exit(0);
  }

  const sessionId = process.env.CLAUDE_SESSION_ID || 'unknown';
  const traceFile = path.join(
    process.cwd(),
    '.claude',
    `flow-trace-${sessionId}.jsonl`
  );

  // Calculate seq from existing lines
  let seq = 1;
  try {
    const existing = fs.readFileSync(traceFile, 'utf8');
    seq = existing.trim().split('\n').filter(Boolean).length + 1;
  } catch (_) {
    // File doesn't exist yet — seq stays 1
  }

  entry.seq = seq;

  // Ensure .claude dir exists (it should, but be safe)
  fs.mkdirSync(path.dirname(traceFile), { recursive: true });
  fs.appendFileSync(traceFile, JSON.stringify(entry) + '\n');

  process.exit(0);
}

main().catch(() => process.exit(0));
