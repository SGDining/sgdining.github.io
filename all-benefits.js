(() => {
  const baseModeMatch = modeMatch;
  const baseListHintForMode = listHintForMode;
  const baseRender = render;

  const modeIsAllBenefits = (mode = $('benefitFilter').value) =>
    mode === 'allbenefits' || mode === 'allbenefitslc';

  modeMatch = function (m, mode) {
    const hasDiningBenefit = !!(m.ld || m.gha || m.accor || m.eatigo);
    if (mode === 'allbenefits') return hasDiningBenefit;
    if (mode === 'allbenefitslc') return hasDiningBenefit && !!m.lc;
    return baseModeMatch(m, mode);
  };

  listHintForMode = function (mode) {
    if (mode === 'allbenefits') {
      return 'All nearby dining benefits across Love Dining, GHA, Accor+ and Eatigo. Distance defaults to 1 km; change it in Filters anytime.';
    }
    if (mode === 'allbenefitslc') {
      return 'Nearby outlets with Lifestyle Credit plus at least one of Love Dining, GHA, Accor+ or Eatigo. Distance defaults to 1 km.';
    }
    return baseListHintForMode(mode);
  };

  function programmeLinks(m) {
    const links = [];
    if (m.ld && m.ld_website_url) links.push({ label: 'Love Dining', url: m.ld_website_url });
    if (m.gha && m.gha_website_url) links.push({ label: 'GHA', url: m.gha_website_url });
    if (m.accor && (m.accor_website_url || m.accor_url)) links.push({ label: 'Accor+', url: m.accor_website_url || m.accor_url });
    if (m.eatigo && m.eatigo_url) links.push({ label: 'Eatigo', url: m.eatigo_url });
    return links;
  }

  function decorateAllBenefits() {
    if (!modeIsAllBenefits()) return;
    const rows = current();
    const mappedRows = rows.filter(m => m.lat != null && m.lng != null);

    markers.forEach((mk, index) => {
      const m = mappedRows[index];
      if (!m) return;
      const links = programmeLinks(m);
      const linkHtml = links.length
        ? `<br><span class="all-benefit-popup-links">${links.map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)} ↗</a>`).join(' · ')}</span>`
        : '';
      mk.unbindTooltip();
      mk.unbindPopup();
      mk.off('click');
      mk.bindPopup(`<strong>${esc(m.accor_name || m.name)}</strong><br>${esc(m.address || '')}<br><small>${esc(benefitText(m))}</small>${linkHtml}`);
    });

    const cards = [...document.querySelectorAll('#merchantList .merchant')];
    rows.forEach((m, index) => {
      const links = cards[index]?.querySelector('.action-links');
      if (!links) return;
      for (const item of programmeLinks(m)) {
        if (item.label === 'Eatigo') continue;
        if ([...links.querySelectorAll('a')].some(a => a.href === item.url)) continue;
        const a = document.createElement('a');
        a.className = 'all-benefit-program-link';
        a.href = item.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = `${item.label} ↗`;
        links.prepend(a);
      }
    });
  }

  render = function (...args) {
    const result = baseRender(...args);
    decorateAllBenefits();
    return result;
  };

  $('benefitFilter').addEventListener('change', () => {
    if (!modeIsAllBenefits()) return;

    $('categoryFilter').value = 'dining';
    $('cuisineFilter').value = '';
    $('discountFilter').value = '0';
    $('timeFilter').value = 'all';

    $('radiusFilter').value = '1';
    refreshFilterAvailability();

    if (originPos) {
      $('radiusFilter').disabled = false;
      $('sortOrder').value = 'nearest';
      updateOriginVisual();
      updateActiveFilters();
      render(true);
      return;
    }

    useMyLocation();
  });
})();
