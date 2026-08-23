(() => {
  const baseModeMatch = modeMatch;
  const baseListHintForMode = listHintForMode;
  const baseRender = render;

  const PROGRAMMES = ['ld', 'lc', 'accor', 'gha', 'eatigo', 'krisplus'];
  const FLAG_FOR = { ld: 'ld', lc: 'lc', accor: 'accor', gha: 'gha', eatigo: 'eatigo', krisplus: 'krisplus' };
  const SINGLE_MODE = { ld: 'ld', lc: 'lc', accor: 'accor', gha: 'gha', eatigo: 'eatigo', krisplus: 'krisplus' };
  const STACK_MODE = { ld: 'both', accor: 'accorlc', gha: 'ghalc', eatigo: 'eatigolc' };

  const picker = $('programmePicker');
  const stackBox = $('stackLifestyle');
  const selectAllBtn = $('selectAllProgrammes');
  const clearAllBtn = $('clearAllProgrammes');
  const compatSelect = $('benefitFilter');

  function programmeBoxes() { return [...document.querySelectorAll('input[data-programme]')]; }
  function boxFor(key) { return document.querySelector(`input[data-programme="${key}"]`); }
  function selectedProgrammes() { return programmeBoxes().filter(box => box.checked).map(box => box.dataset.programme); }
  function nonLifestyleSelected() { return selectedProgrammes().filter(key => key !== 'lc' && key !== 'krisplus'); }

  function updatePickerVisuals() {
    programmeBoxes().forEach(box => box.closest('.programme-tile')?.classList.toggle('is-checked', box.checked));
    stackBox?.closest('.stack-lifestyle')?.classList.toggle('is-checked', stackBox.checked);
    document.body.classList.toggle('krisplus-selected', !!boxFor('krisplus')?.checked);
  }

  function syncCompatibilityMode() {
    let selected = selectedProgrammes();
    let mode = 'none';
    if (stackBox?.checked) {
      const lc = boxFor('lc'); if (lc && !lc.checked) lc.checked = true;
      // Kris+ is deliberately excluded from Lifestyle Credit stacking because payment is to KrisPay.
      const base = selectedProgrammes().filter(key => key !== 'lc' && key !== 'krisplus');
      if (!base.length) mode = selected.includes('krisplus') ? 'multi' : 'lc';
      else if (base.length === 1 && !selected.includes('krisplus')) mode = STACK_MODE[base[0]] || 'multi';
      else mode = 'multi';
    } else if (selected.length === 1) mode = SINGLE_MODE[selected[0]] || 'multi';
    else if (selected.length > 1) mode = 'multi';
    compatSelect.value = mode;
    updatePickerVisuals();
    return mode;
  }

  function selectedLabel() {
    const names = { ld:'Amex LD', lc:'Lifestyle Credit', accor:'Accor+', gha:'GHA', eatigo:'Eatigo', krisplus:'Kris+' };
    return selectedProgrammes().map(key => names[key]).join(', ');
  }

  modeMatch = function (merchant, mode) {
    if (mode === 'none') return false;
    if (mode === 'krisplus') return !!merchant.krisplus;
    if (mode !== 'multi') return baseModeMatch(merchant, mode);
    const selected = selectedProgrammes();
    const selectedNonLc = selected.filter(key => key !== 'lc' && key !== 'krisplus');
    const krisSelected = selected.includes('krisplus');
    if (stackBox?.checked) {
      // Stack applies only to stackable dining programmes. Kris+ remains an independent OR result.
      const stackMatch = selectedNonLc.length ? (!!merchant.lc && selectedNonLc.some(key => !!merchant[FLAG_FOR[key]])) : (!!merchant.lc && !krisSelected);
      return stackMatch || (krisSelected && !!merchant.krisplus);
    }
    return selected.some(key => !!merchant[FLAG_FOR[key]]);
  };

  listHintForMode = function (mode) {
    if (mode === 'none') return 'Select one or more programmes above.';
    if (mode === 'krisplus') return 'Kris+ merchants. Kris+ payments are treated as separate from Lifestyle Credit and are not shown as stackable.';
    if (mode === 'multi') {
      if (stackBox?.checked) return `Showing Lifestyle Credit intersections for stackable selected programmes, plus Kris+ independently when selected: ${selectedLabel()}.`;
      return `Showing outlets from any selected programme: ${selectedLabel()}.`;
    }
    return baseListHintForMode(mode);
  };

  function programmeLinks(merchant) {
    const links=[];
    if(merchant.ld&&merchant.ld_website_url)links.push({label:'Love Dining',url:merchant.ld_website_url});
    if(merchant.gha&&merchant.gha_website_url)links.push({label:'GHA',url:merchant.gha_website_url});
    if(merchant.accor&&(merchant.accor_website_url||merchant.accor_url))links.push({label:'Accor+',url:merchant.accor_website_url||merchant.accor_url});
    if(merchant.eatigo&&merchant.eatigo_url)links.push({label:'Eatigo',url:merchant.eatigo_url});
    if(merchant.krisplus&&merchant.krisplus_url)links.push({label:'Kris+',url:merchant.krisplus_url});
    return links;
  }

  function decorateMultiMode(){
    if(compatSelect.value!=='multi')return;
    const rows=current(),mappedRows=rows.filter(m=>m.lat!=null&&m.lng!=null);
    markers.forEach((marker,index)=>{const merchant=mappedRows[index];if(!merchant)return;const links=programmeLinks(merchant);const linksHtml=links.length?`<br><span class="multi-programme-popup-links">${links.map(item=>`<a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.label)} ↗</a>`).join(' · ')}</span>`:'';marker.unbindTooltip();marker.unbindPopup();marker.off('click');marker.bindPopup(`<strong>${esc(merchant.accor_name||merchant.name)}</strong><br>${esc(merchant.address||'')}<br><small>${esc(benefitText(merchant))}</small>${linksHtml}`);});
    const cards=[...document.querySelectorAll('#merchantList .merchant')];rows.forEach((merchant,index)=>{const actions=cards[index]?.querySelector('.action-links');if(!actions)return;for(const item of programmeLinks(merchant)){if(item.label==='Eatigo')continue;if([...actions.querySelectorAll('a')].some(a=>a.href===item.url))continue;const link=document.createElement('a');link.className='multi-programme-link';link.href=item.url;link.target='_blank';link.rel='noopener';link.textContent=`${item.label} ↗`;actions.prepend(link);}});
  }

  render=function(...args){const result=baseRender(...args);decorateMultiMode();updatePickerVisuals();return result;};
  function applyProgrammeState(){const mode=syncCompatibilityMode();compatSelect.dispatchEvent(new Event('change',{bubbles:true}));if(mode==='none')render(true);}
  picker?.addEventListener('change',event=>{const target=event.target.closest('input[data-programme]');if(!target)return;if(target.dataset.programme==='lc'&&!target.checked&&stackBox?.checked)stackBox.checked=false;applyProgrammeState();});
  stackBox?.addEventListener('change',()=>{if(stackBox.checked){const lc=boxFor('lc');if(lc)lc.checked=true;}applyProgrammeState();});
  selectAllBtn?.addEventListener('click',()=>{programmeBoxes().forEach(box=>{box.checked=true;});applyProgrammeState();});
  clearAllBtn?.addEventListener('click',()=>{programmeBoxes().forEach(box=>{box.checked=false;});if(stackBox)stackBox.checked=false;applyProgrammeState();});
  syncCompatibilityMode();
})();