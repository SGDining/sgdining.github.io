(() => {
  let searchActsAsOrigin = false;
  let resolving = false;
  let pendingCandidates = [];

  const baseCurrent = current;
  current = function () {
    const search = $('searchBox');
    if (!searchActsAsOrigin || !search) return baseCurrent();
    const value = search.value;
    search.value = '';
    try { return baseCurrent(); }
    finally { search.value = value; }
  };

  const normalize = value => String(value || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
  const stemToken = t => t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t;
  const tokensFor = value => normalize(value).split(/\s+/).filter(Boolean).map(stemToken);

  function ensureSuggestionUi() {
    let box = document.getElementById('locationSuggestions');
    if (box) return box;
    const row = $('searchBox')?.closest('.search-row');
    if (!row) return null;
    row.style.position = 'relative';
    box = document.createElement('div');
    box.id = 'locationSuggestions';
    box.setAttribute('role', 'listbox');
    box.style.cssText = 'display:none;position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:5000;background:#0b2137;border:1px solid #315778;border-radius:14px;box-shadow:0 14px 35px rgba(0,0,0,.35);overflow:hidden;max-height:310px;overflow-y:auto;text-align:left';
    row.appendChild(box);
    return box;
  }

  function hideSuggestions() {
    const box = ensureSuggestionUi();
    if (box) { box.style.display = 'none'; box.innerHTML = ''; }
    pendingCandidates = [];
  }

  function shortLabel(candidate) {
    const parts = String(candidate.label || '').split(',').map(x => x.trim()).filter(Boolean);
    return parts.slice(0, 4).join(', ');
  }

  function showSuggestions(query, candidates, radius, defaultRadius) {
    const box = ensureSuggestionUi();
    if (!box) return false;
    pendingCandidates = candidates;
    box.innerHTML = `
      <div style="padding:10px 14px 7px;color:#a9bed0;font-size:12px;font-weight:700;letter-spacing:.04em">Choose a location for “${esc(query)}”</div>
      ${candidates.map((c, i) => `<button type="button" data-location-choice="${i}" role="option" style="display:block;width:100%;padding:12px 14px;border:0;border-top:1px solid rgba(120,160,190,.18);background:transparent;color:#f4f8fb;text-align:left;cursor:pointer;font:inherit"><strong style="display:block;font-size:14px">${esc(shortLabel(c))}</strong><span style="display:block;margin-top:3px;color:#9fb4c7;font-size:12px">${esc(c.typeLabel || 'Singapore location')}</span></button>`).join('')}
    `;
    box.style.display = 'block';
    box.dataset.radius = String(radius || 0);
    box.dataset.defaultRadius = defaultRadius ? '1' : '0';
    const state = $('placeState');
    if (state) state.textContent = `Choose the intended place for “${query}”.`;
    return true;
  }

  function queryVariants(query) {
    const q = query.trim();
    const variants = [q];
    if (/\btower\b/i.test(q) && !/\btowers\b/i.test(q)) variants.push(q.replace(/\btower\b/i, 'Towers'));
    if (/\btowers\b/i.test(q)) variants.push(q.replace(/\btowers\b/i, 'Tower'));
    if (/\bctr\b/i.test(q)) variants.push(q.replace(/\bctr\b/i, 'Centre'));
    if (/\bcenter\b/i.test(q)) variants.push(q.replace(/\bcenter\b/i, 'Centre'));
    if (/\brd\b/i.test(q)) variants.push(q.replace(/\brd\b/i, 'Road'));
    if (!/\b(city|mall|centre|center|road|street|avenue|hotel|tower|towers|airport|station)\b/i.test(q)) {
      variants.push(`${q} City`, `${q} Mall`);
    }
    return [...new Set(variants)].slice(0, 4);
  }

  function localMerchantCandidates(query) {
    const qt = tokensFor(query);
    if (!qt.length || !payload?.merchants?.length) return [];
    const hits = [];
    for (const m of payload.merchants) {
      if (m.lat == null || m.lng == null) continue;
      const fields = [m.address, m.geocode_address, m.geocode_building, m.mall, m.building, m.hotel, m.property, m.location, m.street, m.venue].filter(Boolean);
      const hay = tokensFor(fields.join(' '));
      if (!qt.every(t => hay.some(h => h.includes(t) || t.includes(h)))) continue;
      const label = m.geocode_building || m.mall || m.building || m.property || m.hotel || m.address || query;
      hits.push({ lat:Number(m.lat), lng:Number(m.lng), label, typeLabel:'Known merchant location' });
    }
    const dedup = [];
    for (const h of hits) {
      const key = `${h.lat.toFixed(4)},${h.lng.toFixed(4)}`;
      if (!dedup.some(x => x.key === key)) dedup.push({ ...h, key });
    }
    return dedup.slice(0, 4);
  }

  async function geocodeCandidates(query) {
    const merged = [];
    const add = c => {
      const key = `${Number(c.lat).toFixed(5)},${Number(c.lng).toFixed(5)}`;
      if (!merged.some(x => x.key === key)) merged.push({ ...c, key });
    };

    for (const local of localMerchantCandidates(query)) add(local);

    for (const variant of queryVariants(query)) {
      const search = /singapore/i.test(variant) ? variant : `${variant}, Singapore`;
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=sg&addressdetails=1&q=${encodeURIComponent(search)}`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en-SG,en;q=0.9' } });
        if (!res.ok) continue;
        const rows = await res.json();
        for (const row of rows) {
          const lat = Number(row.lat), lng = Number(row.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const typeBits = [row.type, row.addresstype, row.address?.suburb, row.address?.quarter].filter(Boolean);
          add({ lat, lng, label: row.display_name || variant, typeLabel: typeBits.join(' · ') || 'Singapore location' });
        }
      } catch (_) {}
      if (merged.length >= 8) break;
    }
    return merged.slice(0, 8);
  }

  function confidentSingle(query, candidates) {
    if (candidates.length === 1) return candidates[0];
    if (!candidates.length) return null;
    const q = normalize(query);
    const exact = candidates.filter(c => normalize(String(c.label || '').split(',')[0]) === q);
    return exact.length === 1 ? exact[0] : null;
  }

  function applyCandidate(candidate, query, radius, defaultRadius = false) {
    if (!candidate) return false;
    hideSuggestions();
    searchActsAsOrigin = true;
    const placeInput = $('placeInput');
    if (placeInput) placeInput.value = shortLabel(candidate) || query;
    if (defaultRadius && Number($('radiusFilter')?.value || 0) <= 0) $('radiusFilter').value = '1';
    const activeRadius = Number($('radiusFilter')?.value || radius || 1);
    setOrigin(candidate.lat, candidate.lng, shortLabel(candidate) || query);
    map.setView([candidate.lat, candidate.lng], activeRadius <= 1 ? 15 : activeRadius <= 2 ? 14 : 13);
    const state = $('placeState');
    if (state) state.textContent = `Searching within ${activeRadius} km of ${shortLabel(candidate) || query}`;
    return true;
  }

  async function useQueryAsLocation(query, radius, defaultRadius = false) {
    if (resolving) return 'busy';
    resolving = true;
    hideSuggestions();
    const placeState = $('placeState');
    if (placeState) placeState.textContent = `Finding “${query}”…`;
    try {
      const candidates = await geocodeCandidates(query);
      if (!candidates.length) return 'none';
      const confident = confidentSingle(query, candidates);
      if (confident) { applyCandidate(confident, query, radius, defaultRadius); return 'applied'; }
      showSuggestions(query, candidates, radius, defaultRadius);
      return 'choose';
    } catch (_) {
      if (placeState) placeState.textContent = `Could not use “${query}” as a location.`;
      return 'none';
    } finally { resolving = false; }
  }

  async function resolveSearch() {
    const query = $('searchBox')?.value.trim() || '';
    const radius = Number($('radiusFilter')?.value || 0);
    if (!query) {
      hideSuggestions(); searchActsAsOrigin = false;
      if (radius > 0 && !originPos) useMyLocation(); else render(true);
      return;
    }
    const result = await useQueryAsLocation(query, radius || 1, radius <= 0);
    if (result === 'none') {
      hideSuggestions(); searchActsAsOrigin = false;
      const state = $('placeState');
      if (state) state.textContent = `I couldn't identify “${query}” as a Singapore place. Please refine the location instead of returning a misleading 0-result radius.`;
      if (radius > 0) $('radiusFilter').value = '0';
      // Keep existing results rather than forcing a zero-result text search.
      const search = $('searchBox'), value = search.value;
      search.value = '';
      try { render(true); } finally { search.value = value; }
    }
  }

  async function resolveDistanceChange() {
    const radius = Number($('radiusFilter')?.value || 0);
    if (radius <= 0) { hideSuggestions(); searchActsAsOrigin = false; updateOriginVisual(); render(true); return; }
    const query = $('searchBox')?.value.trim() || $('placeInput')?.value.trim() || '';
    if (query) {
      const result = await useQueryAsLocation(query, radius, false);
      if (result === 'none') {
        $('radiusFilter').value = '0'; searchActsAsOrigin = false;
        const search = $('searchBox'), value = search.value; search.value = '';
        try { render(true); } finally { search.value = value; }
      }
      return;
    }
    searchActsAsOrigin = false;
    if (!originPos) useMyLocation(); else { updateOriginVisual(); render(true); }
  }

  document.addEventListener('input', event => {
    if (event.target?.id !== 'searchBox') return;
    hideSuggestions(); event.stopImmediatePropagation();
  }, true);

  document.addEventListener('click', event => {
    const choice = event.target.closest('[data-location-choice]');
    if (choice) {
      event.preventDefault(); event.stopImmediatePropagation();
      const candidate = pendingCandidates[Number(choice.dataset.locationChoice)];
      const box = ensureSuggestionUi();
      const radius = Number(box?.dataset.radius || $('radiusFilter')?.value || 0);
      const defaultRadius = box?.dataset.defaultRadius === '1';
      applyCandidate(candidate, $('searchBox')?.value.trim() || '', radius || 1, defaultRadius);
      return;
    }
    if (!event.target.closest('#findBtn')) return;
    event.preventDefault(); event.stopImmediatePropagation(); resolveSearch();
  }, true);

  document.addEventListener('click', event => {
    const box = ensureSuggestionUi();
    if (!box || box.style.display === 'none') return;
    if (!event.target.closest('#locationSuggestions') && !event.target.closest('#findBtn') && !event.target.closest('#searchBox')) hideSuggestions();
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.target?.id !== 'searchBox') return;
    event.preventDefault(); event.stopImmediatePropagation(); resolveSearch();
  }, true);

  document.addEventListener('change', event => {
    if (event.target?.id !== 'radiusFilter') return;
    event.stopImmediatePropagation(); resolveDistanceChange();
  }, true);

  const radius = $('radiusFilter');
  if (radius) radius.disabled = false;
  const state = $('placeState');
  if (state) state.textContent = 'Enter a place such as Suntec, Orchard Towers or a postal code. Ambiguous or partial names will offer location choices.';
})();
