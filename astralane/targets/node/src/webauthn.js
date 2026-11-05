import express from 'express';
import { decodeMap } from './cbor.js';

const router = express.Router();
const FLAG = process.env.FLAG_WEBAUTHN || 'ASTRA{webauthn_cbor_duplicate_7b22}';
const ADMIN_CREDENTIAL_ID = 'admin-credential-9f3c';

function decodeEnvelope(value) {
  if (typeof value !== 'string' || value.length === 0) throw new Error('attestationObject is required');
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const buffer = Buffer.from(normalized, 'base64');
  if (buffer.length === 0) throw new Error('attestationObject is empty');
  return decodeMap(buffer);
}

router.get('/', (_req, res) => {
  res.json({
    service: 'astralane-webauthn-target',
    registrationEndpoint: '/arena/identity/webauthn/register',
    body: { attestationObject: 'base64 or base64url CBOR map' },
    hint: 'The registration broker checks one map occurrence for policy and stores another occurrence for authorization.',
  });
});

router.post('/register', (req, res) => {
  let envelope;
  try {
    envelope = decodeEnvelope(req.body?.attestationObject);
  } catch (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  const firstId = envelope.first.get('credentialId');
  const lastId = envelope.last.get('credentialId');
  const firstClass = envelope.first.get('credentialClass');
  const lastClass = envelope.last.get('credentialClass');
  const duplicateCredential = envelope.duplicateKeys.includes('credentialId');
  const duplicateClass = envelope.duplicateKeys.includes('credentialClass');

  if (typeof lastId !== 'string' || lastId.length < 4) {
    res.status(400).json({ error: 'credentialId is required' });
    return;
  }

  if (!duplicateCredential && !duplicateClass && lastId === ADMIN_CREDENTIAL_ID) {
    res.status(403).json({ error: 'that credential is reserved by the operator' });
    return;
  }

  const policyId = typeof firstId === 'string' ? firstId : lastId;
  const policyClass = typeof firstClass === 'string' ? firstClass : lastClass || 'member';
  if (policyId === ADMIN_CREDENTIAL_ID || policyClass === 'administrator') {
    res.status(403).json({ error: 'that credential is reserved by the operator' });
    return;
  }

  const effectiveId = lastId;
  const effectiveClass = typeof lastClass === 'string' ? lastClass : 'member';
  const escalated = effectiveId === ADMIN_CREDENTIAL_ID || effectiveClass === 'administrator';

  res.json({
    ok: true,
    credentialId: effectiveId,
    credentialClass: effectiveClass,
    duplicateKeys: envelope.duplicateKeys,
    ...(escalated ? { flag: FLAG } : {}),
  });
});

export { ADMIN_CREDENTIAL_ID };
export default router;
