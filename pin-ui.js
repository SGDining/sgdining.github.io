(() => {
  const baseRender = render;

  const COLORS = {
    ld: '#29b6d8',
    lc: '#d4a63a',
    accor: '#7b61ff',
    gha: '#c85a5a',
    eatigo: '#e8782e',
    dark: '#0b1d33'
  };

  const MODE_URL = {
    ld: m => m.ld_website_url || null,
    both: m => m.ld_website_url || null,
    gha: m => m.gha_website_url || null,
    ghalc: m => m.gha_website_url || null,
    accor: m => m.accor_website_url || m.accor_url || null,
    accorlc: m => m.accor_website_url || m.accor_url || null
  };

  const MODE_LABEL = {
    ld: 'Love Dining',
    both: 'Love Dining',
    gha: 'GHA',
    ghalc: 'GHA',
    accor: 'Accor+',
    accorlc: 'Accor+'
  };

  function selected(key) {
    const box = document.querySelector(`input[data-programme="${key}"]`);
    if (box) return box.checked;
    const mode = $('benefitFilter').value;
    if (key === 'eatigo') return mode === 'eatigo' || mode === 'eatigolc';
    return true;
  }

  function programmeLinks(m) {
    const links = [];
    if (m.ld && m.ld_website_url) links.push({ label: 'Love Dining', url: m.ld_website_url });
    if (m.gha && m.gha_website_url) links.push({ label: 'GHA', url: m.gha_website_url });
    if (m.accor && (m.accor_website_url || m.accor_url)) links.push({ label: 'Accor+', url: m.accor_website_url || m.accor_url });
    if (m.eatigo && m.eatigo_url) links.push({ label: 'Eatigo', url: m.eatigo_url });
    return links;
  }

  function programmeNames(m) {
    const names = [];
    if (m.ld) names.push('Love Dining');
    if (m.lc) names.push('Lifestyle Credit');
    if (m.accor) names.push('Accor+');
    if (m.gha) names.push('GHA');
    if (m.eatigo) names.push('Eatigo');
    return names;
  }

  function eatigoDisplay(m) {
    if (!m.eatigo || !selected('eatigo')) return { live: null, slots: [], best: null };
    const live = liveFor(m);
    if (!live) return { live: null, slots: [], best: null };

    const mode = $('benefitFilter').value;
    const dedicated = mode === 'eatigo' || mode === 'eatigolc';
    let slots = dedicated ? (m._slots || []) : (live.slots || []);

    // If another wrapper supplied an empty slot array, fall back to the live
    // Eatigo snapshot instead of degrading the marker to a generic '+' pin.
    if (!slots.length && Array.isArray(live.slots)) slots = live.slots;

    const computedBest = bestForSlots(slots);
    const snapshotBest = Number(live.best_today);
    const best = computedBest != null
      ? computedBest
      : (Number.isFinite(snapshotBest) && snapshotBest > 0 ? snapshotBest : null);

    return { live, slots, best };
  }

  function benefitsHeader(m) {
    const names = programmeNames(m);
    if (names.length <= 1) return '';
    return `<div class="multi-hover-benefits" style="margin:0 0 10px;padding:8px 10px;border-radius:8px;background:rgba(39,105,150,.18);color:#dbefff;font-size:12px;font-weight:700;line-height:1.35"><span style="color:#8fcfff">Benefits:</span> ${esc(names.join(' · '))}</div>`;
  }

  function richEatigoPanel(m, eatigo) {
    const enriched = { ...m, _live: eatigo.live, _slots: eatigo.slots, _best: eatigo.best };
    const base = tooltipForEatigo(enriched);
    const header = benefitsHeader(m);
    return header ? base.replace('<div class="slots-card">', `<div class="slots-card">${header}`) : base;
  }

  function popupCloseButton() {
    return '<div style="display:flex;justify-content:flex-end;margin:-2px -2px 5px 0"><button type="button" class="map-detail-close" aria-label="Close restaurant details" style="width:34px;height:34px;min-height:34px;padding:0;border-radius:17px;border:1px solid #4a6885;background:#102b49;color:#fff;font-size:24px;line-height:30px;font-weight:500;box-shadow:none">×</button></div>';
  }

  function wirePopupClose(marker) {
    marker.on('popupopen', e => {
      const button = e.popup.getElement()?.querySelector('.map-detail-close');
      if (!button) return;
      button.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        marker.closePopup();
      };
    });
  }

  function multiPopup(m, eatigo = eatigoDisplay(m)) {
    const links = programmeLinks(m);
    const linksHtml = links.length
      ? `<div class="multi-programme-popup-links" style="margin-top:10px">${links.map(item => `<a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.label)} ↗</a>`).join(' · ')}</div>`
      : '';
    const close = popupCloseButton();

    // Eatigo remains the primary information surface in multi-benefit mode.
    // Preserve its percentage, full time/discount list and cuisine details.
    if (m.eatigo && eatigo.best != null && eatigo.slots.length) {
      return `${close}${richEatigoPanel(m, eatigo)}${linksHtml}`;
    }

    const eatigoLine = m.eatigo && eatigo.best != null ? `<br><strong>Eatigo best today: ${esc(eatigo.best)}%</strong>` : '';
    return `${close}<strong>${esc(m.accor_name || m.name)}</strong><br>${esc(m.address || '')}<br><small>${esc(benefitText(m))}</small>${eatigoLine}${linksHtml}`;
  }

  function programmeColours(m, eatigoHasPercent) {
    const colours = [];
    if (m.ld) colours.push(COLORS.ld);
    if (m.accor) colours.push(COLORS.accor);
    if (m.gha) colours.push(COLORS.gha);
    if (m.eatigo && !eatigoHasPercent) colours.push(COLORS.eatigo);
    return colours;
  }

  function gradient(colours) {
    if (!colours.length) return COLORS.dark;
    if (colours.length === 1) return colours[0];
    const step = 100 / colours.length;
    return `conic-gradient(${colours.map((colour, index) => `${colour} ${(index * step).toFixed(2)}% ${((index + 1) * step).toFixed(2)}%`).join(',')})`;
  }

  function pinSpec(m) {
    const eatigo = eatigoDisplay(m);
    const hasEatigoPercent = eatigo.best != null;
    const colours = programmeColours(m, hasEatigoPercent);
    const nonLcProgrammes = [m.ld, m.accor, m.gha, m.eatigo].filter(Boolean).length;
    let label = '+';
    let coreClass = 'multi-core';
    let coreStyle = '';

    // Eatigo percentage always wins the centre of the marker whenever a live
    // percentage is available. Other benefits are expressed by the ring/LC halo.
    if (hasEatigoPercent) {
      label = `${eatigo.best}%`;
      coreClass = `eatigo-core ${bucket(Number(eatigo.best))}`;
    } else if (nonLcProgrammes <= 1) {
      if (m.ld) { label = 'LD'; coreClass = 'single-core'; coreStyle = `background:${COLORS.ld}`; }
      else if (m.accor) { label = 'A'; coreClass = 'single-core'; coreStyle = `background:${COLORS.accor}`; }
      else if (m.gha) { label = 'G'; coreClass = 'single-core'; coreStyle = `background:${COLORS.gha}`; }
      else if (m.eatigo) { label = 'E'; coreClass = 'single-core'; coreStyle = `background:${COLORS.eatigo}`; }
      else if (m.lc) { label = 'LC'; coreClass = 'single-core'; coreStyle = `background:${COLORS.lc}`; }
    }

    const ringColours = hasEatigoPercent ? colours : (colours.length ? colours : (m.lc ? [COLORS.lc] : []));
    const ringBackground = gradient(ringColours.length ? ringColours : [COLORS.dark]);
    const classes = ['benefit-pin-wrap'];
    if (m.lc) classes.push('has-lc');
    if (nonLcProgrammes > 1 || (hasEatigoPercent && colours.length > 0)) classes.push('is-multi');
    if (hasEatigoPercent) classes.push('has-eatigo-percent');

    const titleBits = [];
    if (m.ld) titleBits.push('Love Dining');
    if (m.lc) titleBits.push('Lifestyle Credit');
    if (m.accor) titleBits.push('Accor+');
    if (m.gha) titleBits.push('GHA');
    if (m.eatigo) titleBits.push(hasEatigoPercent ? `Eatigo ${eatigo.best}%` : 'Eatigo');

    return {
      html: `<div class="${classes.join(' ')}" title="${esc(titleBits.join(' · '))}"><div class="benefit-pin-ring" style="background:${ringBackground}"><div class="benefit-pin-core ${coreClass}"${coreStyle ? ` style="${coreStyle}"` : ''}>${esc(label)}</div></div></div>`,
      eatigo
    };
  }

  function tooltipForProgramme(m, mode) {
    const label = MODE_LABEL[mode] || 'official programme';
    return `<strong>${esc(m.accor_name || m.name)}</strong><br><small>Click to open ${esc(label)} website ↗</small>`;
  }

  function createElegantMarker(m) {
    const mode = $('benefitFilter').value;
    const spec = pinSpec(m);
    const icon = L.divIcon({
      className: 'benefit-pin-icon',
      html: spec.html,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -19],
      tooltipAnchor: [20, 0]
    });
    const marker = L.marker([Number(m.lat), Number(m.lng)], { icon, riseOnHover: true });

    if (mode === 'multi') {
      if (m.eatigo && selected('eatigo') && spec.eatigo.best != null && spec.eatigo.slots.length) {
        const panel = richEatigoPanel(m, spec.eatigo);
        if (!touchLike()) {
          marker.bindTooltip(panel, { direction: 'auto', sticky: false, offset: [14, 0], opacity: .99, className: 'eatigo-slot-tooltip' });
        }
        marker.bindPopup(multiPopup(m, spec.eatigo), { autoClose: true, closeOnClick: true, closeButton: true });
      } else {
        marker.bindPopup(multiPopup(m, spec.eatigo), { autoClose: true, closeOnClick: true, closeButton: true });
      }
      wirePopupClose(marker);
      return marker;
    }

    if ((mode === 'eatigo' || mode === 'eatigolc') && m.eatigo) {
      if (spec.eatigo.best != null && spec.eatigo.slots.length) {
        const enriched = { ...m, _live: spec.eatigo.live, _slots: spec.eatigo.slots, _best: spec.eatigo.best };
        if (touchLike()) marker.bindPopup(mobilePopupForEatigo(enriched), { autoClose: true, closeOnClick: true, closeButton: true });
        else {
          marker.bindTooltip(tooltipForEatigo(enriched), { direction: 'auto', sticky: false, offset: [14, 0], opacity: .99, className: 'eatigo-slot-tooltip' });
          marker.on('click', () => window.open(m.eatigo_url, '_blank', 'noopener'));
        }
      } else {
        marker.bindPopup(`<strong>${esc(m.name)}</strong><br>${esc(m.address || '')}<br><small>No remaining matching Eatigo slot in the latest snapshot.</small>${m.eatigo_url ? `<br><a href="${esc(m.eatigo_url)}" target="_blank" rel="noopener">Open Eatigo ↗</a>` : ''}`);
      }
      return marker;
    }

    const url = MODE_URL[mode]?.(m) || null;
    if (url) {
      marker.bindTooltip(tooltipForProgramme(m, mode), { direction: 'top', opacity: .97 });
      marker.on('click', () => window.open(url, '_blank', 'noopener'));
      marker.on('add', () => {
        const el = marker.getElement();
        if (el) el.style.cursor = 'pointer';
      });
    } else {
      marker.bindPopup(`<strong>${esc(m.accor_name || m.name)}</strong><br>${esc(m.address || '')}<br><small>${esc(benefitText(m))}</small>`);
    }
    return marker;
  }

  function applyElegantPins() {
    const rows = current();
    const mappedRows = rows.filter(m => m.lat != null && m.lng != null);
    const oldMarkers = [...markers];
    const replacements = [];

    oldMarkers.forEach((oldMarker, index) => {
      const merchant = mappedRows[index];
      if (!merchant) return;
      layer.removeLayer(oldMarker);
      const marker = createElegantMarker(merchant);
      marker.addTo(layer);
      replacements.push(marker);
    });

    markers = replacements;
  }

  updateOriginVisual = function () {
    if (originMarker) { map.removeLayer(originMarker); originMarker = null; }
    if (originCircle) { map.removeLayer(originCircle); originCircle = null; }
    if (!originPos) return;
    const icon = L.divIcon({
      className: 'origin-glow-icon',
      html: '<div class="origin-glow-pin"><span></span></div>',
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });
    originMarker = L.marker(originPos, { icon, zIndexOffset: 3000 }).addTo(map).bindPopup(`<strong>${esc(originLabel || 'Search origin')}</strong>`);
    const radius = Number($('radiusFilter').value || 0);
    if (radius > 0) {
      originCircle = L.circle(originPos, { radius: radius * 1000, weight: 2, color: '#2f6bff', fillColor: '#2f6bff', fillOpacity: .045 }).addTo(map);
    }
  };

  render = function (...args) {
    const result = baseRender(...args);
    applyElegantPins();
    updateOriginVisual();
    return result;
  };

  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'benefit-map-legend');
    div.innerHTML = `
      <div class="legend-title">Map key</div>
      <div class="legend-row"><span class="legend-dot ld"></span><span>LD</span></div>
      <div class="legend-row"><span class="legend-dot accor"></span><span>Accor</span></div>
      <div class="legend-row"><span class="legend-dot gha"></span><span>GHA</span></div>
      <div class="legend-row"><span class="legend-ring lc"></span><span>LC halo</span></div>
      <div class="legend-row"><span class="legend-discount">40%</span><span>Eatigo</span></div>
      <div class="legend-row"><span class="legend-multi"></span><span>Multiple</span></div>`;
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    return div;
  };
  legend.addTo(map);
})();
