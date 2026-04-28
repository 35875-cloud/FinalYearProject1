const AUTH_KEYS = [
  'authToken',
  'userId',
  'userRole',
  'userName',
  'userBlockchainId',
  'userEmail',
  'authExpiresAt',
  'authRememberMe',
];

const DEFAULT_AUTH_TTL_MS = 24 * 60 * 60 * 1000;

const getStorage = (name) => {
  if (typeof window === 'undefined') return null;

  try {
    return window[name];
  } catch (_error) {
    return null;
  }
};

const decodeBase64Url = (value) => {
  if (!value || typeof window === 'undefined' || typeof window.atob !== 'function') {
    return '';
  }

  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return window.atob(padded);
  } catch (_error) {
    return '';
  }
};

const getJwtExpiry = (token) => {
  if (!token) return null;

  try {
    const [, payloadSegment] = String(token).split('.');
    const payload = JSON.parse(decodeBase64Url(payloadSegment));
    if (!payload?.exp) return null;
    return Number(payload.exp) * 1000;
  } catch (_error) {
    return null;
  }
};

const isExpired = (expiresAt) => {
  const numeric = Number(expiresAt);
  return Number.isFinite(numeric) && numeric > 0 && Date.now() >= numeric;
};

const readKey = (storage, key) => {
  if (!storage) return null;

  try {
    return storage.getItem(key);
  } catch (_error) {
    return null;
  }
};

const writeKey = (storage, key, value) => {
  if (!storage) return;

  try {
    if (value === undefined || value === null) {
      storage.removeItem(key);
      return;
    }

    storage.setItem(key, String(value));
  } catch (_error) {
    // Ignore storage write failures and let the app continue.
  }
};

const removeKey = (storage, key) => {
  if (!storage) return;

  try {
    storage.removeItem(key);
  } catch (_error) {
    // Ignore storage cleanup failures and let the app continue.
  }
};

export const clearAuthSession = () => {
  const sessionStorageRef = getStorage('sessionStorage');
  const localStorageRef = getStorage('localStorage');

  AUTH_KEYS.forEach((key) => {
    removeKey(sessionStorageRef, key);
    removeKey(localStorageRef, key);
  });
};

export const readAuthSession = () => {
  const sessionStorageRef = getStorage('sessionStorage');
  const localStorageRef = getStorage('localStorage');
  const session = {};

  AUTH_KEYS.forEach((key) => {
    const value = readKey(sessionStorageRef, key) ?? readKey(localStorageRef, key);
    if (value !== null && value !== undefined) {
      session[key] = value;
    }
  });

  return session;
};

export const persistAuthSession = (values = {}) => {
  const sessionStorageRef = getStorage('sessionStorage');
  const localStorageRef = getStorage('localStorage');
  const current = readAuthSession();
  const next = { ...current, ...values };
  const expiresAt =
    next.authExpiresAt ||
    next.expiresAt ||
    getJwtExpiry(next.authToken) ||
    Date.now() + DEFAULT_AUTH_TTL_MS;

  next.authExpiresAt = String(expiresAt);
  next.authRememberMe = String(Boolean(next.authRememberMe));

  AUTH_KEYS.forEach((key) => {
    writeKey(sessionStorageRef, key, next[key]);
    writeKey(localStorageRef, key, next[key]);
  });

  return next;
};

export const hydrateAuthSession = () => {
  const sessionStorageRef = getStorage('sessionStorage');
  const localStorageRef = getStorage('localStorage');

  if (!sessionStorageRef && !localStorageRef) {
    return {};
  }

  const expiresAt =
    readKey(sessionStorageRef, 'authExpiresAt') ??
    readKey(localStorageRef, 'authExpiresAt');

  if (isExpired(expiresAt)) {
    clearAuthSession();
    return {};
  }

  AUTH_KEYS.forEach((key) => {
    const sessionValue = readKey(sessionStorageRef, key);
    const localValue = readKey(localStorageRef, key);

    if ((sessionValue === null || sessionValue === undefined) && localValue !== null && localValue !== undefined) {
      writeKey(sessionStorageRef, key, localValue);
    } else if ((localValue === null || localValue === undefined) && sessionValue !== null && sessionValue !== undefined) {
      writeKey(localStorageRef, key, sessionValue);
    }
  });

  return readAuthSession();
};

export const getStoredAuthValue = (key) => {
  if (!AUTH_KEYS.includes(key)) return '';
  const session = hydrateAuthSession();
  return session[key] || '';
};
