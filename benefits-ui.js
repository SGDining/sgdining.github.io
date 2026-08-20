(() => {
  const baseModeMatch = modeMatch;
  const baseListHintForMode = listHintForMode;
  const baseRender = render;

  const PROGRAMMES = ['ld', 'lc', 'accor', 'gha', 'eatigo'];
  const FLAG_FOR = { ld: 'ld', lc: 'lc', accor: 'accor', gha: 'gha', eatigo: 'eatigo' };
  const SINGLE_MODE = { ld: 'ld', lc: 'lc', accor: 'accor', gha: 'gha', eatigo: 'eatigo' };
  const STACK_MODE = { ld: 'both', accor: 'accorlc', gha: 'ghalc', eatigo: 'eatigolc' };

  const picker = $('programmePicker');
  const stackBox = $('stackLifestyle');
  const selectAllBtn = $('selectAllProgrammes');
  const clearAllBtn = $('clearAllProgrammes');
  const compatSelect = $('benefitFilter');

  function programmeBoxes() {
    return [...document.querySelectorAll('input[data-programme]')];
  }

  function boxFor(key) {
    return document.querySelector(`input[data-programme="${key}"]`);
  }

  function selectedProgrammes() {
    return programmeBoxes().filter(box => box.checked).map(box => box.dataset.programme);
  }

  function nonLifestyleSelected() {
    return selectedProgrammes().filter(key => key !== 'lc');
  }

  function updatePickerVisuals() {
    programmeBoxes().forEach(box => {
      const tile = box.closest('.programme-tile');
      if (tile) tile.classList.toggle('is-checked', box.checked);
    });
    if (stackBox) {
      const panel = stackBox.closest('.stack-lifestyle');
      if (panel) panel.classList.toggle('is-checked', stackBox.checked);
    }
  }

  function syncCompatibilityMode() {
    let selected = selectedProgrammes();
    let mode = 'none';

    if (stackBox?.checked) {
      const lc = boxFor('lc');
      if (lc && !lc.checked) lc.checked = true;
      selected = selectedProgrammes();
      const base = selected.filter(key => key !== 'lc');
      if (!base.length) mode = 'lc';
      else if (base.length === 1) mode = STACK_MODE[base[0]] || 'multi';
      else mode = 'multi';
    } else if (selected.length === 1) {
      mode = SINGLE_MODE[selected[0]] || 'multi';
    } else if (selected.length > 1) {
      mode = 'multi';
    }

    compatSelect.value = mode;
    updatePickerVisuals();
    return mode;
  }

  function selectedLabel() {
    const names = {
      ld: 'Amex LD',
      lc: 'Lifestyle Credit',
      accor: 'Accor+',
      gha: 'GHA',
      eatigo: 'Eatigo'
    };
    return selectedProgrammes().map(key => names[key]).join(', ');
  }

  modeMatch = function (merchant, mode) {
    if (mode === 'none') return false;
    if (mode !== 'multi') return baseModeMatch(merchant, mode);

    const selected = selectedProgrammes();
    const selectedNonLc = selected.filter(key => key !== 'lc');

    if (stackBox?.checked) {
      if (!selectedNonLc.length) return !!merchant.lc;
      return !!merchant.lc && selectedNonLc.some(key => !!merchant[FLAG_FOR[key]]);
    }

    return selected.some(key => !!merchant[FLAG_FOR[key]]);
  };

  listHintForMode = function (mode) {
    if (mode === 'none') return 'Select one or more dining programmes above.';
    if (mode === 'multi') {
      if (stackBox?.checked) {
        return `Showing Lifestyle Credit outlets that also accept at least one selected programme: ${selectedLabel()}.`;
      }
      return `Showing outlets from any selected programme: ${selectedLabel()}.`;
    }
    return baseListHintForMode(mode);
  };

  function programmeLinks(merchant) {
    const links = [];
    if (merchant.ld && merchant.ld_website_url) links.push({ label: 'Love Dining', url: merchant.ld_website_url });
    if (merchant.gha && merchant.gha_website_url) links.push({ label: 'GHA', url: merchant.gha_website_url });
    if (merchant.accor && (merchant.accor_website_url || merchant.accor_url)) {
      links.push({ label: 'Accor+', url: merchant.accor_website_url || merchant.accor_url });
    }
    if (merchant.eatigo && merchant.eatigo_url) links.push({ label: 'Eatigo', url: merchant.eatigo_url });
    return links;
  }

  function decorateMultiMode() {
    if (compatSelect.value !== 'multi') return;
    const rows = current();
    const mappedRows = rows.filter(m => m.lat != null && m.lng != null);

    markers.forEach((marker, index) => {
      const merchant = mappedRows[index];
      if (!merchant) return;
      const links = programmeLinks(merchant);
      const linksHtml = links.length
        ? `<br><span class="multi-programme-popup-links">${links.map(item => `<a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.label)} ↗</a>`).join(' · ')}</span>`
        : '';
      marker.unbindTooltip();
      marker.unbindPopup();
      marker.off('click');
      marker.bindPopup(`<strong>${esc(merchant.accor_name || merchant.name)}</strong><br>${esc(merchant.address || '')}<br><small>${esc(benefitText(merchant))}</small>${linksHtml}`);
    });

    const cards = [...document.querySelectorAll('#merchantList .merchant')];
    rows.forEach((merchant, index) => {
      const actions = cards[index]?.querySelector('.action-links');
      if (!actions) return;
      for (const item of programmeLinks(merchant)) {
        if (item.label === 'Eatigo') continue;
        if ([...actions.querySelectorAll('a')].some(a => a.href === item.url)) continue;
        const link = document.createElement('a');
        link.className = 'multi-programme-link';
        link.href = item.url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = `${item.label} ↗`;
        actions.prepend(link);
      }
    });
  }

  render = function (...args) {
    const result = baseRender(...args);
    decorateMultiMode();
    updatePickerVisuals();
    return result;
  };

  function applyProgrammeState() {
    const mode = syncCompatibilityMode();
    const event = new Event('change', { bubbles: true });
    compatSelect.dispatchEvent(event);
    if (mode === 'none') render(true);
  }

  picker?.addEventListener('change', event => {
    const target = event.target.closest('input[data-programme]');
    if (!target) return;
    if (target.dataset.programme === 'lc' && !target.checked && stackBox?.checked) {
      stackBox.checked = false;
    }
    applyProgrammeState();
  });

  stackBox?.addEventListener('change', () => {
    if (stackBox.checked) {
      const lc = boxFor('lc');
      if (lc) lc.checked = true;
    }
    applyProgrammeState();
  });

  selectAllBtn?.addEventListener('click', () => {
    programmeBoxes().forEach(box => { box.checked = true; });
    applyProgrammeState();
  });

  clearAllBtn?.addEventListener('click', () => {
    programmeBoxes().forEach(box => { box.checked = false; });
    if (stackBox) stackBox.checked = false;
    applyProgrammeState();
  });

  syncCompatibilityMode();
})();
