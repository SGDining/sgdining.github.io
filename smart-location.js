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

  const baseClearOrigin = clearOrigin;
  clearOrigin = function () {
    baseClearOrigin();
    const radius = $('radiusFilter');
    if (radius) radius.disabled = false;
  };

  const normalize = value => String(value || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();

  function ensureSuggestionUi(anchorId = 'searchBox') {
    let box = document.getElementById('locationSuggestions');
    const anchor = $(anchorId);
    const row = anchor?.closest('.search-row');
    if (!row) return box;
    if (!box) {
      box = document.createElement('div');
      box.id = 'locationSuggestions';
      box.setAttribute('role', 'listbox');
      box.style.cssText = 'display:none;position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:5000;background:#0b2137;border:1px solid #315778;border-radius:14px;box-shadow:0 14px 35px rgba(0,0,0,.35);overflow:hidden;max-height:310px;overflow-y:auto;text-align:left';
    }
    row.style.position = 'relative';
    if (box.parentElement !== row) row.appendChild(box);
    return box;
  }

  function hideSuggestions() {
    const box = document.getElementById('locationSuggestions');
    if (box) { box.style.display = 'none'; box.innerHTML = ''; }
    pendingCandidates = [];
  }

  function shortLabel(candidate) {
    return candidate.shortLabel || String(candidate.label || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 4).join(', ');
  }

  function showSuggestions(query, candidates, radius, defaultRadius, anchorId) {
    const box = ensureSuggestionUi(anchorId);
    if (!box) return false;
    pendingCandidates = candidates;
    box.innerHTML = `
      <div style="padding:10px 14px 7px;color:#a9bed0;font-size:12px;font-weight:700;letter-spacing:.04em">Choose a location for “${esc(query)}”</div>
      ${candidates.map((c, i) => `<button type="button" data-location-choice="${i}" role="option" style="display:block;width:100%;padding:12px 14px;border:0;border-top:1px solid rgba(120,160,190,.18);background:transparent;color:#f4f8fb;text-align:left;cursor:pointer;font:inherit"><strong style="display:block;font-size:14px">${esc(shortLabel(c))}</strong><span style="display:block;margin-top:3px;color:#9fb4c7;font-size:12px">${esc(c.typeLabel || 'OneMap Singapore')}</span></button>`).join('')}
    `;
    box.style.display = 'block';
    box.dataset.radius = String(radius || 0);
    box.dataset.defaultRadius = defaultRadius ? '1' : '0';
    box.dataset.query = query;
    const state = $('placeState');
    if (state) state.textContent = `Choose the intended OneMap result for “${query}”.`;
    return true;
  }

  async function oneMapCandidates(query) {
    const proxy = String(window.SGDINING_ONEMAP_PROXY || '').replace(/\/$/, '');
    if (!proxy) throw new Error('OneMap location service is not configured');
    const res = await fetch(`${proxy}/location-search?q=${encodeURIComponent(query)}`, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error || ''; } catch (_) {}
      throw new Error(detail || `location lookup ${res.status}`);
    }
    const data = await res.json();
    const rows = Array.isArray(data) ? data : (data.results || []);
    return dedupe(rows.map(row => ({
      lat: Number(row.LATITUDE ?? row.lat),
      lng: Number(row.LONGITUDE ?? row.LONGTITUDE ?? row.lng ?? row.lon),
      label: row.ADDRESS || row.SEARCHVAL || row.label || query,
      shortLabel: row.BUILDING && row.BUILDING !== 'NIL' ? row.BUILDING : (row.SEARCHVAL || row.label || ''),
      typeLabel: [row.ROAD_NAME, row.POSTAL].filter(Boolean).join(' · ') || 'OneMap Singapore'
    })).filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lng)));
  }

  function dedupe(rows) {
    const out = [];
    for (const row of rows) {
      const key = `${Number(row.lat).toFixed(5)},${Number(row.lng).toFixed(5)}`;
      if (!out.some(x => x.key === key)) out.push({ ...row, key });
    }
    return out;
  }

  function confidentSingle(query, candidates) {
    if (candidates.length === 1) return candidates[0];
    if (!candidates.length) return null;
    const q = normalize(query);
    const exact = candidates.filter(c => [c.shortLabel, String(c.label || '').split(',')[0]].filter(Boolean).map(normalize).includes(q));
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

  async function useQueryAsLocation(query, radius, defaultRadius = false, anchorId = 'searchBox') {
    if (resolving) return 'busy';
    resolving = true;
    hideSuggestions();
    const placeState = $('placeState');
    if (placeState) placeState.textContent = `Finding “${query}” with OneMap…`;
    try {
      const candidates = await oneMapCandidates(query);
      if (!candidates.length) return 'none';
      const confident = confidentSingle(query, candidates);
      if (confident) { applyCandidate(confident, query, radius, defaultRadius); return 'applied'; }
      showSuggestions(query, candidates, radius, defaultRadius, anchorId);
      return 'choose';
    } catch (error) {
      if (placeState) placeState.textContent = `Could not use “${query}” as a location: ${error.message || error}`;
      return 'error';
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
    const result = await useQueryAsLocation(query, radius || 1, radius <= 0, 'searchBox');
    if (result === 'none') {
      hideSuggestions(); searchActsAsOrigin = false;
      const state = $('placeState');
      if (state) state.textContent = `OneMap found no Singapore location for “${query}”. Please refine the location.`;
    }
  }

  async function resolvePlace() {
    const query = $('placeInput')?.value.trim() || '';
    if (!query) return;
    const radius = Number($('radiusFilter')?.value || 0);
    await useQueryAsLocation(query, radius || 1, radius <= 0, 'placeInput');
  }

  async function resolveDistanceChange() {
    const radius = Number($('radiusFilter')?.value || 0);
    if (radius <= 0) { hideSuggestions(); searchActsAsOrigin = false; updateOriginVisual(); render(true); return; }
    const query = $('placeInput')?.value.trim() || $('searchBox')?.value.trim() || '';
    if (query) {
      const result = await useQueryAsLocation(query, radius, false, $('placeInput')?.value.trim() ? 'placeInput' : 'searchBox');
      if (result === 'none') {
        const state = $('placeState');
        if (state) state.textContent = `OneMap found no Singapore location for “${query}”.`;
      }
      return;
    }
    searchActsAsOrigin = false;
    if (!originPos) useMyLocation(); else { updateOriginVisual(); render(true); }
  }

  document.addEventListener('input', event => {
    if (!['searchBox', 'placeInput'].includes(event.target?.id)) return;
    hideSuggestions();
    if (event.target.id === 'searchBox') event.stopImmediatePropagation();
  }, true);

  document.addEventListener('click', event => {
    const choice = event.target.closest('[data-location-choice]');
    if (choice) {
      event.preventDefault(); event.stopImmediatePropagation();
      const candidate = pendingCandidates[Number(choice.dataset.locationChoice)];
      const box = document.getElementById('locationSuggestions');
      const radius = Number(box?.dataset.radius || $('radiusFilter')?.value || 0);
      const defaultRadius = box?.dataset.defaultRadius === '1';
      applyCandidate(candidate, box?.dataset.query || '', radius || 1, defaultRadius);
      return;
    }
    if (event.target.closest('#findBtn')) {
      event.preventDefault(); event.stopImmediatePropagation(); resolveSearch(); return;
    }
    if (event.target.closest('#placeBtn')) {
      event.preventDefault(); event.stopImmediatePropagation(); resolvePlace(); return;
    }
    const box = document.getElementById('locationSuggestions');
    if (box && box.style.display !== 'none' && !event.target.closest('#locationSuggestions') && !event.target.closest('#searchBox') && !event.target.closest('#placeInput')) hideSuggestions();
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    if (event.target?.id === 'searchBox') {
      event.preventDefault(); event.stopImmediatePropagation(); resolveSearch();
    } else if (event.target?.id === 'placeInput') {
      event.preventDefault(); event.stopImmediatePropagation(); resolvePlace();
    }
  }, true);

  document.addEventListener('change', event => {
    if (event.target?.id !== 'radiusFilter') return;
    event.stopImmediatePropagation(); resolveDistanceChange();
  }, true);

  const radius = $('radiusFilter');
  if (radius) radius.disabled = false;
  const state = $('placeState');
  if (state) state.textContent = 'Location search uses Singapore SLA OneMap. Multiple matches will be shown for you to choose.';
})();
