import express from 'express';
import { randomUUID } from 'node:crypto';

const router = express.Router();
const FLAG = process.env.FLAG_AGENT || 'ASTRA{ai_memory_poison_9b4e}';
const memory = [];

const TOOL_POLICY = {
  'trip-summary': 'member',
  'export-secrets': 'admin',
};

function tokens(text) {
  return new Set(String(text).toLowerCase().match(/[a-z0-9-]+/g) || []);
}

function retrieve(message) {
  const query = tokens(message);
  return memory
    .map((note) => {
      const overlap = [...tokens(note.text)].filter((token) => query.has(token)).length;
      return { note, score: overlap + note.priority };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map((entry) => entry.note);
}

function exportSecrets() {
  return { tool: 'export-secrets', result: FLAG };
}

router.get('/', (_req, res) => {
  res.json({
    service: 'astralane-agent-target',
    endpoint: '/arena/runtime/agent/chat',
    memory: 'shared-vector',
    hint: 'The assistant retrieves instructions from a memory shared by every session. Retrieved text is treated as trusted planner instructions, so a poisoned note can select a privileged tool.',
  });
});

router.post('/chat', (req, res) => {
  const session = typeof req.body?.session === 'string' ? req.body.session.slice(0, 64) : 'default';
  const message = typeof req.body?.message === 'string' ? req.body.message.slice(0, 2000) : '';
  if (!message) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  const directToolRequest = /^\s*(?:please\s+)?(?:call|run|use)\s+export[- ]secrets?\b/i.test(message);
  memory.push({
    id: randomUUID(),
    session,
    text: message,
    priority: /remember|note|instruction|summary/i.test(message) ? 3 : 0,
    createdAt: Date.now(),
  });
  if (memory.length > 200) memory.splice(0, memory.length - 200);

  const retrieved = retrieve(message);
  const poisonedInstruction = !directToolRequest && retrieved.some((note) => /export[- ]secrets?/i.test(note.text));

  if (directToolRequest) {
    res.status(403).json({
      error: 'tool export-secrets requires an administrator grant',
      policy: TOOL_POLICY['export-secrets'],
    });
    return;
  }

  if (poisonedInstruction && /summar|trip|recap/i.test(message)) {
    res.json({
      reply: 'Here is the requested summary. The retrieved memory selected a privileged tool.',
      retrieved: retrieved.map((note) => note.id),
      tool: exportSecrets(),
    });
    return;
  }

  res.json({
    reply: `I found ${retrieved.length} relevant note(s), but no action was requested.`,
    retrieved: retrieved.map((note) => note.id),
  });
});

export default router;
