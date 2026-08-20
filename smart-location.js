(() => {
  let searchActsAsOrigin = false;
  let resolving = false;

  const baseCurrent = current;
  current = function () {
    const search = $('searchBox');
    if (!searchActsAsOrigin || !search) return baseCurrent();
    const value = search.value;
    search.value = '';
    try {
      return baseCurrent();
    } finally {
      search.value = value;
    }
  };

  async function geocodeSingapore(query) {
    const search = /singapore/i.test(query) ? query : `${query}, Singapore`;
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=sg&q=${encodeURIComponent(search)}`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en-SG,en;q=0.9' } });
    if (!res.ok) throw new Error(`location lookup ${res.status}`);
    const rows = await res.json();
    if (!rows.length) return null;
    return {
      lat: Number(rows[0].lat),
      lng: Number(rows[0].lon),
      label: rows[0].display_name || query
    };
  }

  async function useQueryAsLocation(query, radius, defaultRadius = false) {
    if (resolving) return false;
    resolving = true;
    const placeState = $('placeState');
    if (placeState) placeState.textContent = `Finding “${query}”…`;
    try {
      const found = await geocodeSingapore(query);
      if (!found) return false;
      searchActsAsOrigin = true;
      const placeInput = $('placeInput');
      if (placeInput) placeInput.value = query;
      if (defaultRadius && Number($('radiusFilter')?.value || 0) <= 0) $('radiusFilter').value = '1';
      const activeRadius = Number($('radiusFilter')?.value || radius || 1);
      setOrigin(found.lat, found.lng, found.label);
      map.setView([found.lat, found.lng], activeRadius <= 1 ? 15 : activeRadius <= 2 ? 14 : 13);
      if (placeState) placeState.textContent = `Searching within ${activeRadius} km of ${query}`;
      return true;
    } catch (err) {
      if (placeState) placeState.textContent = `Could not use “${query}” as a location.`;
      return false;
    } finally {
      resolving = false;
    }
  }

  async function resolveSearch() {
    const query = $('searchBox')?.value.trim() || '';
    const radius = Number($('radiusFilter')?.value || 0);

    if (!query) {
      searchActsAsOrigin = false;
      if (radius > 0 && !originPos) useMyLocation();
      else render(true);
      return;
    }

    // With an explicit distance, the search term is always the centre point.
    if (radius > 0) {
      const ok = await useQueryAsLocation(query, radius, false);
      if (!ok) {
        $('radiusFilter').value = '0';
        searchActsAsOrigin = false;
        render(true);
      }
      return;
    }

    // Smart Find: try the query as a Singapore place first. If it resolves,
    // show nearby outlets using a sensible 1 km default. If it does not,
    // fall back to the normal merchant/address text search.
    const ok = await useQueryAsLocation(query, 1, true);
    if (!ok) {
      searchActsAsOrigin = false;
      render(true);
    }
  }

  async function resolveDistanceChange() {
    const radius = Number($('radiusFilter')?.value || 0);
    if (radius <= 0) {
      searchActsAsOrigin = false;
      updateOriginVisual();
      render(true);
      return;
    }

    const query = $('searchBox')?.value.trim() || $('placeInput')?.value.trim() || '';
    if (query) {
      const ok = await useQueryAsLocation(query, radius, false);
      if (!ok) {
        $('radiusFilter').value = '0';
        searchActsAsOrigin = false;
        render(true);
      }
      return;
    }

    searchActsAsOrigin = false;
    if (!originPos) useMyLocation();
    else {
      updateOriginVisual();
      render(true);
    }
  }

  // Do not live-filter while the user is typing. This prevents a place such
  // as "Suntec City" from temporarily shrinking the merchant set to addresses
  // that literally contain those words before Find/distance resolves it spatially.
  document.addEventListener('input', event => {
    if (event.target?.id !== 'searchBox') return;
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('click', event => {
    if (!event.target.closest('#findBtn')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    resolveSearch();
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.target?.id !== 'searchBox') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    resolveSearch();
  }, true);

  document.addEventListener('change', event => {
    if (event.target?.id !== 'radiusFilter') return;
    event.stopImmediatePropagation();
    resolveDistanceChange();
  }, true);

  const radius = $('radiusFilter');
  if (radius) radius.disabled = false;
  const state = $('placeState');
  if (state) state.textContent = 'Enter a place such as Suntec City, Orchard or a postal code. Find uses it as a nearby-search centre; Distance refines the radius.';
})();
