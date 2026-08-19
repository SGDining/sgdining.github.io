(() => {
  const baseModeMatch = modeMatch;
  const baseCurrent = current;
  const baseBadges = badges;
  const baseBenefitText = benefitText;
  const baseListHintForMode = listHintForMode;
  const basePopulateCuisine = populateCuisine;
  const baseRefreshFilterAvailability = refreshFilterAvailability;
  const baseActiveFilterItems = activeFilterItems;
  const baseRender = render;

  const modeIsAccor = (mode = $('benefitFilter').value) => mode === 'accor' || mode === 'accorlc';
  const accorDisplayName = m => modeIsAccor() && m.accor_name ? m.accor_name : m.name;

  modeMatch = function (m, mode) {
    if (mode === 'accor') return !!m.accor;
    if (mode === 'accorlc') return !!m.accor && !!m.lc;
    return baseModeMatch(m, mode);
  };

  current = function () {
    let rows = baseCurrent();
    if (modeIsAccor()) {
      const cuisine = $('cuisineFilter').value;
      if (cuisine) rows = rows.filter(m => m.accor_food_type === cuisine);
      rows.sort((a, b) => {
        if ($('sortOrder').value === 'nearest' && originPos) {
          const d = (a._distance ?? 1e9) - (b._distance ?? 1e9);
          if (d) return d;
        }
        return String(a.accor_name || a.name).localeCompare(String(b.accor_name || b.name));
      });
    }
    return rows;
  };

  badges = function (m) {
    const out = [];
    if (m.ld && m.lc) out.push('<span class="badge both">LD + LC</span>');
    else {
      if (m.ld) out.push('<span class="badge ld">LOVE DINING</span>');
      if (m.lc && !m.gha && !m.eatigo && !m.accor) out.push('<span class="badge lc">LIFESTYLE CREDIT</span>');
    }
    if (m.gha && m.lc) out.push('<span class="badge ghalc">GHA + LC</span>');
    else if (m.gha) out.push('<span class="badge gha">GHA DINING</span>');
    if (m.accor && m.lc) out.push('<span class="badge accorlc">ACCOR + LC</span>');
    else if (m.accor) out.push('<span class="badge accor">ACCOR</span>');
    if (m.eatigo && m.lc) out.push('<span class="badge eatigolc">EATIGO + LC</span>');
    else if (m.eatigo) out.push('<span class="badge eatigo">EATIGO</span>');
    out.push(`<span class="badge cat">${esc(m.category.toUpperCase())}</span>`);
    return out.join('');
  };

  benefitText = function (m) {
    const value = baseBenefitText(m);
    if (!m.accor) return value;
    return [value, 'ALL Accor+ Explorer'].filter(Boolean).join(' + ');
  };

  listHintForMode = function (mode) {
    if (mode === 'accor') return 'Eligible Singapore ALL Accor+ Explorer dining venues from Accor’s official directory, with current exclusions and variations applied.';
    if (mode === 'accorlc') return 'Accor+ dining venues that also match an AMEX Lifestyle Credit outlet at the same location.';
    return baseListHintForMode(mode);
  };

  populateCuisine = function () {
    if (!modeIsAccor()) return basePopulateCuisine();
    const sel = $('cuisineFilter');
    const currentValue = sel.value;
    const counts = new Map();
    for (const m of payload.merchants || []) {
      if (!m.accor || !m.accor_food_type) continue;
      counts.set(m.accor_food_type, (counts.get(m.accor_food_type) || 0) + 1);
    }
    sel.innerHTML = '<option value="">All cuisines</option>';
    for (const [name, count] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = `${name} (${count})`;
      sel.appendChild(option);
    }
    sel.value = [...sel.options].some(o => o.value === currentValue) ? currentValue : '';
  };

  refreshFilterAvailability = function () {
    baseRefreshFilterAvailability();
    if (!modeIsAccor()) return;
    const count = (payload.merchants || []).filter(m => m.accor && m.accor_food_type).length;
    $('cuisineFilter').disabled = !count;
    $('cuisineHint').textContent = count ? `Cuisine data from Accor for ${count} venues.` : 'Cuisine data unavailable for Accor venues.';
  };

  activeFilterItems = function () {
    const items = baseActiveFilterItems();
    if (modeIsAccor() && $('cuisineFilter').value && !items.some(x => x.key === 'cuisine')) {
      items.unshift({ key: 'cuisine', label: $('cuisineFilter').value });
    }
    return items;
  };

  function accorNote(m) {
    if (!m.accor) return '';
    const benefit = m.accor_benefit_note || '30% off food · 15% off beverages';
    const meta = [];
    if (m.accor_food_type) meta.push(m.accor_food_type);
    if (m.accor_average_price != null) meta.push(`Avg ${m.accor_currency || 'SGD'} ${m.accor_average_price}`);
    const variation = m.accor_variation ? '<strong> Venue variation applies.</strong>' : '';
    return `<div class="accor-note"><strong>ALL Accor+ Explorer:</strong> ${esc(benefit)}${variation}${meta.length ? `<small>${esc(meta.join(' · '))}</small>` : ''}<small>Blackout dates and terms can apply; confirm with Accor before dining.</small></div>`;
  }

  function decorateAccorCards() {
    if (!modeIsAccor()) return;
    const rows = current();
    const cards = [...document.querySelectorAll('#merchantList .merchant')];
    rows.forEach((m, index) => {
      const card = cards[index];
      if (!card) return;
      const h3 = card.querySelector('h3');
      if (h3 && m.accor_name) h3.textContent = m.accor_name;
      if (m.accor && !card.querySelector('.accor-note')) {
        const actions = card.querySelector('.merchant-actions');
        if (actions) actions.insertAdjacentHTML('beforebegin', accorNote(m));
      }
    });
  }

  render = function (...args) {
    const result = baseRender(...args);
    decorateAccorCards();
    return result;
  };

  $('benefitFilter').addEventListener('change', () => {
    if (!modeIsAccor()) return;
    $('categoryFilter').value = 'dining';
    populateCuisine();
    refreshFilterAvailability();
    render(true);
  });
})();
