(() => {
  const BLUE = '#2589ff';
  const VERIFIED_ON = '2026-08-26';
  const BEDOK_MALL = { address: '311 New Upper Changi Road, Bedok Mall, Singapore 467360', postal: '467360', lat: 1.324736327847299, lng: 103.929256259998 };
  const VERIFIED_OUTLETS = [
    {
      name: 'ACE Marketplace', outlet: '537 Bedok North Street 3',
      address: '537 Bedok North Street 3, #01-513 Kaki Bukit Mall, Singapore 460537', postal: '460537',
      lat: 1.331639, lng: 103.924028, mpd: 1, subcategory: 'GROCERIES', categories: ['retail'],
      matchExisting: m => /street\s*3/i.test(String(m.outlet || m.location || '')) || String(m.postal_code || '') === '460538'
    },
    {
      name: 'Canadian Pizza', outlet: 'Bedok North',
      address: '551 Bedok North Avenue 1, #01-542, Singapore 460551', postal: '460551',
      lat: 1.33247, lng: 103.92702, mpd: 2, subcategory: 'DINING', categories: ['dining']
    },
    {
      name: 'SF Fruits & Juices', outlet: 'Bedok Mall',
      address: '311 New Upper Changi Road, #B2-K15, Bedok Mall, Singapore 467360', postal: BEDOK_MALL.postal,
      lat: BEDOK_MALL.lat, lng: BEDOK_MALL.lng, mpd: 2, subcategory: 'QUICK BITES & SNACKS', categories: ['dining']
    },
    {
      name: 'MODE AESTHETICS', outlet: 'Bedok Mall',
      address: '311 New Upper Changi Road, #B2-37, Bedok Mall, Singapore 467360', postal: BEDOK_MALL.postal,
      lat: BEDOK_MALL.lat, lng: BEDOK_MALL.lng, mpd: 5, subcategory: 'BEAUTY TREATMENT & SPA', categories: ['wellness']
    },
    {
      name: 'Canton Paradise', outlet: 'Bedok Mall',
      address: '311 New Upper Changi Road, Bedok Mall, Singapore 467360', postal: BEDOK_MALL.postal,
      lat: BEDOK_MALL.lat, lng: BEDOK_MALL.lng, mpd: 2, subcategory: 'CASUAL DINING', categories: ['dining']
    },
    {
      name: "LeNu Chef Wai's Noodle Bar", outlet: 'Bedok Mall',
      address: '311 New Upper Changi Road, #B2-32, Bedok Mall, Singapore 467360', postal: BEDOK_MALL.postal,
      lat: BEDOK_MALL.lat, lng: BEDOK_MALL.lng, mpd: 2, subcategory: 'CASUAL DINING', categories: ['dining']
    },
    {
      name: 'Nailz Treats', outlet: 'Bedok Mall',
      address: '311 New Upper Changi Road, Bedok Mall, Singapore 467360', postal: BEDOK_MALL.postal,
      lat: BEDOK_MALL.lat, lng: BEDOK_MALL.lng, mpd: 2, subcategory: 'PERSONAL CARE', categories: ['services', 'wellness']
    }
  ];

  const normalize = value => String(value || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

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

  // "Use my location" is a location action, not a merchant-name search. A stale
  // text query such as "Chai Chee" would otherwise hide nearby Bedok outlets.
  document.getElementById('locateBtn')?.addEventListener('click', () => {
    const search = document.getElementById('searchBox');
    if (search) search.value = '';
  }, true);

  function verifiedId(item) {
    return `kp_verified_${normalize(`${item.name}-${item.postal}-${item.outlet}`).replace(/\s+/g, '_')}`;
  }

  function setVerifiedFields(target, item) {
    Object.assign(target, {
      name: item.name,
      brand: item.name,
      outlet: item.outlet,
      location: item.outlet,
      address: item.address,
      postal_code: item.postal,
      lat: item.lat,
      lng: item.lng,
      category: item.categories[0] || 'other',
      krisplus: true,
      krisplus_categories: [...item.categories],
      krisplus_subcategory: item.subcategory,
      krisplus_mpd: item.mpd,
      krisplus_geocode_conf: 'verified',
      krisplus_map_ready: true,
      krisplus_source_lat: item.lat,
      krisplus_source_lng: item.lng,
      krisplus_source: `Kris+ app nearby verification ${VERIFIED_ON}`,
      krisplus_verified_on: VERIFIED_ON
    });
    return target;
  }

  function applyVerifiedNearbyCorrections() {
    if (window.__sgDiningKrisplusBedokCorrectionsApplied) return false;
    if (typeof payload === 'undefined' || !Array.isArray(payload?.merchants)) return false;
    if (!payload.merchants.some(m => m?.krisplus)) return false;

    let changed = 0;
    for (const item of VERIFIED_OUTLETS) {
      const wantedName = normalize(item.name);
      let target = payload.merchants.find(m =>
        m?.krisplus && normalize(m.name || m.brand) === wantedName && String(m.postal_code || '') === item.postal
      );
      if (!target && typeof item.matchExisting === 'function') {
        target = payload.merchants.find(m => m?.krisplus && normalize(m.name || m.brand) === wantedName && item.matchExisting(m));
      }
      if (target) {
        const before = [target.address, target.postal_code, target.lat, target.lng, target.krisplus_mpd].join('|');
        setVerifiedFields(target, item);
        const after = [target.address, target.postal_code, target.lat, target.lng, target.krisplus_mpd].join('|');
        if (before !== after) changed++;
      } else {
        payload.merchants.push(setVerifiedFields({ id: verifiedId(item) }, item));
        changed++;
      }
    }

    window.__sgDiningKrisplusBedokCorrectionsApplied = true;
    window.SGDiningKrisplusVerifiedNearby = { verified_on: VERIFIED_ON, outlets: VERIFIED_OUTLETS.length, changed };

    if (payload.stats) {
      payload.stats.krisplus_verified_nearby = { verified_on: VERIFIED_ON, outlets: VERIFIED_OUTLETS.length, changed };
    }

    // If this is a GPS/current-location search, never let an old text query act
    // as a second merchant-name filter when the corrected nearby data is rendered.
    if (typeof originLabel !== 'undefined' && /current location/i.test(String(originLabel || ''))) {
      const search = document.getElementById('searchBox');
      if (search) search.value = '';
    }

    if (typeof populateCuisine === 'function') populateCuisine();
    if (typeof refreshFilterAvailability === 'function') refreshFilterAvailability();
    if (typeof render === 'function') render(true);
    return true;
  }

  async function installVerifiedNearbyCorrections() {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      if (applyVerifiedNearbyCorrections()) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.warn('Kris+ verified nearby corrections were not applied because the Kris+ dataset did not finish loading.');
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

  installVerifiedNearbyCorrections();
})();
