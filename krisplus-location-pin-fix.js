(() => {
  const BLUE = '#2589ff';

  // Any successful nearby-location choice (including "Use my location")
  // defaults to a useful nearby search: 1 km + filters open on mobile.
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

  // "Use my location" is a location action, not a merchant-name search.
  // Clear any stale text query so nearby outlets are not hidden accidentally.
  document.getElementById('locateBtn')?.addEventListener('click', () => {
    const search = document.getElementById('searchBox');
    if (search) search.value = '';
  }, true);

  function decorateKrisplusPins() {
    if (typeof current !== 'function' || !Array.isArray(markers)) return;
    const mappedRows = current().filter(m => m.lat != null && m.lng != null);
    markers.forEach((marker, index) => {
      const merchant = mappedRows[index];
      if (!merchant?.krisplus) return;
      const el = marker.getElement?.();
      const core = el?.querySelector('.benefit-pin-core');
      if (!core) return;
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

  function buildingKey(merchant) {
    const postal = String(merchant?.postal_code || '').trim();
    if (/^\d{6}$/.test(postal)) return `postal:${postal}`;
    const lat = Number(merchant?.lat), lng = Number(merchant?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return `coord:${lat.toFixed(6)},${lng.toFixed(6)}`;
  }

  function groupPopupHtml(entries) {
    const first = entries[0]?.merchant;
    const place = first?.outlet || first?.location || first?.address || first?.postal_code || 'Same location';
    const rows = entries.map(({ merchant }) => {
      const outlet = merchant.outlet || merchant.krisplus_outlet || merchant.location || '';
      const rate = merchant.krisplus
        ? (merchant.krisplus_mpd != null ? `Kris+ ${esc(merchant.krisplus_mpd)} mpd` : 'Kris+')
        : '';
      const benefits = typeof benefitText === 'function' ? benefitText(merchant) : '';
      const meta = [outlet && outlet !== merchant.name ? outlet : '', rate || benefits].filter(Boolean).join(' · ');
      return `<div style="padding:9px 0;border-top:1px solid rgba(120,150,180,.24)"><strong style="display:block">${esc(merchant.accor_name || merchant.name)}</strong>${meta ? `<small style="display:block;margin-top:2px">${esc(meta)}</small>` : ''}</div>`;
    }).join('');
    return `<div style="min-width:235px;max-width:310px"><strong>${esc(entries.length)} outlets at ${esc(place)}</strong><div style="max-height:280px;overflow:auto;margin-top:7px">${rows}</div><small style="display:block;margin-top:8px;color:#789">Multiple merchants share the same building pin. Select a merchant from the list below the map for full details.</small></div>`;
  }

  function collapseCoincidentPins() {
    if (typeof current !== 'function' || !Array.isArray(markers) || !markers.length) return;
    const mappedRows = current().filter(m => m.lat != null && m.lng != null);
    const groups = new Map();
    mappedRows.forEach((merchant, index) => {
      const marker = markers[index];
      if (!marker) return;
      const key = buildingKey(merchant);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ merchant, marker, index });
    });
    for (const entries of groups.values()) {
      if (entries.length < 2) continue;
      const leader = entries[0].marker;
      const allKrisplus = entries.every(({ merchant }) => !!merchant.krisplus);
      const hasKrisplus = entries.some(({ merchant }) => !!merchant.krisplus);
      const count = entries.length;
      for (let i = 1; i < entries.length; i++) {
        try { layer.removeLayer(entries[i].marker); } catch (_) {}
      }
      leader.unbindTooltip?.();
      leader.unbindPopup?.();
      leader.off?.('click');
      const accent = allKrisplus ? BLUE : (hasKrisplus ? '#4f9edc' : '#34516e');
      const label = allKrisplus ? 'K+' : '';
      const icon = L.divIcon({
        className: 'benefit-pin-icon',
        html: `<div title="${esc(count)} outlets at this location" style="width:48px;height:48px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${accent};color:#fff;border:3px solid #d7ecff;box-shadow:0 3px 12px rgba(0,0,0,.35);font-weight:800;line-height:1"><span style="font-size:16px">${label}${count}</span><span style="font-size:8px;margin-top:3px;letter-spacing:.04em">OUTLETS</span></div>`,
        iconSize: [50, 50],
        iconAnchor: [25, 25],
        popupAnchor: [0, -22]
      });
      leader.setIcon(icon);
      leader.bindPopup(groupPopupHtml(entries), { autoClose: true, closeOnClick: true, closeButton: true, maxWidth: 330 });
      leader.on?.('add', () => {
        const el = leader.getElement?.();
        if (el) el.style.cursor = 'pointer';
      });
    }
  }

  if (typeof render === 'function' && !window.__sgDiningKrisplusPinFix) {
    window.__sgDiningKrisplusPinFix = true;
    const baseRender = render;
    render = function (...args) {
      const result = baseRender(...args);
      requestAnimationFrame(() => {
        decorateKrisplusPins();
        collapseCoincidentPins();
      });
      return result;
    };
    requestAnimationFrame(() => {
      decorateKrisplusPins();
      collapseCoincidentPins();
    });
  }
})();
