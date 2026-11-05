'use strict';

const config = require('./config');

function presentUser(user) {
  if (!user) return null;
  const wallet = Number(user.wallet || 0);
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerified: user.email_verified,
    phone: user.phone,
    wallet,
    preferences: user.preferences || {},
    joinedAt: user.created_at,
    avatarPreview: user.avatar_preview || null,
    vault: user.vault || null,
  };
  if (wallet >= 10000) {
    payload.perkVault = config.flags.race;
  }
  return payload;
}

module.exports = { presentUser };
