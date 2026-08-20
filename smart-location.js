(() => {
  let searchActsAsOrigin = false;
  let resolving = false;

  const baseCurrent = current;
  current = function () {
    const search = $('searchBox');
    if (!searchActsAsOrigin || !search) return baseCurrent();
    const value = search.value;
    search.value = '';
    try {
      return baseCurrent();
    } finally {
      search.value = value;
    }
  };

  async function resolveSearchAsOrigin() {
    if (resolving) return;
    const radius = Number($('radiusFilter')?.value || 0);
    if (radius <= 0) {
      searchActsAsOrigin = false;
      return;
    }

    const query = $('searchBox')?.value.trim() || '';
    if (query) {
      resolving = true;
      searchActsAsOrigin = true;
      const placeInput = $('placeInput');
      if (placeInput) placeInput.value = query;
      try {
        await setPlace();
        if (originPos) {
          $('placeState').textContent = `Searching within ${radius} km of ${originLabel || query}`;
        }
      } finally {
        resolving = false;
      }
      return;
    }

    searchActsAsOrigin = false;
    if (!originPos) useMyLocation();
    else render(true);
  }

  document.addEventListener('click', event => {
    if (!event.target.closest('#findBtn')) return;
    if (Number($('radiusFilter')?.value || 0) <= 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    resolveSearchAsOrigin();
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.target?.id !== 'searchBox') return;
    if (Number($('radiusFilter')?.value || 0) <= 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    resolveSearchAsOrigin();
  }, true);

  document.addEventListener('change', event => {
    if (event.target?.id !== 'radiusFilter') return;
    const radius = Number(event.target.value || 0);
    if (radius <= 0) {
      searchActsAsOrigin = false;
      updateOriginVisual();
      render(true);
      return;
    }
    event.stopImmediatePropagation();
    resolveSearchAsOrigin();
  }, true);

  $('searchBox')?.addEventListener('input', () => {
    if (Number($('radiusFilter')?.value || 0) <= 0) searchActsAsOrigin = false;
  });

  const radius = $('radiusFilter');
  if (radius) radius.disabled = false;
  const state = $('placeState');
  if (state) state.textContent = 'Optional: enter a location here. With Distance selected, the main search box can also be used as the centre point.';
})();
