import express from 'express';
import wabtFactory from 'wabt';

const PORT = Number(process.env.PORT || 8090);
const FLAG = process.env.FLAG_WASI || 'ASTRA{wasi_fd_confusion_6a07}';
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'astralane-wasi-target' });
});

app.get('/', (_req, res) => {
  res.json({
    service: 'astralane-wasi-target',
    endpoint: '/arena/wasi/run',
    hint: 'The host blocks fd 0 but truncates the guest fd to 16 bits before lookup. A preopened host-root descriptor is reachable above the guest fd range.',
  });
});

app.post('/run', async (req, res) => {
  const wat = typeof req.body?.wat === 'string' ? req.body.wat : '';
  if (!wat || wat.length > 65536) {
    res.status(400).json({ error: 'wat is required and must be at most 64 KiB' });
    return;
  }

  let wasm;
  try {
    const wabt = await wabtFactory();
    const module = wabt.parseWat('guest.wat', wat);
    wasm = module.toBinary({}).buffer;
  } catch {
    res.status(422).json({ error: 'guest module is not valid WebAssembly text' });
    return;
  }

  let instance;
  const importedMemory = new WebAssembly.Memory({ initial: 1, maximum: 16 });
  const currentMemory = () => instance?.exports?.memory || importedMemory;
  const fdTable = new Map([
    [0, { kind: 'host-root', data: Buffer.from(FLAG, 'utf8') }],
    [1, { kind: 'stdout' }],
    [2, { kind: 'stderr' }],
    [3, { kind: 'guest', data: Buffer.alloc(0) }],
  ]);
  let stdout = '';
  let stderr = '';

  const view = () => new DataView(currentMemory().buffer);

  function descriptor(rawFd) {
    const fd = rawFd >>> 0;
    if (fd === 0) return null;
    return fdTable.get(fd & 0xffff) || null;
  }

  function readString(pointer, length) {
    const buffer = currentMemory().buffer;
    if (pointer < 0 || length < 0 || pointer + length > buffer.byteLength) return null;
    return Buffer.from(buffer, pointer, length);
  }

  function writeString(pointer, data) {
    const buffer = currentMemory().buffer;
    if (pointer < 0 || pointer + data.length > buffer.byteLength) return 21;
    Buffer.from(buffer, pointer, data.length).set(data);
    return 0;
  }

  const imports = {
    env: { memory: importedMemory },
    wasi_snapshot_preview1: {
      fd_read(rawFd, iovsPointer, iovsLength, nreadPointer) {
        const entry = descriptor(rawFd);
        if (!entry || entry.kind !== 'host-root') return 8;
        if (iovsLength < 1) return 28;
        const dataView = view();
        const bufferPointer = dataView.getUint32(iovsPointer, true);
        const bufferLength = dataView.getUint32(iovsPointer + 4, true);
        const bytes = entry.data.subarray(0, bufferLength);
        const errno = writeString(bufferPointer, bytes);
        if (errno !== 0) return errno;
        dataView.setUint32(nreadPointer, bytes.length, true);
        return 0;
      },
      fd_write(rawFd, iovsPointer, iovsLength, nwrittenPointer) {
        const entry = descriptor(rawFd);
        if (!entry || (entry.kind !== 'stdout' && entry.kind !== 'stderr')) return 8;
        const dataView = view();
        const chunks = [];
        let total = 0;
        for (let index = 0; index < iovsLength; index += 1) {
          const base = iovsPointer + index * 8;
          const pointer = dataView.getUint32(base, true);
          const length = dataView.getUint32(base + 4, true);
          const chunk = readString(pointer, length);
          if (!chunk) return 21;
          chunks.push(chunk);
          total += chunk.length;
        }
        const output = Buffer.concat(chunks).toString('utf8');
        if (entry.kind === 'stdout') stdout += output;
        else stderr += output;
        dataView.setUint32(nwrittenPointer, total, true);
        return 0;
      },
    },
  };

  try {
    ({ instance } = await WebAssembly.instantiate(wasm, imports));
    if (typeof instance.exports._start !== 'function') {
      res.status(422).json({ error: 'guest must export _start' });
      return;
    }
    instance.exports._start();
    const leaked = stdout.includes(FLAG);
    res.json({
      ok: true,
      stdout,
      stderr,
      ...(leaked ? { flag: FLAG } : {}),
    });
  } catch (error) {
    res.status(422).json({ error: 'guest trapped', detail: String(error?.message || error) });
  }
});

app.use((error, _req, res, _next) => {
  console.error('[wasi]', error);
  res.status(500).json({ error: 'wasi target fault' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`astralane wasi target listening on ${PORT}`);
});
