(() => {
  const KP_PARTS = Array.from({ length: 10 }, (_, i) => `data/krisplus-v2/chunk-${String(i + 1).padStart(2, '0')}.txt`);
  const KP_MIN_EXPECTED = 1600;

  const DINING = new Set(['ASIAN','BEVERAGES & DESSERTS','BUFFET','CAFE','CASUAL DINING','CHINESE','DINING','DINING · ACTIVITIES','DINING · RETAIL','EUROPEAN','FINE DINING','FOOD SPECIALITIES','ITALIAN','JAPANESE','KID-FRIENDLY','PUBS & BARS','QUICK BITES & SNACKS','RETAIL · DINING','WESTERN']);
  const RETAIL = new Set(['ACCESSORIES, JEWELLERY & WATCHES','AUTOMOTIVE','BABY & KIDS','ELECTRICAL & ELECTRONICS','FASHION','GIFTS & SOUVENIRS','GROCERIES','HOME & LIFESTYLE','RETAIL','DINING · RETAIL','RETAIL · DINING','RETAIL · SERVICES']);
  const ACTIVITIES = new Set(['ACTIVITIES','DINING · ACTIVITIES','ENTERTAINMENT','INDOOR','LEARNING']);
  const SERVICES = new Set(['SERVICES','RETAIL · SERVICES','HOTELS','PERSONAL CARE','AUTOMOTIVE','LEARNING','SERVICES · WELLNESS']);
  const WELLNESS = new Set(['WELLNESS','SERVICES · WELLNESS','BEAUTY','BEAUTY TREATMENT & SPA','HEALTH & FITNESS','PERSONAL CARE']);
  const CUISINE_MAP = { CHINESE:'Chinese', JAPANESE:'Japanese', ITALIAN:'Italian', WESTERN:'Western', ASIAN:'Asian', EUROPEAN:'European', CAFE:'Cafe', BUFFET:'Buffet', 'PUBS & BARS':'Bar', 'BEVERAGES & DESSERTS':'Dessert' };

  const normal = value => String(value || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

  function categoryMembership(raw) {
    const out = [];
    if (DINING.has(raw)) out.push('dining');
    if (RETAIL.has(raw)) out.push('retail');
    if (ACTIVITIES.has(raw)) out.push('activities');
    if (SERVICES.has(raw)) out.push('services');
    if (WELLNESS.has(raw)) out.push('wellness');
    return out;
  }

  function expandCompact(compact) {
    if (!compact || compact.v !== 2 || !Array.isArray(compact.rows)) throw new Error('unsupported Kris+ compact data');
    return compact.rows.map((row, index) => {
      const [mi, oi, ci, li, mpd] = row;
      const merchant = String(compact.merchants?.[mi] || '').trim();
      const outlet = String(compact.outlets?.[oi] || '').trim();
      const rawCategory = String(compact.categories?.[ci] || '').trim();
      const categories = categoryMembership(rawCategory);
      const loc = compact.locations?.[li] || [];
      const [addressRaw, postalRaw, latRaw, lngRaw, confRaw] = loc;
      const address = String(addressRaw || '').trim();
      const postal = String(postalRaw || '').trim();
      const conf = String(confRaw || '').trim();
      const lat = Number(latRaw), lng = Number(lngRaw);
      const validCoord = Number.isFinite(lat) && Number.isFinite(lng) && lat >= 1.15 && lat <= 1.50 && lng >= 103.55 && lng <= 104.10;
      const validPostal = /^\d{6}$/.test(postal);
      const mapReady = conf === 'high' && validPostal && validCoord;
      const key = [merchant, outlet, address, postal, index].join('|');
      let hash = 2166136261;
      for (const c of key) { hash ^= c.charCodeAt(0); hash = Math.imul(hash, 16777619); }
      return {
        id: `kp_${(hash >>> 0).toString(16).padStart(8, '0')}`,
        name: merchant,
        brand: merchant,
        outlet: outlet || null,
        location: outlet || null,
        address: address || null,
        postal_code: validPostal ? postal : null,
        category: categories[0] || 'other',
        krisplus: true,
        krisplus_categories: categories,
        krisplus_subcategory: rawCategory || null,
        krisplus_mpd: Number.isFinite(Number(mpd)) ? Number(mpd) : null,
        krisplus_cuisine: CUISINE_MAP[rawCategory] || null,
        krisplus_geocode_conf: conf || null,
        krisplus_map_ready: mapReady,
        lat: mapReady ? lat : null,
        lng: mapReady ? lng : null,
        krisplus_source_lat: validCoord ? lat : null,
        krisplus_source_lng: validCoord ? lng : null,
        krisplus_source: 'krisplus_outlets_SGDining.csv'
      };
    });
  }

  function keyFor(m) {
    return [normal(m?.name || m?.brand), normal(m?.outlet || m?.location), String(m?.postal_code || '')].join('|');
  }

  function mergeFallback(outlets) {
    if (typeof payload === 'undefined' || !Array.isArray(payload?.merchants)) return { added: 0, upgraded: 0 };
    const byKey = new Map(payload.merchants.filter(m => m?.krisplus).map(m => [keyFor(m), m]));
    const baseByPostal = new Map();
    for (const m of payload.merchants) {
      if (m.krisplus) continue;
      const postal = String(m.postal_code || '');
      if (!/^\d{6}$/.test(postal)) continue;
      if (!baseByPostal.has(postal)) baseByPostal.set(postal, []);
      baseByPostal.get(postal).push(m);
    }

    let added = 0, upgraded = 0;
    for (const kp of outlets) {
      const key = keyFor(kp);
      const existing = byKey.get(key);
      if (existing) {
        if (existing.lat == null && kp.lat != null) { existing.lat = kp.lat; existing.lng = kp.lng; upgraded++; }
        continue;
      }

      let target = null;
      const candidates = baseByPostal.get(String(kp.postal_code || '')) || [];
      const wanted = normal(kp.name);
      const matches = candidates.filter(m => {
        const names = [m.name, m.brand, m.accor_name].map(normal).filter(Boolean);
        return names.includes(wanted) || (wanted.length >= 5 && names.some(n => n.includes(wanted) || wanted.includes(n)));
      });
      if (matches.length === 1) target = matches[0];

      if (target) {
        Object.assign(target, {
          krisplus: true,
          krisplus_outlet: kp.outlet,
          krisplus_categories: kp.krisplus_categories,
          krisplus_subcategory: kp.krisplus_subcategory,
          krisplus_mpd: kp.krisplus_mpd,
          krisplus_cuisine: kp.krisplus_cuisine,
          krisplus_geocode_conf: kp.krisplus_geocode_conf,
          krisplus_map_ready: kp.krisplus_map_ready,
          krisplus_source: kp.krisplus_source
        });
        if (target.lat == null && kp.lat != null) { target.lat = kp.lat; target.lng = kp.lng; }
        byKey.set(key, target);
      } else {
        payload.merchants.push(kp);
        byKey.set(key, kp);
      }
      added++;
    }
    return { added, upgraded };
  }

  function rerenderNearby() {
    try {
      if (typeof window.SGDiningRerunActiveLocationSearch === 'function' && window.SGDiningRerunActiveLocationSearch(true)) return;
    } catch (_) {}
    if (typeof render === 'function') render(true);
  }

  async function ensureKrisplusDataset() {
    const existing = typeof payload !== 'undefined' && Array.isArray(payload?.merchants)
      ? payload.merchants.filter(m => m?.krisplus).length
      : 0;
    if (existing >= KP_MIN_EXPECTED) {
      window.SGDiningKrisplusRuntimeHealth = { status: 'ok', outlets_loaded: existing, recovered: false };
      rerenderNearby();
      return;
    }

    try {
      const parts = await Promise.all(KP_PARTS.map(async url => {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`${response.status} ${url}`);
        return response.text();
      }));
      const compact = JSON.parse(parts.join(''));
      const outlets = expandCompact(compact);
      const result = mergeFallback(outlets);
      const loaded = payload.merchants.filter(m => m?.krisplus).length;
      window.SGDiningKrisplusStats = {
        ...(window.SGDiningKrisplusStats || {}),
        source_rows: compact.rows.length,
        unique_outlets: compact.rows.length,
        unique_merchants: new Set(outlets.map(o => o.brand)).size,
        map_ready: outlets.filter(o => o.krisplus_map_ready).length,
        needs_geocode_review: outlets.filter(o => !o.krisplus_map_ready).length,
        runtime_recovered: true,
        runtime_added: result.added,
        runtime_upgraded: result.upgraded
      };
      window.SGDiningKrisplusRuntimeHealth = { status: loaded >= KP_MIN_EXPECTED ? 'recovered' : 'partial', outlets_loaded: loaded, recovered: true };
      rerenderNearby();
      console.info('SGDining Kris+ runtime recovery', window.SGDiningKrisplusRuntimeHealth, window.SGDiningKrisplusStats);
    } catch (error) {
      window.SGDiningKrisplusRuntimeHealth = { status: 'failed', error: String(error?.message || error) };
      console.error('Kris+ runtime recovery failed', error);
      const banner = document.getElementById('bootstrapBanner');
      if (banner) {
        banner.classList.remove('hidden');
        banner.innerHTML = '<strong>Kris+ outlet data did not finish loading.</strong> Reload the page once; if this persists, please report it.';
      }
    }
  }

  function installTooltipViewportGuard() {
    if (typeof map === 'undefined' || window.__sgDiningTooltipViewportGuard) return;
    window.__sgDiningTooltipViewportGuard = true;

    const style = document.createElement('style');
    style.textContent = `
      .leaflet-tooltip.eatigo-slot-tooltip .slots-scroll{max-height:min(155px,26vh)!important}
      .leaflet-tooltip.eatigo-slot-tooltip .slots-head{padding-top:12px!important}
      .leaflet-tooltip.eatigo-slot-tooltip .restaurant-name{font-size:15px!important;font-weight:850!important;color:#fff!important}
    `;
    document.head.appendChild(style);

    map.on('tooltipopen', event => {
      const tooltip = event.tooltip;
      const el = tooltip?.getElement?.();
      if (!el?.classList?.contains('eatigo-slot-tooltip')) return;
      requestAnimationFrame(() => {
        const mapEl = map.getContainer();
        const mapRect = mapEl.getBoundingClientRect();
        const tipRect = el.getBoundingClientRect();
        const pad = 14;
        let dx = 0, dy = 0;
        if (tipRect.left < mapRect.left + pad) dx = tipRect.left - (mapRect.left + pad);
        else if (tipRect.right > mapRect.right - pad) dx = tipRect.right - (mapRect.right - pad);
        if (tipRect.top < mapRect.top + pad) dy = tipRect.top - (mapRect.top + pad);
        else if (tipRect.bottom > mapRect.bottom - pad) dy = tipRect.bottom - (mapRect.bottom - pad);
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) map.panBy([dx, dy], { animate: false });
      });
    });
  }

  installTooltipViewportGuard();
  setTimeout(ensureKrisplusDataset, 1800);
})();
