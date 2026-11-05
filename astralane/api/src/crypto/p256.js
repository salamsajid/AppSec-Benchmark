import crypto from 'node:crypto';

const P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;
const A = P - 3n;
const N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
const G = {
  x: 0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296n,
  y: 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5n,
};

function mod(value, modulus = P) {
  const result = value % modulus;
  return result >= 0n ? result : result + modulus;
}

function invert(value, modulus = P) {
  let oldR = mod(value, modulus);
  let r = modulus;
  let oldS = 1n;
  let s = 0n;

  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }

  if (oldR !== 1n) throw new Error('inverse does not exist');
  return mod(oldS, modulus);
}

function pointDouble(point) {
  if (!point) return null;
  if (point.y === 0n) return null;

  const slope = mod((3n * point.x * point.x + A) * invert(2n * point.y));
  const x = mod(slope * slope - 2n * point.x);
  const y = mod(slope * (point.x - x) - point.y);
  return { x, y };
}

function pointAdd(left, right) {
  if (!left) return right;
  if (!right) return left;
  if (left.x === right.x && left.y !== right.y) return null;
  if (left.x === right.x && left.y === right.y) return pointDouble(left);

  const slope = mod((right.y - left.y) * invert(right.x - left.x));
  const x = mod(slope * slope - left.x - right.x);
  const y = mod(slope * (left.x - x) - left.y);
  return { x, y };
}

function pointMultiply(scalar, point) {
  let result = null;
  let addend = point;
  let k = scalar;

  while (k > 0n) {
    if (k & 1n) result = pointAdd(result, addend);
    addend = pointDouble(addend);
    k >>= 1n;
  }

  return result;
}

function toBytes32(value) {
  return Buffer.from(value.toString(16).padStart(64, '0'), 'hex');
}

function fromBytes(value) {
  return BigInt(`0x${Buffer.from(value).toString('hex')}`);
}

function encode(value) {
  return Buffer.from(value).toString('base64url');
}

export function generateKeyPair() {
  let d = 0n;
  while (d === 0n) {
    d = mod(fromBytes(crypto.randomBytes(32)), N);
  }

  const publicPoint = pointMultiply(d, G);
  const privateJwk = {
    kty: 'EC',
    crv: 'P-256',
    d: encode(toBytes32(d)),
    x: encode(toBytes32(publicPoint.x)),
    y: encode(toBytes32(publicPoint.y)),
  };
  const publicJwk = {
    kty: 'EC',
    crv: 'P-256',
    x: privateJwk.x,
    y: privateJwk.y,
  };

  return { d, privateJwk, publicJwk };
}

export function signEcdsa(message, privateJwk) {
  const d = fromBytes(Buffer.from(privateJwk.d, 'base64url'));
  const digest = crypto.createHash('sha256').update(message).digest();
  const z = fromBytes(digest);

  for (;;) {
    const k = fromBytes(crypto.randomBytes(31));
    if (k === 0n) continue;

    const point = pointMultiply(k, G);
    const r = mod(point.x, N);
    if (r === 0n) continue;

    const s = mod(invert(k, N) * (z + r * d), N);
    if (s === 0n) continue;

    return Buffer.concat([toBytes32(r), toBytes32(s)]).toString('base64url');
  }
}

export function verifyEcdsa(message, signature, publicJwk) {
  try {
    const key = crypto.createPublicKey({ key: publicJwk, format: 'jwk' });
    return crypto.verify(
      'sha256',
      Buffer.from(message),
      { key, dsaEncoding: 'ieee-p1363' },
      Buffer.from(signature, 'base64url'),
    );
  } catch {
    return false;
  }
}

export function publicKeyObject(publicJwk) {
  return crypto.createPublicKey({ key: publicJwk, format: 'jwk' });
}

export { N as CURVE_ORDER, P as CURVE_PRIME };
