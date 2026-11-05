import express from 'express';
import { createHash } from 'node:crypto';

const router = express.Router();
const FLAG = process.env.FLAG_ZK || 'ASTRA{zk_underconstrained_witness_2d66}';
const P = (1n << 127n) - 1n;
const G = 5n;
const H = 7n;
const AGE = 17n;
const AGE_COMMITMENT = pow(G, AGE);
const BITS = 8;

function mod(value) {
  const result = value % P;
  return result >= 0n ? result : result + P;
}

function scalar(value) {
  const order = P - 1n;
  const result = value % order;
  return result >= 0n ? result : result + order;
}

function pow(base, exponent) {
  let result = 1n;
  let factor = mod(base);
  let power = exponent;
  while (power > 0n) {
    if (power & 1n) result = mod(result * factor);
    factor = mod(factor * factor);
    power >>= 1n;
  }
  return result;
}

function inverse(value) {
  return pow(value, P - 2n);
}

function challenge(commitment, announcement) {
  const digest = createHash('sha256')
    .update(`${commitment.toString(16)}|${announcement.toString(16)}`)
    .digest('hex');
  return scalar(BigInt(`0x${digest}`));
}

function parseField(value) {
  if (typeof value !== 'string' || value.length > 128) return null;
  try {
    return mod(BigInt(value));
  } catch {
    return null;
  }
}

function parseScalar(value) {
  if (typeof value !== 'string' || value.length > 128) return null;
  try {
    return scalar(BigInt(value));
  } catch {
    return null;
  }
}

function verifySchnorr(commitment, proof) {
  if (!proof || typeof proof !== 'object') return false;
  const announcement = parseField(proof.announcement);
  const responseValue = parseScalar(proof.responseValue);
  const responseBlind = parseScalar(proof.responseBlind);
  if (announcement === null || responseValue === null || responseBlind === null) return false;
  const e = challenge(commitment, announcement);
  const left = mod(pow(G, responseValue) * pow(H, responseBlind));
  const right = mod(announcement * pow(commitment, e));
  return left === right;
}

router.get('/', (_req, res) => {
  res.json({
    service: 'astralane-zk-target',
    endpoint: '/arena/identity/zk/verify',
    circuit: 'age-check',
    ageCommitment: AGE_COMMITMENT.toString(16),
    bits: BITS,
    hint: 'The verifier proves knowledge of every commitment and checks the age relation, but it never constrains each witness bit to 0 or 1.',
  });
});

router.post('/verify', (req, res) => {
  const bitCommitments = Array.isArray(req.body?.bitCommitments) ? req.body.bitCommitments : [];
  const bitProofs = Array.isArray(req.body?.bitProofs) ? req.body.bitProofs : [];
  if (bitCommitments.length !== BITS || bitProofs.length !== BITS) {
    res.status(422).json({ error: `expected ${BITS} bit commitments and proofs` });
    return;
  }

  const commitments = [];
  for (const raw of bitCommitments) {
    const commitment = parseField(raw);
    if (commitment === null || commitment === 0n) {
      res.status(422).json({ error: 'invalid bit commitment' });
      return;
    }
    commitments.push(commitment);
  }

  for (let index = 0; index < BITS; index += 1) {
    if (!verifySchnorr(commitments[index], bitProofs[index])) {
      res.status(422).json({ error: `invalid opening proof for bit ${index}` });
      return;
    }
  }

  const left = mod(AGE_COMMITMENT * inverse(pow(G, 18n)));
  let right = 1n;
  for (let index = 0; index < BITS; index += 1) {
    right = mod(right * pow(commitments[index], 1n << BigInt(index)));
  }
  if (left !== right) {
    res.status(403).json({ error: 'age witness does not satisfy the public relation' });
    return;
  }

  res.json({ ok: true, accepted: true, circuit: 'age-check', flag: FLAG });
});

export default router;
