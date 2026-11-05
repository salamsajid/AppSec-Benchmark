import Redis from 'ioredis';
import { config } from './config.js';
import { sleep } from './util.js';

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
});

let readyPromise;

export function waitForRedis() {
  if (!readyPromise) {
    readyPromise = (async () => {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        if (redis.status === 'ready') return;
        try {
          await redis.ping();
          return;
        } catch {
          await sleep(1000);
        }
      }
      throw new Error('redis did not become ready');
    })();
  }
  return readyPromise;
}

const seededWallets = [
  ['usr_ops', 5000],
  ['usr_nova', 5000],
  ['usr_kai', 9200],
  ['usr_mira', 12800],
];

export async function seedWallets() {
  await waitForRedis();
  for (const [userId, balance] of seededWallets) {
    await redis.hsetnx(`wallet:${userId}`, 'balance', String(balance));
  }
}

export async function walletBalance(userId) {
  const value = await redis.hget(`wallet:${userId}`, 'balance');
  return Number(value || 0);
}
