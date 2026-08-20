(() => {
  let resolving = false;
  let pendingCandidates = [];
  let localTimer = null;

  const normalize = value => String(value || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

  function ensureSuggestionUi() {
    let box = document.getElementById('nearbyLocationSuggestions');
    if (box) return box;
    const input = $('placeInput');
    const row = input?.closest('.search-row');
    if (!row) return null;
    row.style.position = 'relative';
    box = document.createElement('div');
    box.id = 'nearbyLocationSuggestions';
    box.className = 'location-suggestions';
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
    return candidate.shortLabel || String(candidate.label || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 4).join(', ');
  }

  function showSuggestions(query, candidates, sourceLabel = 'Singapore location') {
    const box = ensureSuggestionUi();
    if (!box || !candidates.length) return false;
    pendingCandidates = candidates;
    box.innerHTML = `
      <div style="padding:10px 14px 7px;color:#a9bed0;font-size:12px;font-weight:700;letter-spacing:.04em">Choose a nearby location for “${esc(query)}”</div>
      ${candidates.map((c, i) => `<button type="button" data-nearby-location-choice="${i}" role="option" style="display:block;width:100%;padding:12px 14px;border:0;border-top:1px solid rgba(120,160,190,.18);background:transparent;color:#f4f8fb;text-align:left;cursor:pointer;font:inherit"><strong style="display:block;font-size:14px">${esc(shortLabel(c))}</strong><span style="display:block;margin-top:3px;color:#9fb4c7;font-size:12px">${esc(c.typeLabel || sourceLabel)}</span></button>`).join('')}
    `;
    box.style.display = 'block';
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
    if (/\bave\b/i.test(q)) variants.push(q.replace(/\bave\b/i, 'Avenue'));
    return [...new Set(variants)].slice(0, 5);
  }

  function scoreText(label, query) {
    const text = normalize(label), q = normalize(query);
    if (!text || !q) return 0;
    const qDigits = String(query).replace(/\D/g, '');
    const textDigits = String(label).replace(/\D/g, '');
    if (qDigits.length === 6 && textDigits.includes(qDigits)) return 120;
    if (text === q) return 110;
    if (text.startsWith(q)) return 95;
    if (text.includes(q)) return 80;
    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length && tokens.every(t => text.includes(t))) return 70;
    return 0;
  }

  function localCandidates(query) {
    const ranked = [];
    for (const m of payload.merchants || []) {
      const lat = Number(m.lat), lng = Number(m.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const labels = [
        m.geocode_building, m.mall, m.building, m.hotel, m.property, m.location,
        m.geocode_road, m.geocode_postal, m.postal_code, m.address
      ].filter(v => v != null && String(v).trim());
      for (const label of labels) {
        const score = scoreText(label, query);
        if (!score) continue;
        const postal = m.geocode_postal || m.postal_code || '';
        ranked.push({
          lat, lng, score,
          label: String(label),
          shortLabel: String(label),
          typeLabel: [m.geocode_road, postal].filter(Boolean).join(' · ') || 'From SGDining mapped locations'
        });
      }
    }
    ranked.sort((a, b) => b.score - a.score || a.shortLabel.localeCompare(b.shortLabel));
    return dedupe(ranked).slice(0, 8);
  }

  async function osmCandidates(query) {
    const merged = [];
    for (const variant of queryVariants(query)) {
      try {
        const params = new URLSearchParams({
          format: 'jsonv2', limit: '8', countrycodes: 'sg', addressdetails: '1', dedupe: '1',
          viewbox: '103.59,1.49,104.10,1.13', bounded: '1', q: variant
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
          headers: { 'Accept-Language': 'en-SG,en;q=0.9' }
        });
        if (!res.ok) continue;
        const rows = await res.json();
        for (const row of rows) {
          const lat = Number(row.lat), lng = Number(row.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          merged.push({
            lat, lng,
            label: row.display_name || variant,
            shortLabel: row.namedetails?.name || row.name || String(row.display_name || variant).split(',')[0],
            typeLabel: [row.type, row.address?.road, row.address?.postcode].filter(Boolean).join(' · ') || 'Singapore map result'
          });
        }
      } catch (_) {}
      if (merged.length >= 8) break;
    }
    return dedupe(merged).slice(0, 8);
  }

  function dedupe(rows) {
    const out = [];
    const seen = new Set();
    for (const row of rows) {
      const coordKey = `${Number(row.lat).toFixed(5)},${Number(row.lng).toFixed(5)}`;
      const labelKey = normalize(shortLabel(row));
      const key = `${coordKey}|${labelKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...row, key });
    }
    return out;
  }

  function confidentSingle(query, candidates) {
    if (candidates.length === 1) return candidates[0];
    if (!candidates.length) return null;
    const q = normalize(query);
    const exact = candidates.filter(c => normalize(shortLabel(c)) === q);
    return exact.length === 1 ? exact[0] : null;
  }

  function applyCandidate(candidate, query) {
    if (!candidate) return false;
    hideSuggestions();
    const input = $('placeInput');
    if (input) input.value = shortLabel(candidate) || query;
    if (Number($('radiusFilter')?.value || 0) <= 0) $('radiusFilter').value = '1';
    const activeRadius = Number($('radiusFilter')?.value || 1);
    setOrigin(candidate.lat, candidate.lng, shortLabel(candidate) || query);
    map.setView([candidate.lat, candidate.lng], activeRadius <= 1 ? 15 : activeRadius <= 2 ? 14 : 13);
    const state = $('placeState');
    if (state) state.textContent = `Distance origin: ${shortLabel(candidate) || query} · ${activeRadius} km radius`;
    return true;
  }

  async function resolveNearbyLocation() {
    const query = $('placeInput')?.value.trim() || '';
    if (!query || resolving) return;
    resolving = true;
    hideSuggestions();
    const state = $('placeState');
    const button = $('placeBtn');
    if (state) state.textContent = `Finding “${query}”…`;
    if (button) button.disabled = true;
    try {
      const local = localCandidates(query);
      const exactLocal = confidentSingle(query, local);
      if (exactLocal) { applyCandidate(exactLocal, query); return; }

      const remote = await osmCandidates(query);
      const combined = dedupe([...local, ...remote]).slice(0, 8);
      if (!combined.length) {
        if (state) state.textContent = `Could not find “${query}” in Singapore. Try a building, mall, road or 6-digit postal code.`;
        return;
      }
      const confident = confidentSingle(query, combined);
      if (confident) { applyCandidate(confident, query); return; }
      showSuggestions(query, combined);
      if (state) state.textContent = `Choose the intended Singapore location for “${query}”.`;
    } finally {
      resolving = false;
      if (button) button.disabled = false;
    }
  }

  function showLocalSuggestions() {
    clearTimeout(localTimer);
    const query = $('placeInput')?.value.trim() || '';
    if (query.length < 2) { hideSuggestions(); return; }
    localTimer = setTimeout(() => {
      const local = localCandidates(query);
      if (local.length) showSuggestions(query, local, 'From SGDining mapped locations');
      else hideSuggestions();
    }, 180);
  }

  document.addEventListener('input', event => {
    if (event.target?.id !== 'placeInput') return;
    showLocalSuggestions();
  }, true);

  document.addEventListener('click', event => {
    const choice = event.target.closest('[data-nearby-location-choice]');
    if (choice) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const candidate = pendingCandidates[Number(choice.dataset.nearbyLocationChoice)];
      applyCandidate(candidate, $('placeInput')?.value.trim() || '');
      return;
    }
    if (event.target.closest('#placeBtn')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      resolveNearbyLocation();
      return;
    }
    const box = ensureSuggestionUi();
    if (box && box.style.display !== 'none' && !event.target.closest('#nearbyLocationSuggestions') && !event.target.closest('#placeInput')) hideSuggestions();
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.target?.id !== 'placeInput') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (pendingCandidates.length === 1) applyCandidate(pendingCandidates[0], $('placeInput').value.trim());
    else resolveNearbyLocation();
  }, true);

  document.addEventListener('change', event => {
    if (event.target?.id !== 'radiusFilter') return;
    const radius = Number($('radiusFilter')?.value || 0);
    if (radius <= 0) { updateOriginVisual(); render(true); return; }
    if (originPos) { updateOriginVisual(); render(true); return; }
    const query = $('placeInput')?.value.trim() || '';
    if (query) resolveNearbyLocation();
    else useMyLocation();
  }, true);

  const radius = $('radiusFilter');
  if (radius) radius.disabled = false;
  const state = $('placeState');
  if (state) state.textContent = 'Search a Singapore building, mall, road or 6-digit postal code, then choose the intended result.';
})();