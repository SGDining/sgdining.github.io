(() => {
  const PROGRAMME = 'krisplus';
  const DATA_PARTS = Array.from({length:7}, (_,i) => `data/krisplus-v2/chunk-${String(i+1).padStart(2,'0')}.txt`);
  const CATEGORY_ORDER = ['dining', 'retail', 'activities', 'services', 'wellness'];
  const CATEGORY_LABELS = { dining: 'Dining', retail: 'Retail', activities: 'Activities', services: 'Services', wellness: 'Wellness' };
  const PROGRAMME_FLAGS = { ld: 'ld', lc: 'lc', accor: 'accor', gha: 'gha', eatigo: 'eatigo' };
  let krisplusMeta = null;
  let integrated = false;

  const $id = id => document.getElementById(id);
  const normal = value => String(value || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

  const DINING = new Set(['ASIAN','BEVERAGES & DESSERTS','BUFFET','CAFE','CASUAL DINING','CHINESE','DINING','DINING · ACTIVITIES','DINING · RETAIL','EUROPEAN','FINE DINING','FOOD SPECIALITIES','ITALIAN','JAPANESE','KID-FRIENDLY','PUBS & BARS','QUICK BITES & SNACKS','RETAIL · DINING','WESTERN']);
  const RETAIL = new Set(['ACCESSORIES, JEWELLERY & WATCHES','AUTOMOTIVE','BABY & KIDS','ELECTRICAL & ELECTRONICS','FASHION','GIFTS & SOUVENIRS','GROCERIES','HOME & LIFESTYLE','RETAIL','DINING · RETAIL','RETAIL · DINING','RETAIL · SERVICES']);
  const ACTIVITIES = new Set(['ACTIVITIES','DINING · ACTIVITIES','ENTERTAINMENT','INDOOR','LEARNING']);
  const SERVICES = new Set(['SERVICES','RETAIL · SERVICES','HOTELS','PERSONAL CARE','AUTOMOTIVE','LEARNING','SERVICES · WELLNESS']);
  const WELLNESS = new Set(['WELLNESS','SERVICES · WELLNESS','BEAUTY','BEAUTY TREATMENT & SPA','HEALTH & FITNESS','PERSONAL CARE']);
  const CUISINE_MAP = { CHINESE:'Chinese', JAPANESE:'Japanese', ITALIAN:'Italian', WESTERN:'Western', ASIAN:'Asian', EUROPEAN:'European', CAFE:'Cafe', BUFFET:'Buffet', 'PUBS & BARS':'Bar', 'BEVERAGES & DESSERTS':'Dessert' };

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

    const countsByMerchant = new Map();
    for (const row of compact.rows) {
      const [mi, , ci] = row;
      const merchant = compact.merchants?.[mi] || '';
      const category = compact.categories?.[ci] || '';
      if (!merchant || !category) continue;
      if (!countsByMerchant.has(merchant)) countsByMerchant.set(merchant, new Map());
      const counts = countsByMerchant.get(merchant);
      counts.set(category, (counts.get(category) || 0) + 1);
    }
    const modeByMerchant = new Map();
    for (const [merchant, counts] of countsByMerchant) {
      modeByMerchant.set(merchant, [...counts.entries()].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || '');
    }

    let inferred = 0;
    const outlets = compact.rows.map((row, index) => {
      const [mi, oi, ci, li, mpd] = row;
      const merchant = String(compact.merchants?.[mi] || '').trim();
      const outlet = String(compact.outlets?.[oi] || '').trim();
      let rawCategory = String(compact.categories?.[ci] || '').trim();
      let categoryInferred = false;
      if (!rawCategory && modeByMerchant.has(merchant)) {
        rawCategory = modeByMerchant.get(merchant);
        categoryInferred = !!rawCategory;
        if (categoryInferred) inferred++;
      }
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
        id: `kp_${(hash >>> 0).toString(16).padStart(8,'0')}`,
        name: merchant, brand: merchant, outlet: outlet || null, location: outlet || null,
        address: address || null, postal_code: validPostal ? postal : null,
        category: categories[0] || 'other', krisplus: true, krisplus_categories: categories,
        krisplus_subcategory: rawCategory || null, krisplus_category_inferred: categoryInferred,
        krisplus_mpd: Number.isFinite(Number(mpd)) ? Number(mpd) : null,
        krisplus_cuisine: CUISINE_MAP[rawCategory] || null, krisplus_geocode_conf: conf || null,
        krisplus_map_ready: mapReady, lat: mapReady ? lat : null, lng: mapReady ? lng : null,
        krisplus_source_lat: validCoord ? lat : null, krisplus_source_lng: validCoord ? lng : null
      };
    });

    const membershipCounts = Object.fromEntries(CATEGORY_ORDER.map(k => [k, outlets.filter(o => o.krisplus_categories.includes(k)).length]));
    return {
      generated_at: compact.generated_at || '2026-08-26T07:26:42Z',
      source: { name: 'krisplus_outlets_SGDining.csv', origin: 'Kris+ app outlet extraction supplied for SGDining' },
      stats: {
        source_rows: 1071,
        duplicates_removed: 18,
        unique_outlets: outlets.length,
        unique_merchants: new Set(outlets.map(o => o.brand)).size,
        map_ready: outlets.filter(o => o.krisplus_map_ready).length,
        needs_geocode_review: outlets.filter(o => !o.krisplus_map_ready).length,
        category_inferred: inferred,
        category_unknown: outlets.filter(o => !o.krisplus_subcategory).length,
        category_memberships: membershipCounts
      },
      outlets
    };
  }

  function injectStyles() {
    if ($id('krisplusStyles')) return;
    const style = document.createElement('style');
    style.id = 'krisplusStyles';
    style.textContent = `
      .programme-code.krisplus{background:#132d28;color:#77e5c3;border-color:#2e6c5d}.programme-grid{grid-template-columns:repeat(6,minmax(0,1fr))}
      .krisplus-filter-section.hidden{display:none}.krisplus-category-picker{display:flex;flex-wrap:wrap;gap:8px;margin-top:9px}.krisplus-category-chip{display:inline-flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid #31516f;border-radius:999px;background:#091a2d;cursor:pointer;font-size:12px;font-weight:750}.krisplus-category-chip.is-checked{border-color:#4fbf9f;background:#0e3028}.krisplus-category-chip input{width:16px;height:16px;min-height:0;accent-color:#43b99a}.krisplus-note{margin-top:9px;padding:9px 10px;border:1px solid #285f52;border-radius:10px;background:rgba(20,62,52,.35);font-size:12px;line-height:1.45}.krisplus-note strong{color:#8debd0}.krisplus-outlet-name{margin-top:2px;font-size:12px;color:var(--muted)}.badge.krisplus{border-color:#347e6a;background:#123a31;color:#99efd7}.krisplus-quality{display:block;margin-top:3px;color:var(--muted);font-size:10px}.stack-lifestyle.krisplus-disabled{opacity:.58;cursor:not-allowed}.stack-lifestyle.krisplus-disabled:after{content:'N/A'}
      @media(max-width:1050px){.programme-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:700px){.programme-grid{grid-template-columns:1fr 1fr}}@media(max-width:430px){.programme-grid{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  function injectProgrammeTile() {
    const picker = $id('programmePicker');
    if (!picker || picker.querySelector('input[data-programme="krisplus"]')) return;
    const label = document.createElement('label');
    label.className = 'programme-tile';
    label.innerHTML = '<input type="checkbox" data-programme="krisplus"><span class="programme-code krisplus">K+</span><span class="programme-name">Kris+</span>';
    picker.appendChild(label);
  }

  function injectCategoryFilter() {
    const filters = $id('filtersPanel');
    const eatigo = $id('eatigoFilterSection');
    if (!filters || $id('krisplusFilterSection')) return;
    const section = document.createElement('div');
    section.id = 'krisplusFilterSection';
    section.className = 'filter-section krisplus-filter-section hidden';
    section.innerHTML = `<div class="filter-section-title">Kris+ categories</div><div class="field-hint">Choose one or more Kris+ categories. “All” is the default. These filters only affect Kris+ results.</div><div id="krisplusCategoryPicker" class="krisplus-category-picker"></div>`;
    const picker = section.querySelector('#krisplusCategoryPicker');
    const categories = [['all', 'All'], ...CATEGORY_ORDER.map(k => [k, CATEGORY_LABELS[k]])];
    for (const [key, labelText] of categories) {
      const label = document.createElement('label');
      label.className = 'krisplus-category-chip' + (key === 'all' ? ' is-checked' : '');
      label.innerHTML = `<input type="checkbox" data-krisplus-category="${key}" ${key === 'all' ? 'checked' : ''}><span>${labelText}</span>`;
      picker.appendChild(label);
    }
    filters.insertBefore(section, eatigo || filters.querySelector('.filter-footer'));
  }

  function selectedProgrammes() {
    return [...document.querySelectorAll('input[data-programme]:checked')].map(box => box.dataset.programme);
  }
  function krisplusSelected() { return !!document.querySelector('input[data-programme="krisplus"]:checked'); }
  function selectedKrisplusCategories() {
    const picker = $id('krisplusCategoryPicker');
    if (!picker) return [];
    if (picker.querySelector('[data-krisplus-category="all"]')?.checked) return [];
    return [...picker.querySelectorAll('input[data-krisplus-category]:checked')].map(b => b.dataset.krisplusCategory).filter(k => k !== 'all');
  }

  function matchesOtherSelectedProgramme(merchant) {
    const selected = selectedProgrammes().filter(k => k !== PROGRAMME);
    if (!selected.length) return false;
    const stack = !!$id('stackLifestyle')?.checked;
    if (!stack) return selected.some(k => !!merchant[PROGRAMME_FLAGS[k]]);
    const stackable = selected.filter(k => k !== 'lc');
    if (!stackable.length) return selected.includes('lc') && !!merchant.lc;
    return !!merchant.lc && stackable.some(k => !!merchant[PROGRAMME_FLAGS[k]]);
  }

  function installModeLogic() {
    if (window.__sgDiningKrisplusModeInstalled) return;
    window.__sgDiningKrisplusModeInstalled = true;
    const priorModeMatch = modeMatch;
    const priorListHint = listHintForMode;
    modeMatch = function (merchant, mode) {
      if (!krisplusSelected()) return priorModeMatch(merchant, mode);
      if (mode !== 'multi') return priorModeMatch(merchant, mode) || !!merchant.krisplus;
      const other = matchesOtherSelectedProgramme(merchant);
      return other || !!merchant.krisplus;
    };
    listHintForMode = function (mode) {
      if (!krisplusSelected()) return priorListHint(mode);
      const selected = selectedProgrammes();
      if (selected.length === 1) return 'Kris+ participating outlets. Earn rates are shown in miles per S$1 where available.';
      const names = { ld: 'Amex LD', lc: 'Lifestyle Credit', accor: 'Accor+', gha: 'GHA', eatigo: 'Eatigo', krisplus: 'Kris+' };
      const label = selected.map(k => names[k] || k).join(', ');
      if ($id('stackLifestyle')?.checked) return `Showing Lifestyle Credit intersections for supported dining programmes, plus Kris+ independently: ${label}. Kris+ never stacks with Lifestyle Credit.`;
      return `Showing outlets from any selected programme: ${label}. Kris+ is treated as a separate payment/earn programme.`;
    };
  }

  function installBadges() {
    if (window.__sgDiningKrisplusBadgesInstalled) return;
    window.__sgDiningKrisplusBadgesInstalled = true;
    const priorBadges = badges;
    const priorBenefitText = benefitText;
    badges = function (merchant) {
      const base = priorBadges(merchant);
      if (!merchant.krisplus) return base;
      const label = merchant.krisplus_mpd != null ? `K+ ${merchant.krisplus_mpd} mpd` : 'K+';
      return `${base}<span class="badge krisplus">${esc(label)}</span>`;
    };
    benefitText = function (merchant) {
      const base = priorBenefitText(merchant);
      if (!merchant.krisplus) return base;
      const rate = merchant.krisplus_mpd != null ? `Kris+ ${merchant.krisplus_mpd} mpd` : 'Kris+';
      return [base, rate].filter(Boolean).join(' · ');
    };
  }

  function exactMergeCandidate(kp, candidates, used) {
    const kn = normal(kp.brand || kp.name);
    if (!kn) return null;
    const scored = [];
    for (const m of candidates) {
      if (used.has(m.id)) continue;
      const names = [m.name, m.brand, m.accor_name].map(normal).filter(Boolean);
      let score = 0;
      if (names.includes(kn)) score = 100;
      else if (kn.length >= 5 && names.some(n => n.includes(kn) || kn.includes(n))) score = 90;
      if (score) scored.push([score, m]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    if (!scored.length) return null;
    if (scored.length > 1 && scored[0][0] === scored[1][0]) return null;
    return scored[0][1];
  }

  function mergeData(data) {
    if (integrated || !data?.outlets?.length || !payload?.merchants?.length) return false;
    const baseMerchants = [...payload.merchants];
    const byPostal = new Map();
    for (const m of baseMerchants) {
      const p = String(m.postal_code || '').trim();
      if (!/^\d{6}$/.test(p)) continue;
      if (!byPostal.has(p)) byPostal.set(p, []);
      byPostal.get(p).push(m);
    }
    const used = new Set();
    let merged = 0, appended = 0;
    for (const kp of data.outlets) {
      let target = null;
      if (kp.postal_code && byPostal.has(kp.postal_code)) target = exactMergeCandidate(kp, byPostal.get(kp.postal_code), used);
      if (target) {
        used.add(target.id);
        Object.assign(target, {
          krisplus: true,
          krisplus_outlet: kp.outlet,
          krisplus_categories: kp.krisplus_categories || [],
          krisplus_subcategory: kp.krisplus_subcategory || null,
          krisplus_mpd: kp.krisplus_mpd,
          krisplus_cuisine: kp.krisplus_cuisine || null,
          krisplus_geocode_conf: kp.krisplus_geocode_conf || null,
          krisplus_map_ready: kp.krisplus_map_ready !== false,
          krisplus_source: data.source?.name || 'Kris+ outlet extract'
        });
        merged++;
      } else {
        payload.merchants.push({ ...kp, krisplus_source: data.source?.name || 'Kris+ outlet extract' });
        appended++;
      }
    }
    payload.sources = payload.sources || {};
    payload.sources.krisplus = data.source?.name || 'Kris+ outlet extract';
    payload.stats = payload.stats || {};
    payload.stats.krisplus = data.stats || {};
    payload.stats.krisplus.merged_into_existing = merged;
    payload.stats.krisplus.appended_new_outlets = appended;
    krisplusMeta = data;
    integrated = true;
    window.SGDiningKrisplusStats = payload.stats.krisplus;
    return true;
  }

  function cuisineMatches(merchant, target) {
    const needle = String(target || '').trim().toLowerCase();
    if (!needle) return true;
    const values = [];
    if (merchant.krisplus_cuisine) values.push(merchant.krisplus_cuisine);
    if (merchant.eatigo) values.push(...(liveFor(merchant)?.cuisines || []));
    if (merchant.accor_food_type) values.push(merchant.accor_food_type);
    return values.some(v => String(v).trim().toLowerCase() === needle);
  }

  function installCurrentAndCuisineLogic() {
    if (window.__sgDiningKrisplusCurrentInstalled) return;
    window.__sgDiningKrisplusCurrentInstalled = true;
    const priorCurrent = current;
    const priorPopulateCuisine = populateCuisine;
    const priorRefreshAvailability = refreshFilterAvailability;
    const priorActiveItems = activeFilterItems;
    const priorResetFilters = resetFilters;

    current = function () {
      const cuisineSelect = $id('cuisineFilter');
      const savedCuisine = krisplusSelected() && cuisineSelect?.value ? cuisineSelect.value : '';
      if (savedCuisine) cuisineSelect.value = '';
      let rows;
      try { rows = priorCurrent(); } finally { if (savedCuisine) cuisineSelect.value = savedCuisine; }
      if (!krisplusSelected()) return rows;

      const categories = selectedKrisplusCategories();
      if (categories.length) {
        rows = rows.filter(m => {
          if (!m.krisplus) return true;
          const kpMatch = categories.some(k => (m.krisplus_categories || []).includes(k));
          return kpMatch || matchesOtherSelectedProgramme(m);
        });
      }
      if (savedCuisine) rows = rows.filter(m => {
        if (m.krisplus && !(m.krisplus_categories || []).includes('dining')) return true;
        return cuisineMatches(m, savedCuisine);
      });
      return rows;
    };

    populateCuisine = function () {
      priorPopulateCuisine();
      if (!krisplusSelected()) return;
      const select = $id('cuisineFilter');
      if (!select) return;
      const previous = select.value;
      const counts = new Map();
      for (const m of payload.merchants || []) {
        if (!m.krisplus || !m.krisplus_cuisine) continue;
        counts.set(m.krisplus_cuisine, (counts.get(m.krisplus_cuisine) || 0) + 1);
      }
      for (const [name, count] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        let option = [...select.options].find(o => o.value === name);
        if (!option) {
          option = document.createElement('option');
          option.value = name;
          select.appendChild(option);
        }
        option.textContent = `${name} (${count})`;
      }
      if ([...select.options].some(o => o.value === previous)) select.value = previous;
    };

    refreshFilterAvailability = function () {
      priorRefreshAvailability();
      const section = $id('krisplusFilterSection');
      section?.classList.toggle('hidden', !krisplusSelected());
      if (!krisplusSelected()) return;
      const cuisine = $id('cuisineFilter');
      const count = (payload.merchants || []).filter(m => m.krisplus && m.krisplus_cuisine).length;
      if (cuisine && count) cuisine.disabled = false;
      const hint = $id('cuisineHint');
      if (hint) hint.textContent = count ? `Cuisine data is available for ${count} Kris+ outlets where the source category identifies a cuisine, plus selected Eatigo/Accor cuisine data.` : 'Kris+ cuisine data is not available for the current outlet extract.';
    };

    activeFilterItems = function () {
      const items = priorActiveItems();
      const categories = selectedKrisplusCategories();
      if (krisplusSelected() && categories.length) items.push({ key: 'krisplus-category', label: `Kris+: ${categories.map(k => CATEGORY_LABELS[k]).join(', ')}` });
      return items;
    };

    resetFilters = function () {
      resetKrisplusCategories();
      return priorResetFilters();
    };
  }

  function decorateCards() {
    const rows = current();
    const cards = [...document.querySelectorAll('#merchantList .merchant')];
    rows.forEach((m, i) => {
      if (!m.krisplus || !cards[i]) return;
      const card = cards[i];
      if (m.krisplus_outlet || m.outlet) {
        const h3 = card.querySelector('h3');
        if (h3 && !card.querySelector('.krisplus-outlet-name')) {
          const div = document.createElement('div');
          div.className = 'krisplus-outlet-name';
          div.textContent = `Kris+ outlet: ${m.krisplus_outlet || m.outlet}`;
          h3.insertAdjacentElement('afterend', div);
        }
      }
      if (!card.querySelector('.krisplus-note')) {
        const note = document.createElement('div');
        note.className = 'krisplus-note';
        const rate = m.krisplus_mpd != null ? `${m.krisplus_mpd} mpd` : 'participating outlet';
        const sub = m.krisplus_subcategory ? ` · ${m.krisplus_subcategory}` : '';
        note.innerHTML = `<strong>Kris+:</strong> ${esc(rate)}${esc(sub)}<span class="krisplus-quality">Kris+ is a separate payment/earn programme and does not stack with Lifestyle Credit.</span>`;
        const address = card.querySelector('.address');
        (address || card.querySelector('h3'))?.insertAdjacentElement('afterend', note);
      }
    });
  }

  function installRenderDecoration() {
    if (window.__sgDiningKrisplusRenderInstalled) return;
    window.__sgDiningKrisplusRenderInstalled = true;
    const priorRender = render;
    render = function (...args) {
      const result = priorRender(...args);
      decorateCards();
      updateKrisplusUi();
      return result;
    };
  }

  function resetKrisplusCategories() {
    const picker = $id('krisplusCategoryPicker');
    if (!picker) return;
    picker.querySelectorAll('input[data-krisplus-category]').forEach(box => { box.checked = box.dataset.krisplusCategory === 'all'; });
    picker.querySelectorAll('.krisplus-category-chip').forEach(label => label.classList.toggle('is-checked', !!label.querySelector('input')?.checked));
  }

  function updateStackAvailability() {
    const stack = $id('stackLifestyle');
    if (!stack) return;
    const hasStackable = ['ld', 'accor', 'gha', 'eatigo'].some(k => document.querySelector(`input[data-programme="${k}"]`)?.checked);
    stack.disabled = !hasStackable;
    stack.closest('.stack-lifestyle')?.classList.toggle('krisplus-disabled', !hasStackable);
    if (!hasStackable && stack.checked) stack.checked = false;
  }

  function updateKrisplusUi() {
    $id('krisplusFilterSection')?.classList.toggle('hidden', !krisplusSelected());
    updateStackAvailability();
  }

  function bindUi() {
    const categoryPicker = $id('krisplusCategoryPicker');
    categoryPicker?.addEventListener('change', event => {
      const box = event.target.closest('input[data-krisplus-category]');
      if (!box) return;
      const all = categoryPicker.querySelector('[data-krisplus-category="all"]');
      if (box.dataset.krisplusCategory === 'all' && box.checked) {
        categoryPicker.querySelectorAll('input[data-krisplus-category]').forEach(other => { if (other !== all) other.checked = false; });
      } else if (box.dataset.krisplusCategory !== 'all' && box.checked) {
        all.checked = false;
      }
      if (![...categoryPicker.querySelectorAll('input[data-krisplus-category]')].some(b => b.checked)) all.checked = true;
      categoryPicker.querySelectorAll('.krisplus-category-chip').forEach(label => label.classList.toggle('is-checked', !!label.querySelector('input')?.checked));
      updateActiveFilters();
      render(true);
    });
    $id('programmePicker')?.addEventListener('change', () => {
      setTimeout(() => { updateKrisplusUi(); populateCuisine(); refreshFilterAvailability(); render(true); }, 0);
    });
    $id('selectAllProgrammes')?.addEventListener('click', () => setTimeout(updateKrisplusUi, 0));
    $id('clearAllProgrammes')?.addEventListener('click', () => setTimeout(updateKrisplusUi, 0));
    $id('activeFilters')?.addEventListener('click', event => {
      const btn = event.target.closest('[data-clear="krisplus-category"]');
      if (!btn) return;
      resetKrisplusCategories();
      render(true);
    }, true);
  }

  async function waitForBasePayload(maxWaitMs = 15000) {
    const start = Date.now();
    while ((!payload || !Array.isArray(payload.merchants) || !payload.merchants.length) && Date.now() - start < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return !!payload?.merchants?.length;
  }

  async function loadKrisplus() {
    try {
      const parts = await Promise.all(DATA_PARTS.map(async url => {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Kris+ outlet data ${response.status}: ${url}`);
        return response.text();
      }));
      const compact = JSON.parse(parts.join(''));
      const data = expandCompact(compact);
      if (!(await waitForBasePayload())) throw new Error('base merchant dataset did not finish loading');
      mergeData(data);
      populateCuisine();
      refreshFilterAvailability();
      render(true);
      console.info('SGDining Kris+ loaded', window.SGDiningKrisplusStats);
    } catch (error) {
      console.error('Could not load Kris+ outlet data', error);
    }
  }

  injectStyles();
  injectProgrammeTile();
  injectCategoryFilter();
  installModeLogic();
  installBadges();
  installCurrentAndCuisineLogic();
  installRenderDecoration();
  bindUi();
  updateKrisplusUi();
  loadKrisplus();
})();
