// window.storage shim. The claude.ai artifact runtime provides an async
// key-value store at window.storage; on GitHub Pages we back the same API
// with localStorage so the demo file runs unchanged in both environments.
// get() resolves { key, value } with value null when absent — the demo's
// guards (r && r.value, JSON.parse fallbacks) already handle both shapes.
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) {
      let value = null;
      try { value = window.localStorage.getItem(key); } catch (e) {}
      return { key, value };
    },
    async set(key, value) {
      try { window.localStorage.setItem(key, String(value)); } catch (e) {}
      return { key, value: String(value) };
    },
    async delete(key) {
      try { window.localStorage.removeItem(key); } catch (e) {}
      return true;
    },
  };
}
