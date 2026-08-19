(() => {
  const originalRender = render;

  function programmeUrlFor(m, mode) {
    if (mode === 'ld' || mode === 'both') return m.ld_website_url || null;
    if (mode === 'gha' || mode === 'ghalc') return m.gha_website_url || null;
    if (mode === 'accor' || mode === 'accorlc') return m.accor_website_url || null;
    return null;
  }

  function programmeLabel(mode) {
    if (mode === 'ld' || mode === 'both') return 'official Love Dining website';
    if (mode === 'gha' || mode === 'ghalc') return 'official GHA venue website';
    if (mode === 'accor' || mode === 'accorlc') return 'official Accor venue website';
    return 'official website';
  }

  function applyProgrammeLinks() {
    const mode = $('benefitFilter').value;
    if (modeIsEatigo(mode)) return;

    const rows = current();
    const mappedRows = rows.filter(m => m.lat != null && m.lng != null);

    markers.forEach((mk, index) => {
      const m = mappedRows[index];
      if (!m) return;
      const url = programmeUrlFor(m, mode);
      if (!url) return;

      mk.unbindPopup();
      mk.off('click');
      mk.on('click', () => window.open(url, '_blank', 'noopener'));
      mk.bindTooltip(
        `<strong>${esc(m.name)}</strong><br><small>Click to open ${esc(programmeLabel(mode))} ↗</small>`,
        { direction: 'top', opacity: 0.97 }
      );
      const el = mk.getElement();
      if (el) el.style.cursor = 'pointer';
    });

    const cards = [...document.querySelectorAll('#merchantList .merchant')];
    rows.forEach((m, index) => {
      const url = programmeUrlFor(m, mode);
      if (!url) return;
      const links = cards[index]?.querySelector('.action-links');
      if (!links || links.querySelector('.program-website-link')) return;
      const a = document.createElement('a');
      a.className = 'program-website-link';
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Website ↗';
      links.prepend(a);
    });
  }

  render = function (...args) {
    const result = originalRender(...args);
    applyProgrammeLinks();
    return result;
  };
})();
