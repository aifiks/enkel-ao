/**
 * Observations-modul for håndtering av observasjoner og CSV-eksport
 */

import { defaultCoObservers, loadMedobs, speciesDisplayName, activityDisplayName, activityBokmalName, loadAllowUnknownCount } from './storage.js?v=v1.61.6';
import { loadActivities } from './api.js?v=v1.61.6';
import { showToast } from './ui.js';
import { t } from './i18n.js?v=v1.61.6';
import { toLocalISOString } from './utils.js';
import { getObservationVisitKey, setVisitLocked } from './visits.js';
import { openEditModal } from './edit-modal.js';

/**
 * Vis modal for å redigere lokalitet, aktivitet og/eller klokkeslett for alle obs i en gruppe
 */
export function showGroupEditModal(groupItems, defaultFra, defaultTil, groupName, observations, obsListEl, buttons, saveState, prefillPlace = null) {
  const existing = document.getElementById('group-edit-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'group-edit-modal';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '1000',
    background: 'rgba(0,0,0,0.55)', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    padding: '16px',
  });

  const box = document.createElement('div');
  Object.assign(box.style, {
    background: 'var(--card-bg, #1e293b)', borderRadius: '14px', padding: '20px',
    maxWidth: '400px', width: '100%', boxShadow: '0 12px 36px rgba(0,0,0,0.35)',
    color: 'var(--text)', boxSizing: 'border-box',
  });

  box.innerHTML = `
    <h3 style="margin:0 0 4px 0;font-size:1.15em;">${t('observations.group_edit.heading')}</h3>
    <p style="margin:0 0 14px 0;font-size:0.82em;color:var(--muted);line-height:1.3;"></p>

    <div style="margin-bottom:14px;">
      <label for="group-edit-place" style="font-size:0.88em;color:var(--text);display:block;margin-bottom:6px;font-weight:500;">${t('observations.group_edit.place_label')}</label>
      <div style="display:flex;gap:8px;align-items:center;position:relative;">
        <input type="text" id="group-edit-place" autocomplete="off" placeholder="${t('observations.group_edit.place_placeholder')}"
          style="flex:1;min-width:0;min-height:44px;padding:8px 10px;border-radius:10px;border:1px solid var(--border,rgba(148,163,184,0.35));background:var(--card-bg);color:var(--text);font-size:16px;box-sizing:border-box;" />
        <button type="button" id="group-edit-gps-btn" title="${t('observations.group_edit.gps_title')}" aria-label="${t('observations.group_edit.gps_title')}"
          style="width:44px;height:44px;min-width:44px;border-radius:10px;border:1px solid var(--border,rgba(148,163,184,0.35));background:rgba(148,163,184,0.1);color:var(--text);cursor:pointer;font-size:18px;display:inline-flex;align-items:center;justify-content:center;">📍</button>
        <button type="button" id="group-edit-map-btn" title="${t('observations.group_edit.map_title')}" aria-label="${t('observations.group_edit.map_title')}"
          style="width:44px;height:44px;min-width:44px;border-radius:10px;border:1px solid var(--border,rgba(148,163,184,0.35));background:rgba(148,163,184,0.1);color:var(--text);cursor:pointer;font-size:18px;display:inline-flex;align-items:center;justify-content:center;">🗺️</button>
        <div id="group-edit-place-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;margin-top:4px;max-height:200px;overflow-y:auto;background:var(--card-bg,#1e293b);border:1px solid var(--border,rgba(148,163,184,0.35));border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.35);z-index:1010;"></div>
      </div>
    </div>

    <hr style="border:none;border-top:1px solid var(--border,rgba(148,163,184,0.2));margin:14px 0;" />

    <div style="margin-bottom:14px;">
      <label for="group-edit-activity" style="font-size:0.88em;color:var(--text);display:block;margin-bottom:6px;font-weight:500;">${t('observations.group_edit.activity_label')}</label>
      <select id="group-edit-activity"
        style="width:100%;min-height:44px;padding:8px 10px;border-radius:10px;border:1px solid var(--border,rgba(148,163,184,0.35));background:var(--card-bg);color:var(--text);font-size:16px;box-sizing:border-box;">
        <option value="">${t('observations.group_edit.activity_unchanged')}</option>
      </select>
    </div>

    <hr style="border:none;border-top:1px solid var(--border,rgba(148,163,184,0.2));margin:14px 0;" />

    <div style="margin-bottom:18px;">
      <span style="font-size:0.88em;color:var(--text);display:block;margin-bottom:6px;font-weight:500;">${t('observations.group_edit.time_label')}</span>
      <div style="display:flex;gap:12px;align-items:center;">
        <div style="flex:1;">
          <label for="group-edit-fra" style="font-size:0.8em;color:var(--muted);display:block;margin-bottom:4px;">${t('observations.time_modal.from')}</label>
          <input type="time" id="group-edit-fra" style="width:100%;min-height:44px;padding:8px;border-radius:10px;border:1px solid var(--border,rgba(148,163,184,0.35));background:var(--card-bg);color:var(--text);font-size:16px;box-sizing:border-box;" />
        </div>
        <div style="flex:1;">
          <label for="group-edit-til" style="font-size:0.8em;color:var(--muted);display:block;margin-bottom:4px;">Til</label>
          <input type="time" id="group-edit-til" style="width:100%;min-height:44px;padding:8px;border-radius:10px;border:1px solid var(--border,rgba(148,163,184,0.35));background:var(--card-bg);color:var(--text);font-size:16px;box-sizing:border-box;" />
        </div>
      </div>
    </div>

    <div style="display:flex;gap:10px;">
      <button type="button" id="group-edit-cancel" style="flex:1;min-height:44px;padding:10px 16px;border:1px solid var(--border,rgba(148,163,184,0.35));border-radius:10px;background:transparent;color:var(--text);cursor:pointer;font-size:16px;font-weight:500;">Avbryt</button>
      <button type="button" id="group-edit-save" disabled style="flex:1;min-height:44px;padding:10px 16px;border:none;border-radius:10px;background:var(--accent,#3b82f6);color:white;cursor:pointer;font-size:16px;font-weight:600;opacity:0.45;">${t('observations.group_edit.save')}</button>
    </div>
  `;

  const obsOrd = groupItems.length === 1 ? t('observations.word_singular') : t('observations.word_plural');
  box.querySelector('p').textContent = `${groupName} — ${groupItems.length} ${obsOrd}`;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const placeInput = document.getElementById('group-edit-place');
  const placeDropdown = document.getElementById('group-edit-place-dropdown');
  const gpsBtn = document.getElementById('group-edit-gps-btn');
  const mapBtn = document.getElementById('group-edit-map-btn');
  const activitySelect = document.getElementById('group-edit-activity');
  const fraInput = document.getElementById('group-edit-fra');
  const tilInput = document.getElementById('group-edit-til');
  const cancelBtn = document.getElementById('group-edit-cancel');
  const saveBtn = document.getElementById('group-edit-save');

  fraInput.value = defaultFra;
  tilInput.value = defaultTil;

  let selectedPlaceId = null;
  let selectedPlaceIsAuto = false;
  if (prefillPlace && prefillPlace.name) {
    placeInput.value = prefillPlace.name;
    selectedPlaceId = prefillPlace.id ?? null;
    selectedPlaceIsAuto = true;
  }

  function updateSaveBtnState() {
    const hasPlace = placeInput.value.trim().length > 0;
    const hasActivity = activitySelect.value !== '';
    const timeChanged = fraInput.value !== defaultFra || tilInput.value !== defaultTil;
    const enabled = hasPlace || hasActivity || timeChanged;
    saveBtn.disabled = !enabled;
    saveBtn.style.opacity = enabled ? '1' : '0.45';
    saveBtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
  }
  updateSaveBtnState();

  loadActivities().then((activities) => {
    (activities || []).forEach((a) => {
      const opt = document.createElement('option');
      opt.value = a.label;
      opt.textContent = activityDisplayName(a.label);
      activitySelect.appendChild(opt);
    });
  }).catch(() => {});

  function renderPlaceDropdown(items) {
    placeDropdown.innerHTML = '';
    if (!items || !items.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:10px 12px;font-size:0.88em;color:var(--muted);';
      empty.textContent = t('observations.group_edit.no_sites');
      placeDropdown.appendChild(empty);
      placeDropdown.style.display = 'block';
      return;
    }
    items.slice(0, 15).forEach((site) => {
      const name = site.value || site.name || '';
      if (!name) return;
      const row = document.createElement('button');
      row.type = 'button';
      row.style.cssText = 'display:block;width:100%;text-align:left;padding:10px 12px;border:none;border-bottom:1px solid var(--border,rgba(148,163,184,0.15));background:transparent;color:var(--text);cursor:pointer;font-size:15px;';
      const prefix = site.isMine ? '⭐ ' : (site.isPrivate ? '👤 ' : (site.isSuper ? '🏷️ ' : ''));
      const sub = site.subvalue || [site.municipality, site.county].filter(Boolean).join(', ');
      row.textContent = prefix + name + (sub ? ` (${sub})` : '');
      row.addEventListener('click', () => {
        placeInput.value = name;
        selectedPlaceId = site.id ?? null;
        selectedPlaceIsAuto = true;
        placeDropdown.style.display = 'none';
        updateSaveBtnState();
      });
      placeDropdown.appendChild(row);
    });
    placeDropdown.style.display = 'block';
  }

  let searchTimer = null;
  placeInput.addEventListener('input', () => {
    selectedPlaceId = null;
    selectedPlaceIsAuto = false;
    updateSaveBtnState();
    clearTimeout(searchTimer);
    const term = placeInput.value.trim();
    if (term.length < 2) {
      placeDropdown.style.display = 'none';
      return;
    }
    searchTimer = setTimeout(async () => {
      try {
        const tokens = JSON.parse(localStorage.getItem('ao_tokens') || '{}');
        const headers = {};
        if (tokens.loginToken) headers['X-AO-Login-Token'] = tokens.loginToken;
        if (tokens.authCookie) headers['X-AO-Auth-Cookie'] = tokens.authCookie;
        if (tokens.userId) headers['X-AO-User-Id'] = tokens.userId;
        const resp = await fetch(`/api/ao-autocomplete?term=${encodeURIComponent(term)}`, { headers });
        const data = await resp.json();
        if (placeInput.value.trim() === term) {
          renderPlaceDropdown(data.results || []);
        }
      } catch {
        // Ignorer nettverksfeil — bruker kan fortsatt skrive stedsnavn manuelt
      }
    }, 250);
  });

  if (gpsBtn) {
    gpsBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showToast(t('observations.group_edit.no_sites'));
        return;
      }
      gpsBtn.disabled = true;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const resp = await fetch(`/api/ao-sites?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&size=1500`);
            const data = await resp.json();
            const sites = Array.isArray(data) ? data : (data.sites || []);
            renderPlaceDropdown(sites);
          } catch {
            renderPlaceDropdown([]);
          } finally {
            gpsBtn.disabled = false;
          }
        },
        () => {
          gpsBtn.disabled = false;
          showToast(t('observations.group_edit.no_sites'));
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  if (mapBtn) {
    mapBtn.addEventListener('click', () => {
      try {
        const visitKey = groupItems[0] ? getObservationVisitKey(groupItems[0]) : '';
        if (visitKey) sessionStorage.setItem('pendingGroupEditVisitKey', visitKey);
      } catch {
        // sessionStorage utilgjengelig
      }
      window.location.href = '/map.html';
    });
  }

  function close() { overlay.remove(); }
  function resetBorder(el) { el.style.borderColor = 'var(--border,rgba(148,163,184,0.35))'; }

  activitySelect.addEventListener('change', updateSaveBtnState);
  fraInput.addEventListener('input', () => { resetBorder(fraInput); updateSaveBtnState(); });
  tilInput.addEventListener('input', () => { resetBorder(tilInput); updateSaveBtnState(); });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
    else if (!placeInput.contains(e.target) && !placeDropdown.contains(e.target) && e.target !== gpsBtn) {
      placeDropdown.style.display = 'none';
    }
  });
  cancelBtn.addEventListener('click', close);

  saveBtn.addEventListener('click', () => {
    const newPlace = placeInput.value.trim();
    const newActivity = activitySelect.value;
    const fraVal = fraInput.value;
    const tilVal = tilInput.value;
    const timeChanged = fraVal !== defaultFra || tilVal !== defaultTil;

    let beregnetTid = null;
    if (timeChanged) {
      if (!fraVal) {
        fraInput.focus();
        return;
      }
      const now = new Date();
      const [fraH, fraM] = fraVal.split(':').map(Number);
      const [tilH, tilM] = tilVal ? tilVal.split(':').map(Number) : [];
      beregnetTid = groupItems.map((obs) => {
        const baseDate = obs.timestamp ? new Date(obs.timestamp) : new Date();
        const fraDate = new Date(baseDate);
        fraDate.setHours(fraH, fraM, 0, 0);
        let tilDate = null;
        if (tilVal) {
          tilDate = new Date(baseDate);
          tilDate.setHours(tilH, tilM, 0, 0);
        }
        return { obs, fraDate, tilDate };
      });
      if (beregnetTid.some((b) => b.fraDate > now)) {
        fraInput.style.borderColor = '#ef4444';
        showToast(t('observations.time_modal.from_in_future', { tid: fraVal }));
        fraInput.focus();
        return;
      }
      if (beregnetTid.some((b) => b.tilDate && b.tilDate > now)) {
        tilInput.style.borderColor = '#ef4444';
        showToast(t('observations.time_modal.to_in_future', { tid: tilVal }));
        tilInput.focus();
        return;
      }
    }

    if (newPlace) {
      groupItems.forEach((obs) => {
        obs.placeName = newPlace;
        obs.placeId = selectedPlaceIsAuto ? selectedPlaceId : null;
        delete obs.rarityWarning;
      });
    }
    if (newActivity) {
      const canonicalAct = activityBokmalName(newActivity);
      groupItems.forEach((obs) => {
        obs.activity = canonicalAct;
      });
    }
    if (beregnetTid) {
      beregnetTid.forEach(({ obs, fraDate, tilDate }) => {
        obs.timestamp = toLocalISOString(fraDate);
        if (tilDate) {
          obs.tilKlokkeslett = toLocalISOString(tilDate);
        }
      });
    }

    saveState();
    renderObservations(observations, obsListEl, buttons, saveState);
    close();
    showToast(t('observations.group_edit.saved', { count: groupItems.length }), { raw: true });
  });
}

/**
 * Render observasjoner i tabellvisning
 * @param {Array} observations - Liste med observasjoner
 * @param {HTMLElement} obsListEl - Container-element
 * @param {Object} buttons - Objekt med knapper som skal aktiveres
 * @param {Function} saveState - Callback for å lagre state
 */
export function renderObservations(observations, obsListEl, buttons, saveState) {
  obsListEl.innerHTML = '';

  if (!observations.length) {
    const item = document.createElement('div');
    item.className = 'obs-empty-msg';
    item.textContent = t('observations.empty_list');
    obsListEl.appendChild(item);
    return;
  }

  // Grupper observasjoner etter besøk. Eldre observasjoner uten visitId
  // faller tilbake til ett legacy-besøk per lokalitet.
  const groups = [];
  const indexByKey = new Map();
  
  observations.forEach((obs) => {
    const visitKey = getObservationVisitKey(obs);
    let idx = indexByKey.get(visitKey);
    
    if (idx === undefined) {
      idx = groups.length;
      indexByKey.set(visitKey, idx);
      groups.push({
        key: (obs.placeName && obs.placeName.trim()) || 'Uten stedsnavn',
        visitKey,
        items: [],
      });
    }
    
    groups[idx].items.push(obs);
  });
  
  // Sorter obs alfabetisk på art innenfor hver gruppe
  groups.forEach(group => {
    group.items.sort((a, b) => {
      const an = (a.species && a.species.taxonName) ? a.species.taxonName.toLowerCase() : '';
      const bn = (b.species && b.species.taxonName) ? b.species.taxonName.toLowerCase() : '';
      return an.localeCompare(bn, 'nb');
    });
  });

  const table = document.createElement('table');
  table.className = 'obs-table';

  // Auto table-layout: art-kolonnen (width:100%) tar all ledig plass, mens
  // antall- og handlings-kolonnene krymper til innhold og klumper mot høyre.
  const tbody = document.createElement('tbody');

  groups.forEach((group) => {
    // Finn antall unike arter i denne gruppen
    const uniqueSpecies = new Set(
      group.items
        .map(obs => obs.species && obs.species.taxonName ? obs.species.taxonName.trim().toLowerCase() : null)
        .filter(Boolean)
    );
    const visitLocked = group.items.every(obs => obs.visitLocked);
    // Finn tidligste og seneste klokkeslett i gruppen
    // TODO: Vis også dato ved stedsnavnet når obs spenner over flere dager
    let earliestMs = Infinity;
    let latestMs = -Infinity;
    group.items.forEach(obs => {
      if (obs.timestamp) {
        const t = new Date(obs.timestamp).getTime();
        if (!isNaN(t)) {
          if (t < earliestMs) earliestMs = t;
          if (t > latestMs) latestMs = t;
        }
      }
      // tilKlokkeslett er alltid >= timestamp for samme obs
      const til = obs.tilKlokkeslett || obs.timestamp;
      if (til) {
        const t = new Date(til).getTime();
        if (!isNaN(t) && t > latestMs) latestMs = t;
      }
    });

    const fmt = d => {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    };

    let timeSpanText = '';
    if (earliestMs < Infinity && latestMs > -Infinity) {
      const fra = fmt(new Date(earliestMs));
      const til = fmt(new Date(latestMs));
      timeSpanText = fra === til ? fra : `${fra}–${til}`;
    }

    const groupRow = document.createElement('tr');
    groupRow.className = 'obs-group-row';
    const groupCell = document.createElement('td');
    groupCell.colSpan = 3;
    groupCell.className = 'obs-group-title';

    const groupHeader = document.createElement('div');
    groupHeader.className = 'obs-group-header';

    const nameWrap = document.createElement('div');
    nameWrap.className = 'obs-group-name-wrap';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'obs-group-name';
    nameSpan.textContent = group.key;
    nameWrap.appendChild(nameSpan);

    if (timeSpanText) {
      const timeSpan = document.createElement('span');
      timeSpan.className = 'obs-group-time';
      timeSpan.textContent = timeSpanText;
      nameWrap.appendChild(timeSpan);
    }

    const metaSpan = document.createElement('span');
    metaSpan.className = 'obs-group-meta';
    const artOrd = uniqueSpecies.size === 1 ? t('observations.species_word_singular') : t('observations.species_word_plural');
    metaSpan.textContent = `${uniqueSpecies.size} ${artOrd}`;

    const editGroupBtn = document.createElement('button');
    editGroupBtn.type = 'button';
    editGroupBtn.className = 'obs-group-edit-btn';
    editGroupBtn.textContent = '✏️';
    editGroupBtn.setAttribute('aria-label', t('observations.group_edit.btn_title'));
    editGroupBtn.title = t('observations.group_edit.btn_title');
    editGroupBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const fra = earliestMs < Infinity ? fmt(new Date(earliestMs)) : '';
      const til = latestMs > -Infinity ? fmt(new Date(latestMs)) : '';
      showGroupEditModal(group.items, fra, til, group.key, observations, obsListEl, buttons, saveState);
    });

    nameWrap.appendChild(metaSpan);
    nameWrap.appendChild(editGroupBtn);
    groupHeader.appendChild(nameWrap);

    const groupActions = document.createElement('div');
    groupActions.className = 'obs-group-actions';

    // ↩ «Gå tilbake til dette besøket»: nye arter havner i akkurat dette
    // besøket, med besøkets starttidspunkt. Ikke blyant — ✏️ betyr allerede
    // «rediger denne observasjonen» på hver rad rett under, og ikke pluss —
    // + er opptatt av antallsknappene. Tilbake-pila sier hva det faktisk er.
    // Selve byttet gjøres i main.js (som eier appState) via CustomEvent.
    const groupPlaceName = (group.items[0] && group.items[0].placeName || '').trim();
    if (groupPlaceName) {
      const usePlaceBtn = document.createElement('button');
      usePlaceBtn.type = 'button';
      usePlaceBtn.textContent = '↩';
      usePlaceBtn.setAttribute('aria-label', t('observations.visit.back_aria', { place: groupPlaceName }));
      usePlaceBtn.title = visitLocked
        ? t('observations.visit.back_title_locked', { place: groupPlaceName })
        : t('observations.visit.back_title_open', { place: groupPlaceName });
      usePlaceBtn.className = 'obs-group-place-btn';
      const groupPlaceId = group.items[0].placeId || null;
      usePlaceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.dispatchEvent(new CustomEvent('obs:bruk-lokalitet', {
          detail: {
            placeName: groupPlaceName,
            placeId: groupPlaceId,
            visitKey: group.visitKey,
            visitLocked,
          },
        }));
      });
      groupActions.appendChild(usePlaceBtn);
    }

    const lockBtn = document.createElement('button');
    lockBtn.type = 'button';
    // Egentegnet hengelås i stedet for 🔓/🔒-emoji. De to emojiene skiller seg
    // kun på bøylens vinkel, og i 34 px-knappen var «åpent besøk» i praksis
    // umulig å skille fra «avsluttet» — flere leste den grønne, åpne låsen som
    // lukket. Samme kur som klokka over fikk.
    // Her er forskjellen hele silhuetten: lukket har bøylen symmetrisk over
    // husets midte, åpen har den svingt ut til HØYRE med den frie enden
    // hengende utenfor huset. Forskjellen bæres av form, ikke av detalj, og
    // leser derfor også i småformat og uten farge.
    lockBtn.innerHTML = visitLocked
      ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="14" height="10.5" rx="2.5"/><path d="M7.5 10.5V7a3.5 3.5 0 0 1 7 0v3.5"/></svg>'
      : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="14" height="10.5" rx="2.5"/><path d="M14.5 10.5V7a3.5 3.5 0 0 1 7 0v2"/></svg>';
    lockBtn.setAttribute('aria-label', visitLocked ? t('observations.visit.lock_aria_locked') : t('observations.visit.lock_aria_open'));
    lockBtn.title = visitLocked
      ? t('observations.visit.lock_title_locked')
      : t('observations.visit.lock_title_open');
    lockBtn.className = `obs-group-lock-btn${visitLocked ? ' is-locked' : ''}`;
    lockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nextLocked = !visitLocked;
      setVisitLocked(observations, group.visitKey, nextLocked);
      saveState();
      renderObservations(observations, obsListEl, buttons, saveState);
      showToast(nextLocked ? t('observations.visit.lock_toast_locked') : t('observations.visit.lock_toast_reopened'), { raw: true });
    });
    groupActions.appendChild(lockBtn);

    groupHeader.appendChild(groupActions);
    groupCell.appendChild(groupHeader);

    groupRow.appendChild(groupCell);
    tbody.appendChild(groupRow);

    group.items.forEach((obs, obsIndex) => {
      const tr = document.createElement('tr');
      
      // Alternerende bakgrunn (settes på td-er for full bredde)
      const altBg = obsIndex % 2 === 1 ? 'rgba(100,116,139,0.08)' : null;

      // Primærcelle: art (fet) – aktivitet (dempet) på én bred linje.
      // Bedre bruk av bredden enn egne smale kolonner for aktivitet/detaljer.
      const primaryTd = document.createElement('td');
      primaryTd.className = 'obs-cell-primary';

      const primaryLine = document.createElement('div');
      primaryLine.className = 'obs-primary';

      const speciesSpan = document.createElement('span');
      speciesSpan.className = 'obs-species';
      speciesSpan.textContent = obs.species ? speciesDisplayName(obs.species) : '';
      primaryLine.appendChild(speciesSpan);

      if (obs.activity) {
        // «– førsteord» bindes sammen (nowrap) så en tankestrek aldri blir
        // stående alene sist på linja; resten av lange aktiviteter kan brytes.
        primaryLine.appendChild(document.createTextNode(' '));
        const words = activityDisplayName(obs.activity).split(' ');
        const dashUnit = document.createElement('span');
        dashUnit.className = 'obs-activity-inline';
        dashUnit.style.whiteSpace = 'nowrap';
        dashUnit.textContent = `– ${words[0]}`;
        primaryLine.appendChild(dashUnit);
        if (words.length > 1) {
          const rest = document.createElement('span');
          rest.className = 'obs-activity-inline';
          rest.textContent = ' ' + words.slice(1).join(' ');
          primaryLine.appendChild(rest);
        }
      }
      // Sjeldenhetsvarsel fanget ved registrering — ellers er AOs advarsel
      // usynlig igjen så snart man har gått videre til neste art.
      if (obs.rarityWarning && (obs.rarityWarning.header || obs.rarityWarning.body)) {
        const rarityMerke = document.createElement('span');
        rarityMerke.className = 'obs-rarity-badge';
        rarityMerke.textContent = '⚠️';
        const titleParts = [];
        if (obs.rarityWarning.header) titleParts.push(obs.rarityWarning.header);
        if (obs.rarityWarning.body) titleParts.push(obs.rarityWarning.body);
        rarityMerke.title = titleParts.join('\n');
        rarityMerke.setAttribute('aria-label', `Sjeldenhetsvarsel: ${obs.rarityWarning.header || obs.rarityWarning.body}`);
        primaryLine.appendChild(rarityMerke);
      }
      // Skjul-merke (øye med strek) rett etter arten/aktiviteten på hovedlinja,
      // ikke på egen linje – merket alene under ser forlatt ut.
      // Øye-med-strek = ingen andre kan se funnet. (Hengelås er reservert for
      // den kommende tids-lås-funksjonen.)
      if (obs.hideUntil) {
        const parts = obs.hideUntil.split('-'); // YYYY-MM-DD
        const full = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : obs.hideUntil;
        const badge = document.createElement('span');
        badge.className = 'obs-hide-badge';
        badge.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
        badge.title = `Skjult for offentligheten til ${full}. Ingen andre kan se funnet. Endre via blyant-ikonet.`;
        primaryLine.appendChild(badge);
      }
      // Allerede publisert til AO. Lista tømmes ikke automatisk etter sending, så
      // uten dette merket er det umulig å se hvilke som ville blitt sendt på nytt.
      if (obs.sentTs) {
        const sendtMerke = document.createElement('span');
        sendtMerke.className = 'obs-sent-badge';
        sendtMerke.textContent = '✓';
        sendtMerke.title = 'Allerede sendt til Artsobservasjoner';
        sendtMerke.setAttribute('aria-label', 'Allerede sendt til Artsobservasjoner');
        primaryLine.appendChild(sendtMerke);
      }
      // Viser at det er lagt inn en kommentar (offentlig og/eller privat) —
      // ellers er det usynlig i lista at noen har skrevet noe via blyant-ikonet.
      if (obs.comment || obs.privateComment) {
        const kommentarMerke = document.createElement('span');
        kommentarMerke.className = 'obs-comment-badge';
        kommentarMerke.textContent = '💬';
        const titleParts = [];
        if (obs.comment) titleParts.push(`Kommentar: ${obs.comment}`);
        if (obs.privateComment) titleParts.push(`Privat kommentar: ${obs.privateComment}`);
        kommentarMerke.title = titleParts.join('\n');
        kommentarMerke.setAttribute('aria-label', 'Kommentar lagt inn');
        primaryLine.appendChild(kommentarMerke);
      }
      primaryTd.appendChild(primaryLine);

      // Underlinje: kun alder/kjønn, og kun når noe faktisk er satt.
      const subParts = [];
      if (obs.age) subParts.push(obs.age);
      if (obs.gender) subParts.push(obs.gender);
      if (subParts.length) {
        const subline = document.createElement('div');
        subline.className = 'obs-subline';
        const meta = document.createElement('span');
        meta.className = 'obs-subline-meta';
        meta.textContent = subParts.join(', ');
        subline.appendChild(meta);
        primaryTd.appendChild(subline);
      }
      tr.appendChild(primaryTd);

      const countTd = document.createElement('td');
      countTd.className = 'obs-cell-count';

      // Render count cell med pluss/minus knapper
      function renderCountCell() {
        countTd.innerHTML = '';
        // Wrapper-div brukes i stedet for direkte flex på td —
        // display:flex på <td> overstyrer table-layout:fixed sine bredder
        const countWrap = document.createElement('div');
        countWrap.style.display = 'flex';
        countWrap.style.alignItems = 'center';

        // Detekter om vi har presis peker (mus/trackpad) vs touch
        const hasFineMouse = window.matchMedia('(pointer: fine) and (hover: hover)').matches;
        const isLargeScreen = window.innerWidth >= 768 && window.innerHeight >= 600;
        const isNarrow = !hasFineMouse && window.innerWidth <= 420;

        // Kompakte, rektangulære knapper gir bedre tabellrytme enn store sirkler.
        const btnWidth = hasFineMouse ? '28px' : isNarrow ? '34px' : '40px';
        const btnHeight = hasFineMouse ? '28px' : isNarrow ? '32px' : '36px';
        const btnFontSize = hasFineMouse ? '1em' : '1.25em';
        countWrap.style.gap = hasFineMouse ? '3px' : isNarrow ? '3px' : '5px';
        // Klyng antall-knappene mot høyre, nær handlingsknappene (mindre dødrom)
        countWrap.style.justifyContent = 'flex-end';

        const btnStyle = {
          width: btnWidth,
          height: btnHeight,
          minWidth: btnWidth,
          minHeight: btnHeight,
          maxWidth: btnWidth,
          maxHeight: btnHeight,
          flexShrink: '0',
          fontSize: btnFontSize,
          fontWeight: '700',
          borderRadius: '8px',
          border: '1px solid rgba(148,163,184,0.34)',
          background: 'rgba(100,116,139,0.10)',
          color: 'var(--text, #e5e7eb)',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
          boxSizing: 'border-box',
        };

        const btnStyleWithDisplay = { ...btnStyle, display: 'flex' };

        // Minus 10-knapp (kun på stor skjerm)
        let minus10Btn = null;
        if (isLargeScreen) {
          minus10Btn = document.createElement('button');
          minus10Btn.type = 'button';
          minus10Btn.textContent = '«';
          minus10Btn.title = '−10';
          minus10Btn.className = 'count-btn';
          Object.assign(minus10Btn.style, btnStyleWithDisplay);
          minus10Btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (obs.count == null) return; // ukjent antall - «-» er no-op
            if (obs.count > 10) {
              obs.count -= 10;
            } else {
              obs.count = 1;
            }
            obs.tilKlokkeslett = toLocalISOString(new Date());
            span.textContent = String(obs.count);
            saveState();
          });
        }

        // Minus-knapp
        const minusBtn = document.createElement('button');
        minusBtn.type = 'button';
        minusBtn.textContent = '−';
        minusBtn.title = '−1';
        minusBtn.className = 'count-btn';
        Object.assign(minusBtn.style, btnStyleWithDisplay);
        minusBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (obs.count == null) return; // ukjent antall - «-» er no-op
          if (obs.count > 1) {
            obs.count--;
            obs.tilKlokkeslett = toLocalISOString(new Date());
            span.textContent = String(obs.count);
            saveState();
          }
        });

        // Tallet
        const span = document.createElement('span');
        span.textContent = obs.count != null ? String(obs.count) : '–';
        Object.assign(span.style, {
          cursor: 'pointer',
          minWidth: isNarrow ? '22px' : '36px',
          textAlign: 'center',
          fontSize: isNarrow ? '1.22em' : '1.28em',
          fontWeight: '700',
          lineHeight: '1',
          padding: isNarrow ? '4px 3px' : '4px 6px',
        });
        span.title = t('observations.count_click_title');
        span.addEventListener('click', () => {
          showInput();
        });

        // Pluss-knapp
        const plusBtn = document.createElement('button');
        plusBtn.type = 'button';
        plusBtn.textContent = '+';
        plusBtn.title = '+1';
        plusBtn.className = 'count-btn';
        Object.assign(plusBtn.style, btnStyleWithDisplay);
        plusBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          obs.count = (obs.count == null ? 0 : obs.count) + 1; // ukjent antall - «+» setter 1
          obs.tilKlokkeslett = toLocalISOString(new Date());
          span.textContent = String(obs.count);
          saveState();
        });

        // Pluss 10-knapp (kun på stor skjerm)
        let plus10Btn = null;
        if (isLargeScreen) {
          plus10Btn = document.createElement('button');
          plus10Btn.type = 'button';
          plus10Btn.textContent = '»';
          plus10Btn.title = '+10';
          plus10Btn.className = 'count-btn';
          Object.assign(plus10Btn.style, btnStyleWithDisplay);
          plus10Btn.addEventListener('click', (e) => {
            e.stopPropagation();
            obs.count = (obs.count == null ? 0 : obs.count) + 10;
            obs.tilKlokkeslett = toLocalISOString(new Date());
            span.textContent = String(obs.count);
            saveState();
          });
        }

        if (minus10Btn) countWrap.appendChild(minus10Btn);
        countWrap.appendChild(minusBtn);
        countWrap.appendChild(span);
        countWrap.appendChild(plusBtn);
        if (plus10Btn) countWrap.appendChild(plus10Btn);
        countTd.appendChild(countWrap);
      }
      
      function showInput() {
        countTd.innerHTML = '';
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.value = obs.count != null ? String(obs.count) : '';
        Object.assign(input.style, {
          width: '48px',
          fontSize: '0.98em',
          padding: '2px 4px',
          margin: '0',
          textAlign: 'center',
        });
        
        function save() {
          const val = input.value.trim();
          if (!val) {
            if (!loadAllowUnknownCount()) {
              showToast(t('observations.validation.count'));
              renderCountCell();
              return;
            }
            obs.count = null;
            obs.tilKlokkeslett = toLocalISOString(new Date());
            saveState();
            renderObservations(observations, obsListEl, buttons, saveState);
            return;
          }
          const num = parseInt(val, 10);
          if (isNaN(num) || num <= 0) {
            renderCountCell();
            return;
          }
          obs.count = num;
          obs.tilKlokkeslett = toLocalISOString(new Date());
          saveState();
          renderObservations(observations, obsListEl, buttons, saveState);
        }
        
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            save();
          } else if (e.key === 'Escape') {
            renderCountCell();
          }
        });
        input.addEventListener('blur', save);
        countTd.appendChild(input);
        input.focus();
        input.select();
      }
      
      renderCountCell();
      tr.appendChild(countTd);

      const actionTd = document.createElement('td');
      actionTd.className = 'action-td';
      actionTd.style.textAlign = 'center';

      // Edit-knapp
      const globalIndex = observations.indexOf(obs);
      const editBtn = document.createElement('button');
      editBtn.className = 'edit-obs-btn';
      editBtn.textContent = '✏️';
      editBtn.title = 'Rediger observasjon';
      editBtn.addEventListener('click', () => {
        if (globalIndex === -1) return;
        openEditModal(observations, globalIndex, () => {
          renderObservations(observations, obsListEl, buttons, saveState);
          saveState();
        });
      });
      actionTd.appendChild(editBtn);

      // Delete-knapp
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-obs-btn';
      deleteBtn.textContent = '🗑️';
      deleteBtn.title = 'Slett observasjon';
      deleteBtn.style.marginLeft = '4px';
      deleteBtn.addEventListener('click', () => {
        if (globalIndex === -1) return;

        // Lagre slettet observasjon og posisjon for undo
        const deletedObs = observations[globalIndex];
        const deletedIndex = globalIndex;
        const speciesName = (deletedObs.species && speciesDisplayName(deletedObs.species)) || 'Observasjon';

        // Fjern fra array
        observations.splice(globalIndex, 1);
        renderObservations(observations, obsListEl, buttons, saveState);
        saveState();

        // Vis toast med undo-mulighet
        showToast(t('observations.deleted_toast', { art: speciesName }), {
          duration: 5000,
          onUndo: () => {
            // Sett tilbake observasjonen på samme posisjon
            observations.splice(deletedIndex, 0, deletedObs);
            renderObservations(observations, obsListEl, buttons, saveState);
            saveState();
            showToast(t('observations.restored_toast', { art: speciesName }));
          }
        });
      });
      actionTd.appendChild(deleteBtn);
      tr.appendChild(actionTd);

      if (altBg) {
        tr.querySelectorAll('td').forEach(td => td.style.background = altBg);
      }
      tbody.appendChild(tr);
    });
  });

  table.appendChild(tbody);
  obsListEl.appendChild(table);

  // Aktiver knapper
  if (buttons.exportBtn) buttons.exportBtn.disabled = false;
  if (buttons.copyBtn) buttons.copyBtn.disabled = false;
  if (buttons.copyOpenBtn) buttons.copyOpenBtn.disabled = false;
  if (buttons.shareBtn) buttons.shareBtn.disabled = false;
  if (buttons.clearBtn) buttons.clearBtn.disabled = false;
  if (buttons.aoDirectBtn) buttons.aoDirectBtn.disabled = false;
}

/**
 * Konverter observasjoner til CSV-format for Artsobservasjoner
 * @param {Array} observations - Liste med observasjoner
 * @returns {string} - CSV-streng
 */
// Empirisk verifisert 2026-09-10 mot AOs egen «Importer observasjoner»-side (samme
// CSV-mekanisme som ao_import.py bruker): '1', 'X' og 'Ja' ble riktignok tolket som
// avkrysset for «Ikke gjenfunnet»/«Interessant observasjon», men IKKE for «Usikker
// artsbestemming» (artsnavnet fikk ingen [?]-markering) — og 'Sant' feilet for alle
// tre. Kun 'true' ga korrekt avkrysning på tvers av alle testede felt. «Ikke spontan»
// kunne ikke observeres direkte (vises ikke i kontroller-siden), men antas å følge
// samme koding som «Usikker artsbestemming» siden de vises sammen i AOs skjema.
// Oppdater samme konstant i src/ao_import.py hvis dette noensinne endrer seg.
const AO_BOOL_TRUE = 'true';

export function toCsv(observations, { ao3 = false } = {}) {
  if (!observations.length) return '';

  const SEP = '\t';
  const header = [
    'Artsnavn',
    'Lokalitetsnavn',
    'Superlokalitet',
    'Nord',
    'Øst',
    'Nøyaktighet',
    'Fra dato',
    'Til dato',
    'Fra klokkeslett',
    'Til klokkeslett',
    'Antall',
    'Alder',
    'Kjønn',
    'Aktivitet',
    'Kommentar (synlig for alle)',
    'Privat kommentar (kun synlig for deg selv)',
    'Skjul funn til dato',
    'Medobservatør',
    'Medobservatør',
    'Medobservatør',
    'Medobservatør',
    'Medobservatør',
    'Medobservatør',
    'Medobservatør',
    'Medobservatør',
    'Medobservatør',
    'Medobservatør',
    'Bestemmelsesmetode',
    'Natursystem',
    'Beskriv natursystem',
    'Livsmedium',
    'Beskriv livsmedium',
    'Art som livsmedium',
    'Beskriv art som livsmedium',
    'Dybde min',
    'Dybde maks',
    'Høyde min',
    'Høyde maks',
    'Andrehånds',
    'Usikker artsbestemming',
    'Ikke spontan',
    'Interessant observasjon',
    'Ikke gjenfunnet',
    'Ikke funnet',
    'Offentlig samling',
    'Privat samling',
    'Referansenummer i samling',
    'Beskrivelse artsbestemming',
    'Bestemt av',
    'Bestemt av (fritekst)',
    'Bestemmelsesår',
    'Bekreftet av',
    'Bekreftet av (fritekst)',
    'Bekreftelsesår',
  ];

  let kolonner = header.map((_, i) => i);
  if (ao3) {
    // AO3s fuglemal (3.0) har egne navn og mangler disse AO2-feltene.
    header[2] = 'Hovedlokalitet';
    header[14] = 'Merknad (synlig for alle)';
    header[15] = 'Privat merknad (kun synlig for deg selv)';
    kolonner = kolonner.filter((i) => (i < 28 || i > 33) && i !== 41);
  }
  const lines = [kolonner.map((i) => header[i]).join(SEP)];

  for (const obs of observations) {
    // Kråke: AO har slått sammen kråke og svartkråke – begge heter nå "kråke" i navnebasen.
    // Bruk latinsk navn for å unngå tvetydighet ved import. Fjern HTML-tags fra scientificNameHtml.
    // TODO: Fjern dette unntaket når AO har fikset navnekonflikten (~juli 2026).
    const taxonName = (obs.species && obs.species.taxonName) || '';
    const useLatin = taxonName.toLowerCase() === 'kråke' && obs.species && obs.species.scientificNameHtml;
    const resolvedName = useLatin
      ? obs.species.scientificNameHtml.replace(/<[^>]+>/g, '').trim()
      : taxonName;
    const name = resolvedName.replace(/[;\t]/g, ',');
    // Bruk lokalitets-ID hvis tilgjengelig, ellers navn (unngår tvetydighet ved import)
    const sted = ao3 ? obs.placeName : obs.placeId || obs.placeName;
    const place = String(sted || '').replace(/[;\t]/g, ',');
    const count = obs.count != null ? String(obs.count) : '';
    const activity = activityBokmalName(obs.activity || '').replace(/[;\t]/g, ',');
    const age = (obs.age || '').replace(/[;\t]/g, ',');
    const gender = (obs.gender || '').replace(/[;\t]/g, ',');
    const comment = (obs.comment || '').replace(/[;\t]/g, ',');
    const privateComment = (obs.privateComment || '').replace(/[;\t]/g, ',');

    // Dato (Fra/til = samme dag) – format DD.MM.YYYY
    let dateStr = '';
    let timeStr = '';
    
    if (obs.timestamp) {
      const d = new Date(obs.timestamp);
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        dateStr = `${dd}.${mm}.${yyyy}`;

        // Tidspunkt – format HH:MM (unntatt hvis 00:00, som betyr tid ikke er satt)
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        if (hh !== '00' || mi !== '00') {
          timeStr = `${hh}:${mi}`;
        }
      }
    }
    // Til klokkeslett (periode)
    let tilTimeStr = '';
    if (obs.tilKlokkeslett) {
      const t = new Date(obs.tilKlokkeslett);
      if (!isNaN(t.getTime())) {
        const hh = String(t.getHours()).padStart(2, '0');
        const mi = String(t.getMinutes()).padStart(2, '0');
        tilTimeStr = `${hh}:${mi}`;
      }
    }
    
    if (!dateStr) {
      const d = new Date();
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      dateStr = `${dd}.${mm}.${yyyy}`;
    }

    const cols = new Array(54).fill('');
    cols[0] = name;
    cols[1] = place;
    cols[6] = dateStr;
    cols[7] = dateStr;
    cols[8] = timeStr;
    // Kolonne 9: Bruk tilTimeStr hvis det finnes, ellers samme som fra-tid
    cols[9] = tilTimeStr ? tilTimeStr : timeStr;
    cols[10] = count;
    cols[11] = age;
    cols[12] = gender;
    cols[13] = activity;
    cols[14] = comment;
    cols[15] = privateComment;

    // Skjul funn til dato (kolonne 16, index 16) — konverter YYYY-MM-DD → DD.MM.YYYY
    if (obs.hideUntil) {
      const parts = obs.hideUntil.split('-');
      if (parts.length === 3) {
        cols[16] = `${parts[2]}.${parts[1]}.${parts[0]}`;
      }
    }

    // Flere felt-modalen (kolonne 38-43) — se AO_BOOL_TRUE-kommentaren over
    const avkrysset = ao3 ? 'X' : AO_BOOL_TRUE;
    if (obs.secondhand) cols[38] = avkrysset;
    if (obs.uncertain) cols[39] = avkrysset;
    if (obs.notSpontaneous) cols[40] = avkrysset;
    if (obs.interesting) cols[41] = AO_BOOL_TRUE;
    if (obs.notRefound) cols[42] = avkrysset;
    if (obs.notFound) cols[43] = avkrysset;
    if (ao3 && (obs.notRefound || obs.notFound)) cols[10] = '';

    // Medobservatører (10 kolonner)
    if (Array.isArray(obs.coObservers)) {
      for (let i = 0; i < 10; i++) {
        let v = obs.coObservers[i];
        // Hvis objekt: alias er unikt hos AO og foretrekkes (navn kan kollidere,
        // f.eks. flere kontoer med samme PresentationName). Ellers bruk som streng.
        if (v && typeof v === 'object') {
          v = ao3 ? v.name || v.alias : v.alias || v.name;
        }
        if (!v || v === 'undefined' || v === null) v = '';
        cols[17 + i] = String(v).replace(/[;\t]/g, ',');
      }
    } else {
      // Fyll med tomme strenger hvis ingen coObservers
      for (let i = 0; i < 10; i++) {
        cols[17 + i] = '';
      }
    }

    lines.push(ao3
      ? kolonner.map((i) => cols[i].replace(/[\r\n]+/g, ' ')).join(SEP)
      : cols.join(SEP));
  }
  
  return lines.join('\n');
}
