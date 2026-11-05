import crypto from 'node:crypto';
import express from 'express';

const router = express.Router();
const FLAG = process.env.FLAG_DPOP || 'ASTRA{dpop_jkt_replay_4f01}';
const usedProofs = new Set();
const acceptedByJti = new Map();

function decodeSegment(segment) {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function publicJwk(jwk) {
  return {
    kty: jwk?.kty,
    crv: jwk?.crv,
    x: jwk?.x,
    y: jwk?.y,
  };
}

function verifyProof(proof) {
  if (typeof proof !== 'string') return { error: 'proof must be a compact JWS' };
  const parts = proof.split('.');
  if (parts.length !== 3) return { error: 'proof must have three segments' };

  const header = decodeSegment(parts[0]);
  const payload = decodeSegment(parts[1]);
  if (!header || !payload) return { error: 'malformed proof' };
  if (header.typ !== 'dpop+jwt' || header.alg !== 'ES256') return { error: 'unsupported proof header' };
  if (!header.jwk || header.jwk.kty !== 'EC' || header.jwk.crv !== 'P-256') return { error: 'invalid embedded key' };
  if (!payload.jti || typeof payload.jti !== 'string' || payload.jti.length < 8) return { error: 'invalid jti' };
  if (payload.htm !== 'POST') return { error: 'invalid htm' };
  if (!Number.isFinite(payload.iat) || Math.abs(Date.now() / 1000 - payload.iat) > 300) {
    return { error: 'proof expired' };
  }

  let pathname;
  try {
    pathname = new URL(String(payload.htu)).pathname;
  } catch {
    return { error: 'invalid htu' };
  }
  if (!pathname.endsWith('/identity/dpop/token')) return { error: 'invalid htu' };

  const signature = Buffer.from(parts[2], 'base64url');
  const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8');

  try {
    const key = crypto.createPublicKey({ key: publicJwk(header.jwk), format: 'jwk' });
    if (!crypto.verify('sha256', signingInput, { key, dsaEncoding: 'ieee-p1363' }, signature)) {
      return { error: 'invalid proof signature' };
    }
  } catch {
    return { error: 'invalid embedded key' };
  }

  const canonicalThumbprint = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      crv: header.jwk.crv,
      kty: header.jwk.kty,
      x: header.jwk.x,
      y: header.jwk.y,
    }))
    .digest('base64url');

  const insertionOrderThumbprint = crypto
    .createHash('sha256')
    .update(JSON.stringify(header.jwk))
    .digest('base64url');

  return {
    payload,
    canonicalThumbprint,
    jkt: insertionOrderThumbprint,
    proofKey: `${insertionOrderThumbprint}:${payload.jti}`,
  };
}

router.get('/', (_req, res) => {
  res.json({
    service: 'astralane-dpop-target',
    tokenEndpoint: '/arena/identity/dpop/token',
    proof: {
      header: { typ: 'dpop+jwt', alg: 'ES256', jwk: 'EC P-256 public JWK' },
      payload: { jti: 'unique proof id', htm: 'POST', htu: 'absolute token URL', iat: 'unix seconds' },
    },
    hint: 'The token endpoint binds replay state to the submitted JWK byte order instead of the RFC 7638 thumbprint.',
  });
});

router.post('/token', (req, res) => {
  const verified = verifyProof(req.body?.proof);
  if (verified.error) {
    res.status(401).json({ error: verified.error });
    return;
  }

  if (usedProofs.has(verified.proofKey)) {
    res.status(401).json({ error: 'proof replay' });
    return;
  }

  const prior = acceptedByJti.get(verified.payload.jti);
  let canonicalizationReplay = false;
  if (prior) {
    if (prior.canonicalThumbprint !== verified.canonicalThumbprint) {
      res.status(401).json({ error: 'jti already bound to another key' });
      return;
    }
    canonicalizationReplay = prior.jkt !== verified.jkt;
    if (canonicalizationReplay) prior.variants += 1;
  } else {
    acceptedByJti.set(verified.payload.jti, {
      canonicalThumbprint: verified.canonicalThumbprint,
      jkt: verified.jkt,
      variants: 1,
    });
  }

  usedProofs.add(verified.proofKey);

  const accessToken = crypto
    .createHash('sha256')
    .update(`${verified.canonicalThumbprint}:${verified.payload.jti}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`)
    .digest('base64url');

  res.json({
    access_token: accessToken,
    token_type: 'DPoP',
    jkt: verified.jkt,
    canonical_jkt: verified.canonicalThumbprint,
    expires_in: 300,
    ...(canonicalizationReplay ? { flag: FLAG } : {}),
  });
});

export default router;
