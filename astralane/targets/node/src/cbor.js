const BREAK = Symbol('cbor-break');

function readLength(buffer, offset, additional) {
  if (additional < 24) return { value: additional, offset };
  if (additional === 24) {
    if (offset + 1 > buffer.length) throw new Error('truncated cbor length');
    return { value: buffer[offset], offset: offset + 1 };
  }
  if (additional === 25) {
    if (offset + 2 > buffer.length) throw new Error('truncated cbor length');
    return { value: buffer.readUInt16BE(offset), offset: offset + 2 };
  }
  if (additional === 26) {
    if (offset + 4 > buffer.length) throw new Error('truncated cbor length');
    return { value: buffer.readUInt32BE(offset), offset: offset + 4 };
  }
  if (additional === 27) {
    if (offset + 8 > buffer.length) throw new Error('truncated cbor length');
    const value = buffer.readBigUInt64BE(offset);
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('cbor length too large');
    return { value: Number(value), offset: offset + 8 };
  }
  if (additional === 31) return { value: null, offset };
  throw new Error('unsupported cbor additional information');
}

function decodeItem(buffer, offset, depth = 0) {
  if (depth > 64) throw new Error('cbor nesting too deep');
  if (offset >= buffer.length) throw new Error('truncated cbor item');

  const initial = buffer[offset];
  const major = initial >> 5;
  const additional = initial & 0x1f;
  const length = readLength(buffer, offset + 1, additional);
  let cursor = length.offset;

  if (major === 0) {
    return { value: length.value, offset: cursor };
  }
  if (major === 1) {
    return { value: -1 - length.value, offset: cursor };
  }
  if (major === 2 || major === 3) {
    const end = length.value === null ? buffer.length : cursor + length.value;
    if (end > buffer.length) throw new Error('truncated cbor string');
    const raw = buffer.subarray(cursor, end);
    cursor = end;
    return { value: major === 2 ? Buffer.from(raw) : raw.toString('utf8'), offset: cursor };
  }
  if (major === 4) {
    const values = [];
    if (length.value === null) {
      while (true) {
        if (cursor >= buffer.length) throw new Error('truncated indefinite array');
        if (buffer[cursor] === 0xff) return { value: values, offset: cursor + 1 };
        const item = decodeItem(buffer, cursor, depth + 1);
        values.push(item.value);
        cursor = item.offset;
      }
    }
    for (let i = 0; i < length.value; i += 1) {
      const item = decodeItem(buffer, cursor, depth + 1);
      values.push(item.value);
      cursor = item.offset;
    }
    return { value: values, offset: cursor };
  }
  if (major === 5) {
    const pairs = [];
    const value = {};
    const readPair = () => {
      const key = decodeItem(buffer, cursor, depth + 1);
      cursor = key.offset;
      const item = decodeItem(buffer, cursor, depth + 1);
      cursor = item.offset;
      pairs.push([key.value, item.value]);
      if (typeof key.value === 'string') value[key.value] = item.value;
    };
    if (length.value === null) {
      while (true) {
        if (cursor >= buffer.length) throw new Error('truncated indefinite map');
        if (buffer[cursor] === 0xff) return { value, offset: cursor + 1, pairs };
        readPair();
      }
    }
    for (let i = 0; i < length.value; i += 1) readPair();
    return { value, offset: cursor, pairs };
  }
  if (major === 6) {
    return decodeItem(buffer, cursor, depth + 1);
  }
  if (major === 7) {
    if (additional === 20) return { value: false, offset: cursor };
    if (additional === 21) return { value: true, offset: cursor };
    if (additional === 22) return { value: null, offset: cursor };
    if (additional === 23) return { value: undefined, offset: cursor };
    if (additional === 25) {
      if (cursor + 2 > buffer.length) throw new Error('truncated cbor float16');
      return { value: Number.NaN, offset: cursor + 2 };
    }
    if (additional === 26) {
      if (cursor + 4 > buffer.length) throw new Error('truncated cbor float32');
      return { value: buffer.readFloatBE(cursor), offset: cursor + 4 };
    }
    if (additional === 27) {
      if (cursor + 8 > buffer.length) throw new Error('truncated cbor float64');
      return { value: buffer.readDoubleBE(cursor), offset: cursor + 8 };
    }
    throw new Error('unsupported cbor simple value');
  }
  throw new Error('unsupported cbor major type');
}

export function decode(buffer) {
  return decodeItem(buffer, 0);
}

export function decodeMap(buffer) {
  const decoded = decode(buffer);
  const pairs = decoded.pairs || [];
  const first = new Map();
  const last = new Map();
  const counts = new Map();

  for (const [key, value] of pairs) {
    if (!first.has(key)) first.set(key, value);
    last.set(key, value);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return {
    pairs,
    first,
    last,
    counts,
    duplicateKeys: [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key),
  };
}

export { BREAK };
