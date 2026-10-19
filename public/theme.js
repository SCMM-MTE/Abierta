/* Shared SCMM theme preference; no server or account data is involved. */
(() => {
  const key = 'scmm.theme';
  const valid = value => ['system', 'light', 'dark'].includes(value);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';
  try { const saved = localStorage.getItem(key); if (valid(saved)) preference = saved; } catch { /* Storage may be disabled. */ }
  function apply() {
    const resolved = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.style.colorScheme = resolved;
    document.querySelectorAll('[data-scmm-theme]').forEach(select => { select.value = preference; });
  }
  function set(value) {
    if (!valid(value)) return;
    preference = value;
    try { if (value === 'system') localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* Keep the choice for this page. */ }
    apply();
  }
  apply();
  media.addEventListener('change', apply);
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) { preference = valid(event.newValue) ? event.newValue : 'system'; apply(); } });
  document.addEventListener('DOMContentLoaded', apply);
  document.addEventListener('change', event => { if (event.target.matches?.('[data-scmm-theme]')) set(event.target.value); });
})();
