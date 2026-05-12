#!/usr/bin/env node
/**
 * Flow Trace Cleanup — SessionEnd hook
 *
 * Removes the per-session flow-trace JSONL file written by flow-trace.cjs.
 * Mirrors that writer's path computation exactly (same env vars, same
 * sanitization, same 'unknown' fallback) so cleanup covers every file the
 * writer can produce.
 *
 * Fail-open: any error exits 0 so it never blocks the session ending.
 */

const fs = require('fs');
const path = require('path');

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const sessionId = (process.env.CLAUDE_SESSION_ID || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
const traceFile = path.join(projectDir, '.claude', `flow-trace-${sessionId}.jsonl`);

try {
  fs.unlinkSync(traceFile);
} catch (err) {
  if (err.code !== 'ENOENT') {
    // Any other error is unexpected but non-fatal — surface to stderr so
    // it lands in Claude Code's hook log, then exit clean.
    process.stderr.write(`[flow-trace-cleanup] ${err.code || err.message}\n`);
  }
}
process.exit(0);
