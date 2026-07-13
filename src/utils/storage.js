function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readText(key, fallback = "") {
  try {
    return getStorage()?.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeText(key, value) {
  try {
    const storage = getStorage();
    if (!storage) return false;

    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function readJSON(key, fallback, isValid = () => true) {
  try {
    const raw = getStorage()?.getItem(key);
    if (raw === null || raw === undefined) return fallback;

    const value = JSON.parse(raw);
    return isValid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    const storage = getStorage();
    if (!storage) return false;

    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
