(() => {
  const BLUE = '#2589ff';

  // Any successful nearby-location choice (including "Use my location")
  // should immediately become a useful nearby search: 1 km + filters open on mobile.
  if (typeof setOrigin === 'function' && !window.__sgDiningLocationDefault1km) {
    window.__sgDiningLocationDefault1km = true;
    const baseSetOrigin = setOrigin;
    setOrigin = function (lat, lng, label) {
      const radius = document.getElementById('radiusFilter');
      if (radius) radius.value = '1';
      const result = baseSetOrigin(lat, lng, label);
      if (typeof openFilters === 'function') openFilters();
      return result;
    };
  }

  function decorateKrisplusPins() {
    if (typeof current !== 'function' || !Array.isArray(markers)) return;
    const mappedRows = current().filter(m => m.lat != null && m.lng != null);
    markers.forEach((marker, index) => {
      const merchant = mappedRows[index];
      if (!merchant?.krisplus) return;
      const el = marker.getElement?.();
      const core = el?.querySelector('.benefit-pin-core');
      if (!core) return;

      // A plain "+" meant "multiple/other" before Kris+ existed. For Kris+
      // outlets, make the programme explicit instead of showing an ambiguous +.
      if (core.textContent.trim() === '+') {
        core.textContent = 'K+';
        core.style.background = BLUE;
        core.style.color = '#fff';
        core.style.borderColor = '#8ec5ff';
        core.classList.remove('multi-core');
        core.classList.add('single-core', 'krisplus-core');
      }
    });
  }

  if (typeof render === 'function' && !window.__sgDiningKrisplusPinFix) {
    window.__sgDiningKrisplusPinFix = true;
    const baseRender = render;
    render = function (...args) {
      const result = baseRender(...args);
      requestAnimationFrame(decorateKrisplusPins);
      return result;
    };
    requestAnimationFrame(decorateKrisplusPins);
  }
})();
