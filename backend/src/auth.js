// Login helpers with no extra libraries: Node's built-in crypto only.
//  - passwords are stored as salted scrypt hashes (never the password itself)
//  - login tokens are signed with HMAC-SHA256 (a small JWT-style token) and expire after 7 days
const crypto = require('crypto');

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [scheme, saltHex, keyHex] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

const b64 = (input) => Buffer.from(input).toString('base64url');

function sign(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

function createToken(userId, secret, now = Date.now()) {
  const body = b64(JSON.stringify({ uid: userId, exp: Math.floor(now / 1000) + TOKEN_TTL_SECONDS }));
  return `${body}.${sign(body, secret)}`;
}

// Returns the user id, or null when the token is missing, forged or expired.
function readToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string') return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const good = Buffer.from(sign(body, secret));
  const given = Buffer.from(signature);
  if (good.length !== given.length || !crypto.timingSafeEqual(good, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!Number.isInteger(payload.uid) || payload.exp * 1000 < now) return null;
    return payload.uid;
  } catch (_) {
    return null;
  }
}

// Slows down password guessing: after `max` failed logins for the same
// username + address, further attempts are refused until `windowMs` has passed.
function createLoginLimiter({ max = 8, windowMs = 10 * 60 * 1000 } = {}) {
  const failures = new Map();
  const live = (key, now) => {
    const entry = failures.get(key);
    if (!entry || now - entry.first > windowMs) {
      failures.delete(key);
      return null;
    }
    return entry;
  };
  return {
    blocked(key, now = Date.now()) {
      const entry = live(key, now);
      return Boolean(entry && entry.count >= max);
    },
    fail(key, now = Date.now()) {
      const entry = live(key, now);
      if (entry) entry.count += 1;
      else failures.set(key, { count: 1, first: now });
    },
    reset(key) {
      failures.delete(key);
    },
  };
}

module.exports = { hashPassword, verifyPassword, createToken, readToken, createLoginLimiter, TOKEN_TTL_SECONDS };
