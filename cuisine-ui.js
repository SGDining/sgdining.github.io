(() => {
  const baseCurrent = current;
  const basePopulateCuisine = populateCuisine;
  const baseRefreshFilterAvailability = refreshFilterAvailability;
  const baseActiveFilterItems = activeFilterItems;

  const cuisineSelect = $('cuisineFilter');

  function selectedProgramme(key) {
    const box = document.querySelector(`input[data-programme="${key}"]`);
    if (box) return !!box.checked;
    const mode = $('benefitFilter')?.value || '';
    if (key === 'eatigo') return mode === 'eatigo' || mode === 'eatigolc';
    if (key === 'accor') return mode === 'accor' || mode === 'accorlc';
    return false;
  }

  function isMultiMode() {
    return $('benefitFilter')?.value === 'multi';
  }

  function eatigoCuisineFor(merchant) {
    if (!merchant?.eatigo) return [];
    return liveFor(merchant)?.cuisines || [];
  }

  function accorCuisineFor(merchant) {
    if (!merchant?.accor || !merchant.accor_food_type) return [];
    return [String(merchant.accor_food_type)];
  }

  function merchantMatchesCuisine(merchant, cuisine) {
    if (!cuisine) return true;
    const target = String(cuisine).trim().toLowerCase();
    const reliable = [...eatigoCuisineFor(merchant), ...accorCuisineFor(merchant)]
      .map(value => String(value).trim().toLowerCase())
      .filter(Boolean);
    return reliable.includes(target);
  }

  function multiCuisineEntries() {
    const counts = new Map();
    const useEatigo = selectedProgramme('eatigo');
    const useAccor = selectedProgramme('accor');

    if (useEatigo) {
      for (const item of eatigoLive.cuisine_types || []) {
        const name = String(item?.name || '').trim();
        if (!name) continue;
        counts.set(name, (counts.get(name) || 0) + Number(item.count || 0));
      }
    }

    if (useAccor) {
      for (const merchant of payload.merchants || []) {
        if (!merchant.accor || !merchant.accor_food_type) continue;
        const name = String(merchant.accor_food_type).trim();
        if (!name) continue;
        counts.set(name, (counts.get(name) || 0) + 1);
      }
    }

    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }

  current = function () {
    let rows = baseCurrent();
    if (!isMultiMode()) return rows;
    const cuisine = cuisineSelect?.value || '';
    if (!cuisine) return rows;
    return rows.filter(merchant => merchantMatchesCuisine(merchant, cuisine));
  };

  populateCuisine = function () {
    if (!isMultiMode()) return basePopulateCuisine();
    if (!cuisineSelect) return;

    const previous = cuisineSelect.value;
    const entries = multiCuisineEntries();
    cuisineSelect.innerHTML = '<option value="">All cuisines</option>';
    for (const [name, count] of entries) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = count > 0 ? `${name} (${count})` : name;
      cuisineSelect.appendChild(option);
    }
    cuisineSelect.value = [...cuisineSelect.options].some(option => option.value === previous) ? previous : '';
  };

  refreshFilterAvailability = function () {
    baseRefreshFilterAvailability();
    if (!isMultiMode() || !cuisineSelect) return;

    const useEatigo = selectedProgramme('eatigo');
    const useAccor = selectedProgramme('accor');
    const eatigoCount = useEatigo ? Number(eatigoLive.restaurants_with_cuisine || 0) : 0;
    const accorCount = useAccor
      ? (payload.merchants || []).filter(merchant => merchant.accor && merchant.accor_food_type).length
      : 0;
    const available = eatigoCount > 0 || accorCount > 0;

    cuisineSelect.disabled = !available;
    const sources = [];
    if (eatigoCount > 0) sources.push(`Eatigo (${eatigoCount} outlets)`);
    if (accorCount > 0) sources.push(`Accor (${accorCount} venues)`);

    if ($('cuisineHint')) {
      $('cuisineHint').textContent = available
        ? `Cuisine data available from ${sources.join(' and ')}. Choosing a cuisine excludes outlets without reliable cuisine data.`
        : 'Cuisine is available when Eatigo or Accor is selected because those programmes provide reliable cuisine data.';
    }
  };

  activeFilterItems = function () {
    const items = baseActiveFilterItems();
    if (isMultiMode() && cuisineSelect?.value && !items.some(item => item.key === 'cuisine')) {
      items.unshift({ key: 'cuisine', label: cuisineSelect.value });
    }
    return items;
  };

  function refreshCuisineUi() {
    populateCuisine();
    refreshFilterAvailability();
    render(true);
  }

  $('benefitFilter')?.addEventListener('change', () => {
    setTimeout(refreshCuisineUi, 0);
  });

  cuisineSelect?.addEventListener('change', () => {
    if (isMultiMode()) render(true);
  });

  // The data load is asynchronous; refresh once it has populated the datasets.
  setTimeout(() => {
    populateCuisine();
    refreshFilterAvailability();
  }, 800);
})();
