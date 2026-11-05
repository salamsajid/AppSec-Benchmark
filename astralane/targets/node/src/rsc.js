import express from 'express';

const router = express.Router();
const FLAG = process.env.FLAG_RSC || 'ASTRA{rsc_flight_closure_4a8d}';

const actions = {
  publicSummary(callback) {
    return typeof callback === 'function' ? callback() : { summary: 'No itinerary details.' };
  },
  internalExport() {
    return { flag: FLAG };
  },
};

const PUBLIC_ROOTS = new Set(['publicSummary']);

function resolveFlight(flight) {
  if (!flight || typeof flight !== 'object' || typeof flight.root !== 'string') {
    throw new Error('flight root is required');
  }
  const nodes = flight.nodes;
  if (!nodes || typeof nodes !== 'object') throw new Error('flight nodes are required');

  const cache = new Map();
  const resolving = new Set();

  function resolve(reference) {
    if (typeof reference !== 'string' || !reference.startsWith('$')) {
      return reference;
    }
    if (cache.has(reference)) return cache.get(reference);
    if (resolving.has(reference)) {
      throw new Error(`unresolved reference cycle at ${reference}`);
    }
    const node = nodes[reference];
    if (!node || typeof node !== 'object') throw new Error(`unknown reference ${reference}`);

    resolving.add(reference);
    try {
      if (node.type === 'promise') {
        const value = resolve(node.value);
        cache.set(reference, value);
        return value;
      }
      if (node.type === 'function') {
        const action = actions[node.name];
        if (typeof action !== 'function') throw new Error(`unknown action ${node.name}`);
        const bound = Array.isArray(node.bound) ? node.bound : [];
        const closure = (...args) => action(...bound.map(resolve), ...args);
        cache.set(reference, closure);
        return closure;
      }
      throw new Error(`unknown node type ${node.type}`);
    } finally {
      resolving.delete(reference);
    }
  }

  const rootNode = nodes[flight.root];
  if (!rootNode || rootNode.type !== 'function' || !PUBLIC_ROOTS.has(rootNode.name)) {
    throw new Error('root is not a public server component');
  }
  const root = resolve(flight.root);
  return root();
}

router.get('/', (_req, res) => {
  res.json({
    service: 'astralane-rsc-target',
    endpoint: '/arena/browser/rsc',
    protocol: 'flight-like',
    hint: 'Bound server closures are resolved recursively. A reference cycle is cached before its bound arguments finish resolving, so a public component can be made to invoke an internal action.',
  });
});

router.post('/resolve', (req, res) => {
  try {
    const result = resolveFlight(req.body?.flight);
    res.json({ ok: true, result });
  } catch (error) {
    res.status(422).json({ error: String(error?.message || error) });
  }
});

export default router;
