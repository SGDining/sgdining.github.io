(() => {
  const normalize = value => String(value || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

  const canonical = value => normalize(value)
    .split(/\s+/)
    .filter(Boolean)
    .map(token => token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token)
    .join(' ');

  function topQueryLooksLikeActiveLocation() {
    if (typeof originPos === 'undefined' || !originPos) return false;
    const search = document.getElementById('searchBox');
    const place = document.getElementById('placeInput');
    if (!search) return false;

    const query = canonical(search.value);
    const placeValue = canonical(place?.value || '');
    const activeLabel = canonical(typeof originLabel !== 'undefined' ? originLabel : '');
    if (!query) return false;
    if (query === placeValue || query === activeLabel) return true;

    const target = `${placeValue} ${activeLabel}`.trim();
    const tokens = query.split(/\s+/).filter(Boolean);
    return tokens.length >= 2 && tokens.every(token => target.includes(token));
  }

  function rerunActiveLocationSearch(fit = true) {
    if (!topQueryLooksLikeActiveLocation()) return false;

    const search = document.getElementById('searchBox');
    const radius = document.getElementById('radiusFilter');
    const state = document.getElementById('placeState');
    if (radius && Number(radius.value || 0) <= 0) radius.value = '1';

    const activeRadius = Number(radius?.value || 1);
    if (state) {
      state.textContent = `Distance origin: ${typeof originLabel !== 'undefined' && originLabel ? originLabel : (document.getElementById('placeInput')?.value || 'selected location')} · ${activeRadius} km radius`;
    }

    // A location typed in the main box must never be reapplied as a merchant-name
    // filter when programme selections change or Find is pressed again.
    const savedQuery = search?.value || '';
    if (search) search.value = '';
    try {
      render(fit);
    } finally {
      if (search) search.value = savedQuery;
    }
    return true;
  }

  // Capture at window level so a repeat Find on an already-resolved location is
  // handled before the older merchant-search click handlers run.
  window.addEventListener('click', event => {
    if (!event.target?.closest?.('#findBtn')) return;
    if (!topQueryLooksLikeActiveLocation()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    rerunActiveLocationSearch(true);
  }, true);

  window.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.target?.id !== 'searchBox') return;
    if (!topQueryLooksLikeActiveLocation()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    rerunActiveLocationSearch(true);
  }, true);

  // Programme changes should immediately refresh the active nearby search.
  // This also covers Select all / Clear all / Lifestyle Credit stacking because
  // benefits-ui.js synchronizes every such action through benefitFilter.
  document.getElementById('benefitFilter')?.addEventListener('change', () => {
    setTimeout(() => rerunActiveLocationSearch(true), 0);
  });

  window.SGDiningRerunActiveLocationSearch = rerunActiveLocationSearch;
})();
