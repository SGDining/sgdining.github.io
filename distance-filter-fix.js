(() => {
  const radius = document.getElementById('radiusFilter');
  const placeInput = document.getElementById('placeInput');
  const placeState = document.getElementById('placeState');
  if (!radius || !placeInput) return;

  // Distance is a common filter and must always remain selectable.
  const keepDistanceEnabled = () => {
    if (radius.disabled) radius.disabled = false;
  };
  keepDistanceEnabled();
  new MutationObserver(keepDistanceEnabled).observe(radius, {
    attributes: true,
    attributeFilter: ['disabled']
  });

  async function ensureDistanceOrigin() {
    if (typeof originPos !== 'undefined' && originPos) return true;

    const typedPlace = placeInput.value.trim();
    if (typedPlace) {
      if (placeState) placeState.textContent = `Using “${typedPlace}” as the distance origin…`;
      await setPlace();
      if (typeof originPos !== 'undefined' && originPos) return true;
      radius.value = '0';
      keepDistanceEnabled();
      return false;
    }

    if (!navigator.geolocation) {
      radius.value = '0';
      keepDistanceEnabled();
      if (placeState) placeState.textContent = 'Current location is unavailable. Enter a nearby location, then choose a distance.';
      alert('Current location is not supported by this browser. Enter a nearby location and choose the distance again.');
      return false;
    }

    if (placeState) placeState.textContent = 'Getting your current location for the selected distance…';
    return await new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setOrigin(pos.coords.latitude, pos.coords.longitude, 'My current location');
          keepDistanceEnabled();
          resolve(true);
        },
        err => {
          radius.value = '0';
          keepDistanceEnabled();
          if (placeState) placeState.textContent = 'Location permission was not available. Enter a nearby location or allow location access.';
          alert('To use a distance without entering a place, allow current-location access. Otherwise enter a nearby location and choose the distance again.');
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  // app.js already renders on change. This listener supplies the missing origin,
  // then setOrigin/setPlace performs the final filtered render.
  radius.addEventListener('change', async () => {
    keepDistanceEnabled();
    if (Number(radius.value || 0) <= 0) return;
    await ensureDistanceOrigin();
  });

  // Reset/clear in app.js historically disabled this control. Re-enable it
  // after those handlers run so the user can immediately choose another radius.
  for (const id of ['resetFilters']) {
    document.getElementById(id)?.addEventListener('click', () => setTimeout(keepDistanceEnabled, 0));
  }
  document.getElementById('activeFilters')?.addEventListener('click', () => setTimeout(keepDistanceEnabled, 0));
})();
