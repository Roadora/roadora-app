/* Roadora v39.3 clean sheet DOM - map/ORS/Maps untouched */
const STORAGE_KEY = 'roadora_phase1_state_v44_clean';
const DEMO_TRIP_ENABLED = false;

const defaultState = {
  activeScreen: 'overview',
  route: {
    start: '',
    end: '',
    vehicle: 'auto',
    planned: false,
    plannedAt: null
  },
  activeTrip: DEMO_TRIP_ENABLED ? {
    title: 'Noord-Spanje Roadtrip',
    meta: '12 dagen · 6 stops · 16 – 27 mei 2025'
  } : null
};

function loadState(){
  try{
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      ...defaultState,
      ...saved,
      route: { ...defaultState.route, ...(saved.route || {}) }
    };
  }catch(e){
    return { ...defaultState, route: { ...defaultState.route } };
  }
}

const RoadoraState = loadState();
const app = document.querySelector('#app');
const screens = [...document.querySelectorAll('[data-screen]')];
const navButtons = [...document.querySelectorAll('.bottom-nav [data-screen-target]')];
const toast = document.querySelector('#toast');
const menuBtn = document.getElementById('heroMenuBtn');
const menuOverlay = document.getElementById('heroMenuOverlay');
const menuClose = document.getElementById('heroMenuClose');
const startInput = document.getElementById('routeStartInput');
const endInput = document.getElementById('routeEndInput');
const planBtn = document.getElementById('planRouteBtn');
const vehicleButtons = [...document.querySelectorAll('[data-vehicle]')];
const mapRouteTitle = document.getElementById('mapRouteTitle');
const mapRouteText = document.getElementById('mapRouteText');
const mapRouteAction = document.getElementById('mapRouteAction');
const mapCanvas = document.getElementById('mapCanvas');
const mapSearchLabel = document.getElementById('mapSearchLabel');
const mapSheetKicker = document.getElementById('mapSheetKicker');
const mapRouteChipMain = document.getElementById('mapRouteChipMain');
const mapRouteChipSub = document.getElementById('mapRouteChipSub');

function saveState(){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(RoadoraState)); } catch(e) {}
}

function showToast(message){
  if(!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1700);
}

function renderTripState(){
  if(app) app.dataset.trip = RoadoraState.activeTrip || RoadoraState.route.planned ? 'planned' : 'empty';
}

function getVehicleLabel(value){
  return ({ auto:'Auto', ev:'EV', camper:'Camper', motor:'Motor' })[value] || 'Auto';
}

function isRouteReady(){
  return RoadoraState.route.start.trim().length > 1 && RoadoraState.route.end.trim().length > 1;
}

function renderRoutePlan(){
  if(startInput && startInput.value !== RoadoraState.route.start) startInput.value = RoadoraState.route.start;
  if(endInput && endInput.value !== RoadoraState.route.end) endInput.value = RoadoraState.route.end;

  vehicleButtons.forEach(btn => {
    const isActive = btn.dataset.vehicle === RoadoraState.route.vehicle;
    btn.classList.toggle('active', isActive);
    btn.classList.toggle('selected', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });

  if(planBtn){
    const ready = isRouteReady();
    planBtn.disabled = !ready;
    planBtn.classList.toggle('is-ready', ready);
    planBtn.textContent = ready ? 'Plan route' : 'Vul vertrek en bestemming in';
  }
}

function renderMapState(){
  if(!mapRouteTitle || !mapRouteText || !mapRouteAction) return;
  const planned = !!RoadoraState.route.planned;
  mapCanvas?.classList.toggle('has-active-route', planned);

  if(planned){
    const start = RoadoraState.route.start.trim();
    const end = RoadoraState.route.end.trim();
    const vehicle = getVehicleLabel(RoadoraState.route.vehicle);
    mapSheetKicker && (mapSheetKicker.textContent = 'Actieve route');
    mapRouteTitle.textContent = `${start} → ${end}`;
    mapRouteText.textContent = `${vehicle} · route blijft actief bij tab wisselen. Klaar voor kaart-polish, stops en live route-data.`;
    mapRouteAction.textContent = 'Route aanpassen';
    mapSearchLabel && (mapSearchLabel.textContent = `${start} naar ${end}`);
    mapRouteChipMain && (mapRouteChipMain.textContent = `${start} → ${end}`);
    mapRouteChipSub && (mapRouteChipSub.textContent = `${vehicle} · route actief`);
  }else{
    mapSheetKicker && (mapSheetKicker.textContent = 'Roadora kaart');
    mapRouteTitle.textContent = 'Nog geen route gepland';
    mapRouteText.textContent = 'Plan je eerste route en ontdek onderweg hotels, stops en uitjes.';
    mapRouteAction.textContent = 'Route plannen';
    mapSearchLabel && (mapSearchLabel.textContent = 'Zoek een plek of adres');
    mapRouteChipMain && (mapRouteChipMain.textContent = 'Nog geen route');
    mapRouteChipSub && (mapRouteChipSub.textContent = 'Plan een route om de kaart te activeren');
  }
}

function renderAll(){
  renderTripState();
  renderRoutePlan();
  renderMapState();
}

function closeMenu(){
  if(menuOverlay) menuOverlay.classList.remove('open');
}

function openScreen(name, options = {}){
  const target = screens.find(s => s.dataset.screen === name);
  if(!target) return;

  screens.forEach(screen => screen.classList.toggle('is-active', screen === target));
  navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.screenTarget === name));

  document.querySelectorAll('.hero-menu-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screenTarget === name);
  });

  RoadoraState.activeScreen = name;
  document.body.dataset.activeScreen = name;
  document.body.classList.toggle('has-photo-hero', ['overview','plan','roadtrip','profile'].includes(name));
  closeMenu();
  saveState();
  renderAll();
  if(name === 'map' && window.RoadoraMap){ window.RoadoraMap.ensure(); }

  if(options.scroll !== false){
    requestAnimationFrame(() => window.scrollTo({ top:0, behavior: options.instant ? 'auto' : 'smooth' }));
  }
}

function updateRouteField(field, value){
  RoadoraState.route[field] = value;
  RoadoraState.route.planned = false;
  saveState();
  renderAll();
}

function planRoute(){
  if(!isRouteReady()){
    showToast('Vul eerst vertrek en bestemming in');
    return;
  }
  RoadoraState.route.planned = true;
  RoadoraState.route.plannedAt = new Date().toISOString();
  RoadoraState.activeTrip = {
    title: `${RoadoraState.route.start} → ${RoadoraState.route.end}`,
    meta: `${getVehicleLabel(RoadoraState.route.vehicle)} · route gepland`
  };
  saveState();
  renderAll();
  if(planBtn){
    planBtn.classList.add('is-loading');
    planBtn.textContent = 'Route wordt geopend…';
  }
  setTimeout(() => {
    if(planBtn) planBtn.classList.remove('is-loading');
    showToast('Route gepland');
    openScreen('map');
  }, 450);
}

menuBtn?.addEventListener('click', () => menuOverlay?.classList.add('open'));
menuClose?.addEventListener('click', closeMenu);
menuOverlay?.addEventListener('click', (event) => {
  if(event.target === menuOverlay) closeMenu();
});

startInput?.addEventListener('input', (event) => updateRouteField('start', event.target.value));
endInput?.addEventListener('input', (event) => updateRouteField('end', event.target.value));
[startInput, endInput].forEach(input => {
  input?.addEventListener('keydown', (event) => {
    if(event.key === 'Enter'){
      event.preventDefault();
      if(input === startInput) endInput?.focus();
      else planRoute();
    }
  });
});

vehicleButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    RoadoraState.route.vehicle = btn.dataset.vehicle || 'auto';
    RoadoraState.route.planned = false;
    saveState();
    renderAll();
  });
});

planBtn?.addEventListener('click', planRoute);

document.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]');
  if(action?.dataset.action === 'demo-trip'){
    RoadoraState.activeTrip = { title:'Noord-Spanje Roadtrip', meta:'12 dagen · 6 stops · 16 – 27 mei 2025' };
    saveState();
    renderAll();
    showToast('Roadtrip gepland');
    openScreen('overview');
    return;
  }

  const target = event.target.closest('[data-screen-target]');
  if(target){
    const screen = target.dataset.screenTarget;
    if(!screen) return;
    event.preventDefault();
    openScreen(screen);
  }
});

renderAll();
openScreen(RoadoraState.activeScreen || 'overview', { instant:true, scroll:false });
window.RoadoraState = RoadoraState;
window.RoadoraRouter = { open: openScreen, render: renderAll, planRoute };

/* ===== Roadora v53 — exacte bestaande kaart UX in clean core ===== */
(function(){
  const $ = (s, r=document) => r.querySelector(s);
  const DEFAULT_START = [4.4777, 51.9244];
  const DEFAULT_END = [11.4041, 47.2692];
  const CITY_COORDS = {
    rotterdam: DEFAULT_START,
    amsterdam: [4.9041,52.3676],
    delft: [4.3571,52.0116],
    'hendrik ido ambacht': [4.6389,51.8442],
    hendrikidoambacht: [4.6389,51.8442],
    innsbruck: DEFAULT_END,
    utrecht: [5.1214,52.0907],
    breda: [4.7758,51.5719],
    eindhoven: [5.4697,51.4416],
    antwerpen: [4.4025,51.2194],
    brussel: [4.3517,50.8503],
    brussels: [4.3517,50.8503],
    parijs: [2.3522,48.8566],
    paris: [2.3522,48.8566],
    lyon: [4.8357,45.7640],
    milaan: [9.1900,45.4642],
    milan: [9.1900,45.4642],
    munchen: [11.5820,48.1351],
    münchen: [11.5820,48.1351],
    zurich: [8.5417,47.3769],
    zürich: [8.5417,47.3769],
    barcelona: [2.1734,41.3851],
    'san sebastian': [-1.9812,43.3183],
    sansebastian: [-1.9812,43.3183]
  };
  let map, routeLayer, markerLayer, labelLayer, categoryLayer, initialized=false, loading=false, routeCoordinates=[];

  function norm(v){ return String(v||'').toLowerCase().trim().replace(/[,].*$/,'').replace(/[-_]/g,' ').replace(/\s+/g,' '); }
  function coordFor(label, fallback){
    const n = norm(label);
    if(CITY_COORDS[n]) return CITY_COORDS[n];
    const compact = n.replace(/\s+/g,'');
    if(CITY_COORDS[compact]) return CITY_COORDS[compact];
    for(const key of Object.keys(CITY_COORDS)) if(n.includes(key) || key.includes(n)) return CITY_COORDS[key];
    return fallback;
  }
  function appRoute(){ return window.RoadoraState?.route || {start:'Rotterdam',end:'Innsbruck',vehicle:'auto',planned:false}; }
  function vLabel(v){ return ({auto:'Auto',ev:'EV',camper:'Camper',motor:'Motor'})[v] || 'Auto'; }
  function profileFor(v){ return v === 'camper' ? 'driving-hgv' : 'driving-car'; }
  function latLng(c){ return [c[1], c[0]]; }
  function placeLabel(s, fallback){ return String(s||fallback||'').trim() || fallback; }
  function fmtKm(m){ return !m ? '— km' : `${Math.round(m/1000).toLocaleString('nl-NL')} km`; }
  function fmtTime(sec){
    if(!sec) return 'ETA —';
    const h=Math.floor(sec/3600), min=Math.round((sec%3600)/60);
    return h ? `${h}u ${String(min).padStart(2,'0')}m` : `${min} min`;
  }
  function showMapToast(msg){
    const t=$('#mapToast'); if(!t) return;
    t.textContent=msg; t.classList.add('show');
    clearTimeout(showMapToast.timer); showMapToast.timer=setTimeout(()=>t.classList.remove('show'),1600);
  }
  function setText(id, value){ const el=$(id); if(el) el.textContent=value; }
  function activeRoute(){
    const r=appRoute();
    const start=placeLabel(r.start,'Rotterdam');
    const end=placeLabel(r.end,'Innsbruck');
    return { ...r, start, end, vehicle:r.vehicle || 'auto' };
  }

  function updateVehicleButtons(){
    const r=activeRoute();
    document.querySelectorAll('#mapVehicleSwitch .vehicle').forEach(btn=>{
      const on = btn.dataset.mapVehicle === r.vehicle;
      btn.classList.toggle('active', on);
    });
  }

  function updateLabels(summary){
    const r=activeRoute();
    const routeName = `${r.start} → ${r.end}`;
    const veh = vLabel(r.vehicle);
    setText('#mapStatusTitle', routeName);
    setText('#mapStatusBadge', r.planned ? '🟢 Rustige route' : 'Preview');
    setText('#mapStatusSub', `${veh} route · ${fmtTime(summary?.duration).replace('ETA ','') || 'route laden'} · ${fmtKm(summary?.distance)}`);
    setText('#mapStatusEta', fmtTime(summary?.duration));
    setText('#mapStatusDistance', fmtKm(summary?.distance));
    setText('#mapStatusNext', r.vehicle === 'ev' ? 'Volgende: laadstop' : 'Pauze over 45 min');
    setText('#mapPointStart', r.start);
    setText('#mapPointEnd', r.end);
    setText('#mapStatKm', fmtKm(summary?.distance));
    setText('#stopTitle', r.end.includes(',') ? r.end : `${r.end}`);
    setText('#stopMeta', `${fmtKm(summary?.distance)} · ${fmtTime(summary?.duration).replace('ETA ','')} · ${veh}`);
    setText('#stopDesc', 'Je echte ORS-route is geladen. Onderweg kun je hotels, laadstops en eten als stops toevoegen.');
    updateVehicleButtons();
  }

  function ensureBase(){
    if(initialized || !$('#routeLeafletMap') || !window.L) return;
    initialized=true;
    map = L.map('routeLeafletMap', { zoomControl:false, attributionControl:false, preferCanvas:true, tap:true, zoomSnap:.25, zoomDelta:.5 }).setView([50.2,7.4],6);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.webp', { maxZoom:19 }).addTo(map);
    routeLayer=L.layerGroup().addTo(map);
    markerLayer=L.layerGroup().addTo(map);
    labelLayer=L.layerGroup().addTo(map);
    categoryLayer=L.layerGroup().addTo(map);

    $('#zoomIn')?.addEventListener('click',()=>map.zoomIn());
    $('#zoomOut')?.addEventListener('click',()=>map.zoomOut());
    $('#fitRoute')?.addEventListener('click',()=>fitRoute());
    $('#mapsRouteBtn')?.addEventListener('click',()=>openGoogleMapsRoute());
    $('#mapNavMainBtn')?.addEventListener('click',()=>openGoogleMapsRoute());
    $('#routeInfoBtn')?.addEventListener('click',()=>showMapToast('Route-info staat klaar'));
    $('#openAddStopMode')?.addEventListener('click',()=>setRoadtripSheetMode('add'));
    $('#openAssistMode')?.addEventListener('click',()=>setRoadtripSheetMode('assist'));
    $('#addDemoStopBtn')?.addEventListener('click',()=>addDemoStopToRoute());
    document.querySelectorAll('[data-sheet-mode]').forEach(btn=>btn.addEventListener('click',()=>setRoadtripSheetMode(btn.dataset.sheetMode || 'live')));
    document.querySelectorAll('[data-assist]').forEach(btn=>btn.addEventListener('click',()=>{
      document.querySelectorAll('[data-assist]').forEach(x=>x.classList.toggle('active', x===btn));
      showMapToast(`${btn.textContent.trim()} dichtbij gezocht`);
    }));
    document.querySelector('[data-menu-open]')?.addEventListener('click',()=>document.getElementById('heroMenuOverlay')?.classList.add('open'));
    $('#mapCats')?.addEventListener('click',(e)=>{
      const b=e.target.closest('.cat'); if(!b) return;
      b.classList.toggle('active');
      showMapToast(`${b.textContent.trim()} bijgewerkt`);
    });
    document.querySelector('.bottomNavV59')?.addEventListener('click',(e)=>{
      const b=e.target.closest('.navItem'); if(!b) return;
      document.querySelectorAll('.bottomNavV59 .navItem').forEach(x=>x.classList.toggle('active',x===b));
      if(b.dataset.nav === 'navigate') openGoogleMapsRoute();
      else if(b.dataset.nav === 'stops') showMapToast('Stops openen we in de volgende stap');
      else if(b.dataset.nav === 'more') showMapToast('Meer kaartopties komen later');
      else showMapToast('Route overzicht');
    });
    document.querySelector('#mapVehicleSwitch')?.addEventListener('click',(e)=>{
      const b=e.target.closest('[data-map-vehicle]'); if(!b) return;
      if(window.RoadoraState?.route){
        window.RoadoraState.route.vehicle = b.dataset.mapVehicle;
        try{ localStorage.setItem('roadora_phase1_state_v44_clean', JSON.stringify(window.RoadoraState)); }catch(_){ }
      }
      updateVehicleButtons();
      loadRoute(true);
    });
  }

  function endpointIcon(){ return L.divIcon({ className:'endpointMarker', iconSize:[30,30], iconAnchor:[15,15] }); }
  function labelIcon(text){ return L.divIcon({ className:'mapLabel', html:String(text||''), iconSize:[120,18], iconAnchor:[14,-2] }); }

  function stopIcon(kind='hotel'){ return L.divIcon({ className:`roadoraStopMarker ${kind}`, html: kind==='assist' ? '⚡' : '🏨', iconSize:[34,34], iconAnchor:[17,17] }); }
  function setRoadtripSheetMode(mode='live'){
    const sheet=$('#mapDrawer'); if(!sheet) return;
    sheet.dataset.mode=mode;
    document.querySelectorAll('#mapDrawer [data-sheet-view]').forEach(view=>{
      view.hidden = view.dataset.sheetView !== mode;
    });
    if(mode==='live') showMapToast('Terug naar volledige roadtrip');
    if(mode==='add') showMapToast('Kies een extra tussenstop');
    if(mode==='assist') showMapToast('Snelle assist geopend');
  }
  function addDemoStopToRoute(){
    if(!map || !routeCoordinates.length){ setRoadtripSheetMode('live'); return; }
    const idx=Math.max(0, Math.floor(routeCoordinates.length * .42));
    const c=routeCoordinates[idx] || routeCoordinates[Math.floor(routeCoordinates.length/2)];
    L.marker(latLng(c), { icon:stopIcon('hotel') }).addTo(markerLayer);
    L.marker(latLng(c), { icon:labelIcon('Hotel Moselblick<br><small>Nieuwe tussenstop</small>') }).addTo(labelLayer);
    setText('#mapStatusNext','Volgende: Hotel Moselblick');
    setText('#stopTitle','Hotel Moselblick toegevoegd');
    setText('#stopDesc','De tussenstop staat nu in je roadtrip. De kaart keert automatisch terug naar de volledige route met de extra stop zichtbaar.');
    setRoadtripSheetMode('live');
    fitRoute();
    showMapToast('Tussenstop toegevoegd aan je roadtrip');
  }

  /* Roadora v39.6.5 — category preview pins on a separate layer */
  const CATEGORY_PIN_META = {
    hotels: {
      icon: '☾',
      label: 'Hotels',
      toast: 'Hotels langs je route',
      items: ['Hotel aan de route', 'Rustige overnachting', 'Hotel bij afrit']
    },
    fuel: {
      icon: '⛽',
      label: 'Tankstations',
      toast: 'Tankstations langs je route',
      items: ['Tankstation route', 'Brandstof & koffie', 'Volgende tankstop']
    },
    charge: {
      icon: '⚡',
      label: 'Laadpalen',
      toast: 'Laadpalen langs je route',
      items: ['Snellader route', 'Laadstop bij afrit', 'EV stop']
    },
    food: {
      icon: '🍴',
      label: 'Eten',
      toast: 'Eten langs je route',
      items: ['Lunchstop', 'Restaurant route', 'Koffie & pauze']
    },
    discover: {
      icon: '◎',
      label: 'Uitjes',
      toast: 'Uitjes langs je route',
      items: ['Mooi uitzicht', 'Korte stop', 'Bezienswaardigheid']
    },
    wc: {
      icon: 'WC',
      label: 'WC',
      toast: 'WC-stops langs je route',
      items: ['WC dichtbij route', 'Pauzeplek', 'Ruststop']
    }
  };

  let activeCategoryPinV39682 = null;
  let activeCategoryPinIndexV39682 = -1;

  function categoryPinIcon(category, index, isActive){
    const meta = CATEGORY_PIN_META[category] || CATEGORY_PIN_META.hotels;
    return L.divIcon({
      className: `rdCategoryPin rdCategoryPin-${category} ${isActive ? 'is-active-v39682 is-active-v39683' : ''}`,
      html: `<span class="rdCategoryPinInner"><em class="rdCategoryPinIcon">${meta.icon}</em></span>`,
      iconSize: isActive ? [40,40] : [34,34],
      iconAnchor: isActive ? [20,20] : [17,17],
      popupAnchor: [0,-18]
    });
  }

  function routePointAt(percent){
    if(!routeCoordinates.length) return null;
    const idx = Math.max(0, Math.min(routeCoordinates.length - 1, Math.floor(routeCoordinates.length * percent)));
    return routeCoordinates[idx];
  }

  function offsetCoord(coord, index){
    // coord = [lon, lat]. Small visual offset so preview pins do not sit exactly on top of the route.
    const direction = index % 2 === 0 ? 1 : -1;
    const scale = 0.055 + (index * 0.012);
    return [coord[0] + (scale * direction), coord[1] + (scale * 0.45)];
  }



  /* v39.6.45 — focus selected hotel above the sheet/popover without touching route core */
  function getCategoryPreviewPositions(category){
    // v39.6.82: five stable route slots so pins can map 1-op-1 to the horizontal cards.
    return [0.20, 0.34, 0.50, 0.66, 0.80];
  }

  function getCategoryPreviewCoord(category, index){
    const positions = getCategoryPreviewPositions(category);
    const safeIndex = Math.max(0, Math.min(positions.length - 1, Number(index) || 0));
    const base = routePointAt(positions[safeIndex]);
    if(!base) return null;
    return offsetCoord(base, safeIndex);
  }

  function getCategoryPreviewPercent(category, index){
    const positions = getCategoryPreviewPositions(category || 'hotels');
    const safeIndex = Math.max(0, Math.min(positions.length - 1, Number(index) || 0));
    return positions[safeIndex] || 0.5;
  }

  function getActiveMapOverlayTopV39684(){
    const candidates = [
      document.querySelector('#mapDrawer .rd-hotel-preview-popover-v39644'),
      document.querySelector('#mapDrawer'),
      document.querySelector('.rd-map-nav-v28')
    ].filter(Boolean);

    let top = window.innerHeight || 760;
    candidates.forEach(function(el){
      try{
        const rect = el.getBoundingClientRect();
        if(rect && rect.top > 0) top = Math.min(top, rect.top);
      }catch(_){ }
    });
    return top;
  }

  function getRouteSegmentBoundsPointsV39684(percent, selected){
    const points = [];
    const start = routeCoordinates[0];
    const destination = routeCoordinates[routeCoordinates.length - 1];

    if(start) points.push(latLng(start));

    // Keep the route context between start/current-position and selected stop.
    // This avoids fitting the complete Rotterdam→Innsbruck route when the user
    // selects an early stop, which made the chosen stop disappear behind the popover.
    const maxIndex = Math.max(0, Math.min(routeCoordinates.length - 1, Math.floor(routeCoordinates.length * Math.min(0.98, percent + 0.08))));
    const step = Math.max(1, Math.floor(maxIndex / 18));
    for(let i = 0; i <= maxIndex; i += step){
      if(routeCoordinates[i]) points.push(latLng(routeCoordinates[i]));
    }

    points.push(selected);

    // If the chosen stop is late in the journey, also keep destination in context.
    if(percent > 0.68 && destination) points.push(latLng(destination));
    return points;
  }

  function focusSelectedCategoryStopOnMap(category, index){
    if(!map || !window.L || !routeCoordinates.length) return;
    const safeCategory = category || 'hotels';
    const safeIndex = Math.max(0, Number(index) || 0);
    const coord = getCategoryPreviewCoord(safeCategory, safeIndex);
    if(!coord) return;

    const percent = getCategoryPreviewPercent(safeCategory, safeIndex);
    const selected = latLng(coord);
    const boundPoints = getRouteSegmentBoundsPointsV39684(percent, selected);

    try{
      map.invalidateSize && map.invalidateSize(false);
      const overlayTop = getActiveMapOverlayTopV39684();
      const viewportH = window.innerHeight || 760;
      const bottomPadding = Math.max(360, Math.min(560, Math.round(viewportH - overlayTop + 72)));
      const bounds = L.latLngBounds(boundPoints);

      map.fitBounds(bounds.pad(0.10), {
        animate:true,
        duration:.45,
        maxZoom:8,
        paddingTopLeft:[34,126],
        paddingBottomRight:[34,bottomPadding]
      });

      // After fitBounds, explicitly keep the selected stop inside the visible
      // area above the sheet/popover. This is the actual map-engine part of the
      // fix; it prevents the old centered focus from hiding the stop underneath
      // the Roadora popover.
      window.setTimeout(function(){
        try{
          const overlayTopNow = getActiveMapOverlayTopV39684();
          const visibleBottom = Math.max(170, overlayTopNow - 18);
          map.panInside(selected, {
            animate:true,
            duration:.28,
            paddingTopLeft:[42,128],
            paddingBottomRight:[42, Math.max(260, Math.round((window.innerHeight || 760) - visibleBottom + 72))]
          });
        }catch(_){ }
      }, 280);
    }catch(_){
      try{ map.setView(selected, Math.min((map.getZoom && map.getZoom()) || 7, 7), { animate:true, duration:.35 }); }catch(__){ }
    }
  }

  function focusSelectedHotelOnMap(index){
    focusSelectedCategoryStopOnMap('hotels', index);
  }

  function renderCategoryPins(category, activeIndex){
    if(!map || !window.L) return;
    if(!categoryLayer) categoryLayer = L.layerGroup().addTo(map);
    categoryLayer.clearLayers();

    if(!routeCoordinates.length){
      showMapToast('Plan eerst een route');
      return;
    }

    if(category && category !== activeCategoryPinV39682){
      activeCategoryPinV39682 = category;
      activeCategoryPinIndexV39682 = -1;
    }
    if(typeof activeIndex === 'number' && activeIndex >= 0){
      activeCategoryPinIndexV39682 = activeIndex;
    }

    const meta = CATEGORY_PIN_META[category] || CATEGORY_PIN_META.hotels;
    const positions = getCategoryPreviewPositions(category);
    const created = [];

    positions.forEach((p, i)=>{
      const base = routePointAt(p);
      if(!base) return;

      const coord = offsetCoord(base, i);
      const name = meta.items[i] || meta.label;
      const isActivePin = activeCategoryPinV39682 === category && activeCategoryPinIndexV39682 === i;
      const marker = L.marker(latLng(coord), { icon: categoryPinIcon(category, i, isActivePin), riseOnHover:true, zIndexOffset: isActivePin ? 900 : 0 });
      marker.bindPopup(`<strong>${name}</strong><br><small>${meta.label} · langs route</small>`);
      marker.addTo(categoryLayer);
      created.push(marker);
    });

    if(created.length){
      const group = L.featureGroup(created);
      try{
        map.fitBounds(group.getBounds().pad(1.8), { animate:true, duration:.35, maxZoom:8 });
      }catch(_){}
    }

    setText('#mapStatusNext', meta.label + ' geselecteerd');
    showMapToast(meta.toast);
  }

  window.addEventListener('roadora:stop-category-change', function(ev){
    const category = ev.detail && ev.detail.category;
    if(!category) return;
    renderCategoryPins(category);
  });

  if (window.RoadoraApp) {
    window.RoadoraApp.renderCategoryPins = renderCategoryPins;
  }
  function addEndpoints(startCoord, endCoord){
    const r=activeRoute();
    L.marker(latLng(startCoord), { icon:endpointIcon() }).addTo(markerLayer);
    L.marker(latLng(endCoord), { icon:endpointIcon() }).addTo(markerLayer);
    L.marker(latLng(startCoord), { icon:labelIcon(`${r.start}<br><small>Start</small>`) }).addTo(labelLayer);
    L.marker(latLng(endCoord), { icon:labelIcon(`${r.end}<br><small>Eindbestemming</small>`) }).addTo(labelLayer);
  }
  function drawFallback(startCoord, endCoord){
    routeCoordinates=[startCoord,endCoord];
    routeLayer.clearLayers(); markerLayer.clearLayers(); labelLayer.clearLayers(); if(categoryLayer) categoryLayer.clearLayers();
    L.polyline([latLng(startCoord), latLng(endCoord)], { color:'#b87932', weight:5, opacity:.95, lineCap:'round', lineJoin:'round' }).addTo(routeLayer);
    addEndpoints(startCoord,endCoord);
    fitRoute();
  }
  function drawGeoJson(data,startCoord,endCoord){
    routeLayer.clearLayers(); markerLayer.clearLayers(); labelLayer.clearLayers(); if(categoryLayer) categoryLayer.clearLayers();
    const coords=data?.features?.[0]?.geometry?.coordinates || [];
    routeCoordinates = coords.length ? coords : [startCoord,endCoord];
    L.geoJSON(data, { style:{ color:'#b87932', weight:5, opacity:.95, lineCap:'round', lineJoin:'round' } }).addTo(routeLayer);
    addEndpoints(startCoord,endCoord);
    updateLabels(data?.features?.[0]?.properties?.summary || {});
    fitRoute();
  }
  async function loadRoute(force=false){
    ensureBase(); if(!map || (loading && !force)) return;
    loading=true;
    const r=activeRoute();
    const startCoord=coordFor(r.start, DEFAULT_START);
    const endCoord=coordFor(r.end, DEFAULT_END);
    updateLabels(null);
    drawFallback(startCoord,endCoord);
    showMapToast('Route laden…');
    try{
      const url=`/api/route?start=${encodeURIComponent(startCoord.join(','))}&end=${encodeURIComponent(endCoord.join(','))}&profile=${encodeURIComponent(profileFor(r.vehicle))}`;
      const res=await fetch(url);
      if(!res.ok) throw new Error(`ORS ${res.status}`);
      const data=await res.json();
      drawGeoJson(data,startCoord,endCoord);
      showMapToast('Echte ORS route geladen');
    }catch(err){
      console.warn('Roadora map fallback:',err);
      updateLabels(null);
      showMapToast('Fallback route actief');
    }finally{
      loading=false;
      setTimeout(()=>map?.invalidateSize(false),80);
    }
  }
  function fitRoute(){
    if(!map || !routeCoordinates.length) return;
    const bounds=L.latLngBounds(routeCoordinates.map(latLng));
    map.fitBounds(bounds, { paddingTopLeft:[44,190], paddingBottomRight:[44,190], maxZoom:9, animate:true });
  }
  function sampleWaypoints(coords,max){
    if(!coords || coords.length<=2) return coords || [];
    const out=[coords[0]];
    const steps=Math.min(max, coords.length-2);
    for(let i=1;i<=steps;i++) out.push(coords[Math.floor((coords.length-1)*i/(steps+1))]);
    out.push(coords[coords.length-1]);
    return out;
  }
  function openGoogleMapsRoute(){
    const r=activeRoute();
    const endCoord=routeCoordinates[routeCoordinates.length-1] || coordFor(r.end, DEFAULT_END);
    const sampled=sampleWaypoints(routeCoordinates,6).slice(1,-1);
    const params=new URLSearchParams({ api:'1', travelmode:'driving', destination:`${endCoord[1]},${endCoord[0]}` });
    if(sampled.length) params.set('waypoints', sampled.map(c=>`${c[1]},${c[0]}`).join('|'));
    window.open(`https://www.google.com/maps/dir/?${params.toString()}`,'_blank','noopener');
  }
  window.RoadoraMapsExport = { open: openGoogleMapsRoute };
  window.RoadoraMap = {
    ensure(){ ensureBase(); setTimeout(()=>{ map?.invalidateSize(false); loadRoute(); },120); },
    refresh(){ loadRoute(true); },
    fit: fitRoute
  };
  if(document.body.dataset.activeScreen === 'map') window.RoadoraMap.ensure();
})();


/* Roadora Map Navigation Layer v1 */
(function(){
  if (window.__roadoraMapNavLayerV1) return;
  window.__roadoraMapNavLayerV1 = true;

  function setMapNavActive(panel){
    document.querySelectorAll(".map-nav-layer-v1 .map-nav-item").forEach(function(btn){
      btn.classList.toggle("is-active", btn.dataset.mapPanel === panel);
    });
    document.body.setAttribute("data-map-panel", panel || "roadtrip");
  }

  document.addEventListener("click", function(e){
    var btn = e.target.closest(".map-nav-layer-v1 .map-nav-item");
    if (!btn) return;

    var panel = btn.dataset.mapPanel || "roadtrip";
    setMapNavActive(panel);

    /* V1 is bewust veilig:
       - Roadtrip = bestaande sheet blijft leidend
       - Stops / Nu nodig / Meer zetten alleen state voor volgende stap
       - geen route-engine, Leaflet of Google Maps export aangepast
    */
  });

  document.addEventListener("DOMContentLoaded", function(){
    setMapNavActive(document.body.getAttribute("data-map-panel") || "roadtrip");
  });
})();


/* Roadora Map Bottom Nav Pixel v2 */
(function(){
  if (window.__roadoraMapBottomNavPixelV2) return;
  window.__roadoraMapBottomNavPixelV2 = true;

  function setMapPanel(panel){
    panel = panel || "roadtrip";
    document.body.setAttribute("data-map-panel", panel);
    document.querySelectorAll(".map-nav-pixel-v2 .mnp-item").forEach(function(btn){
      btn.classList.toggle("is-active", btn.dataset.mapPanel === panel);
    });
  }

  document.addEventListener("click", function(e){
    var btn = e.target.closest(".map-nav-pixel-v2 .mnp-item");
    if (!btn) return;
    setMapPanel(btn.dataset.mapPanel || "roadtrip");
  });

  document.addEventListener("DOMContentLoaded", function(){
    setMapPanel(document.body.getAttribute("data-map-panel") || "roadtrip");
  });
})();


/* Roadora Map Bottom Nav Correct v5 */
(function(){
  if (window.__roadoraMapBottomNavV5) return;
  window.__roadoraMapBottomNavV5 = true;

  function setPanel(panel){
    panel = panel || "roadtrip";
    document.body.setAttribute("data-map-panel", panel);
    document.querySelectorAll(".map-bottom-nav-v5 .mbn-item").forEach(function(btn){
      btn.classList.toggle("is-active", btn.dataset.mapPanel === panel);
    });
  }

  document.addEventListener("click", function(e){
    var btn = e.target.closest(".map-bottom-nav-v5 .mbn-item");
    if (!btn) return;
    setPanel(btn.dataset.mapPanel || "roadtrip");
  });

  document.addEventListener("DOMContentLoaded", function(){
    setPanel(document.body.getAttribute("data-map-panel") || "roadtrip");
  });
})();


/* Roadora Map Bottom Nav v8 Clean Rebuild */
(function(){
  if (window.__roadoraMapBottomNavV8) return;
  window.__roadoraMapBottomNavV8 = true;

  function setMapPanel(panel){
    panel = panel || "roadtrip";
    document.body.setAttribute("data-map-panel", panel);
    document.querySelectorAll(".map-bottom-nav-v8 .mb8-item").forEach(function(btn){
      btn.classList.toggle("is-active", btn.dataset.mapPanel === panel);
    });
  }

  document.addEventListener("click", function(e){
    var btn = e.target.closest(".map-bottom-nav-v8 .mb8-item");
    if (!btn) return;
    setMapPanel(btn.dataset.mapPanel || "roadtrip");
  });

  document.addEventListener("DOMContentLoaded", function(){
    setMapPanel(document.body.getAttribute("data-map-panel") || "roadtrip");
  });
})();


/* Roadora Map Bottom Nav v9 Mockup Match */
(function(){
  if (window.__roadoraMapBottomNavV9) return;
  window.__roadoraMapBottomNavV9 = true;

  function setMapPanel(panel){
    panel = panel || "roadtrip";
    document.body.setAttribute("data-map-panel", panel);
    document.querySelectorAll(".map-bottom-nav-v9 .mb9-item").forEach(function(btn){
      btn.classList.toggle("is-active", btn.dataset.mapPanel === panel);
    });
  }

  document.addEventListener("click", function(e){
    var btn = e.target.closest(".map-bottom-nav-v9 .mb9-item");
    if (!btn) return;
    setMapPanel(btn.dataset.mapPanel || "roadtrip");
  });

  document.addEventListener("DOMContentLoaded", function(){
    setMapPanel(document.body.getAttribute("data-map-panel") || "roadtrip");
  });
})();


/* Roadora v28 clean map nav active state */
(function(){
  if (window.__roadoraMapNavV28) return;
  window.__roadoraMapNavV28 = true;

  document.addEventListener("click", function(e){
    var btn = e.target.closest(".rd-map-nav-v28 .rd-nav-btn-v28");
    if (!btn) return;
    var panel = btn.dataset.mapPanel || "roadtrip";
    document.body.setAttribute("data-map-panel", panel);
    document.querySelectorAll(".rd-map-nav-v28 .rd-nav-btn-v28").forEach(function(x){
      x.classList.toggle("is-active", x === btn);
    });
  });
})();


/* Roadora v38 Map Sheet Drawer */
(function(){
  if (window.__roadoraMapSheetDrawerV38) return;
  window.__roadoraMapSheetDrawerV38 = true;

  var panelContent = {
    roadtrip: {
      title: "Live roadtrip",
      heading: "Je rit loopt",
      meta: "Rotterdam → Innsbruck · Motor",
      desc: "Je kaart blijft leidend. Roadora houdt route, stops en snelle acties rustig bij elkaar.",
      chips: ["Route actief", "Volgende stop", "Maps klaar"],
      cards: [
        { icon: "⌁", label: "Volgende stop", value: "Over 1u 35m" },
        { icon: "↗", label: "Aankomst", value: "18:42" },
        { icon: "◇", label: "Afstand", value: "1.042 km" },
        { icon: "◎", label: "Route", value: "ORS actief" }
      ],
      actions: [
        { label: "Bekijk route", type: "primary" },
        { label: "Navigeer", type: "ghost" }
      ]
    },
    stops: {
      title: "",
      heading: "",
      meta: "",
      desc: "",
      chips: [],
      cards: [
        { icon: "☾", label: "Hotels", value: "Hotels" },
        { icon: "⛽", label: "Tankstations", value: "Tankstations" },
        { icon: "⚡", label: "Laadpalen", value: "Laadpalen" },
        { icon: "🍴", label: "Eten", value: "Eten" },
        { icon: "◌", label: "Uitjes", value: "Uitjes" },
        { icon: "⌖", label: "WC", value: "WC" }
      ],
      actions: []
    },
    sleep: {
      title: "Overnachten",
      heading: "Hotels onderweg",
      meta: "Route-aware · shortlist · rustig plannen",
      desc: "Snel een logische overnachting vinden zonder de kaart of routeflow kwijt te raken.",
      chips: ["Beste timing", "Parkeren", "Huisdieren", "EV mogelijk"],
      cards: [
        { icon: "☾", label: "Beste regio", value: "Zuid-Duitsland" },
        { icon: "◷", label: "Adviesmoment", value: "Na 6u rijden" },
        { icon: "♡", label: "Shortlist", value: "0 hotels" },
        { icon: "↘", label: "Omweg", value: "Laag houden" }
      ],
      actions: [
        { label: "Zoek hotels", type: "primary" },
        { label: "Shortlist", type: "ghost" }
      ]
    },
    food: {
      title: "Eten & pauze",
      heading: "Eten langs route",
      meta: "Koffie · lunch · diner · gezin",
      desc: "Eten vinden op een logisch moment, zonder eindeloos te zoeken of van de route te raken.",
      chips: ["Koffie", "Lunch", "Diner", "Gezin"],
      cards: [
        { icon: "☕", label: "Koffie", value: "Binnen 18 min" },
        { icon: "🍴", label: "Lunch", value: "Rond 13:00" },
        { icon: "◌", label: "Rustige stop", value: "Aanbevolen" },
        { icon: "✓", label: "Open nu", value: "Filter klaar" }
      ],
      actions: [
        { label: "Zoek eten", type: "primary" },
        { label: "Alle pauzes", type: "ghost" }
      ]
    },
    energy: {
      title: "Tanken & laden",
      heading: "Energie onderweg",
      meta: "Brandstof · EV · voertuigprofiel",
      desc: "Tanken of laden blijft straks gekoppeld aan voertuig, afstand en routecontext.",
      chips: ["Tankstation", "Snellader", "Goedkoop", "Open"],
      cards: [
        { icon: "⛽", label: "Tankstop", value: "Over 52 km" },
        { icon: "⚡", label: "Snellader", value: "Route-ready" },
        { icon: "✓", label: "Open status", value: "Google-ready" },
        { icon: "◎", label: "Voertuig", value: "Motor" }
      ],
      actions: [
        { label: "Toon opties", type: "primary" },
        { label: "Voorkeuren", type: "ghost" }
      ]
    },
    now: {
      title: "Nu nodig",
      heading: "Snelle assistent",
      meta: "WC · koffie · tanken · laden",
      desc: "Voor directe behoeften onderweg. Compact, snel en kaart-first.",
      chips: ["WC", "Koffie", "Brandstof", "Laden"],
      cards: [
        { icon: "⌖", label: "Dichtstbij", value: "4 min" },
        { icon: "✓", label: "Open", value: "Nu beschikbaar" },
        { icon: "☕", label: "Koffie", value: "Langs route" },
        { icon: "↘", label: "Omweg", value: "Beperkt" }
      ],
      actions: [
        { label: "Zoek dichtbij", type: "primary" },
        { label: "Langs route", type: "ghost" }
      ]
    },
    more: {
      title: "Meer",
      heading: "Roadora tools",
      meta: "Opslaan · delen · instellingen",
      desc: "Extra acties blijven hier gegroepeerd zodat de kaart schoon en overzichtelijk blijft.",
      chips: ["Opslaan", "Delen", "Profiel", "Instellingen"],
      cards: [
        { icon: "♡", label: "Roadtrip", value: "Autosave actief" },
        { icon: "↗", label: "Delen", value: "Link klaar" },
        { icon: "◎", label: "Profiel", value: "Later koppelen" },
        { icon: "▣", label: "Offline", value: "Binnenkort" }
      ],
      actions: [
        { label: "Route opslaan", type: "primary" },
        { label: "Deel roadtrip", type: "ghost" }
      ]
    }
  };

  function setDrawerPanel(panel){
    panel = panel || "roadtrip";
    var body = document.body;
    var sheet = document.getElementById("mapDrawer");
    var data = panelContent[panel] || panelContent.roadtrip;

    body.setAttribute("data-map-panel", panel);
    body.setAttribute("data-map-drawer", "open");
    body.setAttribute("data-active-map-tab", panel);
    setDrawerState("half");

    document.querySelectorAll(".rd-map-nav-v28 .rd-nav-btn-v28").forEach(function(btn){
      btn.classList.toggle("is-active", btn.dataset.mapPanel === panel);
    });

    if (sheet) {
      var overline = sheet.querySelector(".rd-sheet-title-v28");
      var title = sheet.querySelector("#stopHeading");
      var meta = sheet.querySelector("#stopMeta, .rd-sheet-meta-v28");
      var desc = sheet.querySelector("#stopDesc, .rd-sheet-desc-v28");

      if (overline) overline.textContent = data.title;
      if (title) title.textContent = data.heading;
      if (meta) meta.textContent = data.meta;
      
      if (desc) desc.textContent = data.desc;

      var chips = sheet.querySelector(".rd-sheet-chips-v39");
      var cards = sheet.querySelector(".rd-sheet-cards-v39");

      if (chips) {
        chips.innerHTML = "";
        chips.classList.toggle("rd-sheet-is-empty-v396", !(data.chips || []).length);
        (data.chips || []).forEach(function(chip){
          var el = document.createElement("div");
          el.className = "rd-sheet-chip-v39";
          el.textContent = chip;
          chips.appendChild(el);
        });
      }

      if (cards) {
        cards.innerHTML = "";
        (data.cards || []).forEach(function(card){
          var item = document.createElement("div");
          item.className = "rd-sheet-card-v39";
          item.innerHTML = '<span class="rd-sheet-card-icon-v394">' + (card.icon || "•") + '</span><span class="rd-sheet-card-text-v394"><small>' + card.label + '</small><strong>' + card.value + '</strong></span>';
          cards.appendChild(item);
        });
      }

      var actions = sheet.querySelector(".rd-sheet-actions-v392");
      if (actions) {
        actions.innerHTML = "";
        actions.classList.toggle("rd-sheet-is-empty-v396", !(data.actions || []).length);
        (data.actions || []).forEach(function(action){
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "rd-sheet-action-v392 " + (action.type === "primary" ? "is-primary" : "is-ghost");
          btn.textContent = action.label;
          actions.appendChild(btn);
        });
      }

    }
  }


  var drawerStates = ["collapsed", "half", "expanded"];
  var currentDrawerState = "half";

  function setDrawerState(state){
    currentDrawerState = state || "half";
    document.body.setAttribute("data-sheet-state", currentDrawerState);
  }

  function closeDrawer(){
    document.body.removeAttribute("data-map-drawer");
    document.querySelectorAll(".rd-map-nav-v28 .rd-nav-btn-v28").forEach(function(btn){
      btn.classList.remove("is-active");
    });
  }

  document.addEventListener("click", function(e){
    var btn = e.target.closest(".rd-map-nav-v28 .rd-nav-btn-v28");
    if (!btn) return;

    var panel = btn.dataset.mapPanel || "roadtrip";
    var isOpen = document.body.getAttribute("data-map-drawer") === "open";
    var current = document.body.getAttribute("data-map-panel");

    if (isOpen && current === panel) {
      closeDrawer();
      return;
    }

    setDrawerPanel(panel);
  });

  
  document.addEventListener("click", function(e){
    var grab = e.target.closest(".rd-sheet-grab-v28");
    if (!grab) return;

    var currentIndex = drawerStates.indexOf(currentDrawerState);
    var nextState = drawerStates[(currentIndex + 1) % drawerStates.length];
    setDrawerState(nextState);
  });


  document.addEventListener("keydown", function(e){
    if (e.key === "Escape") closeDrawer();
  });
})();



/* ===== Roadora v39.6.4 Category Click State ===== */
(function(){
  var CATEGORY_ALIASES = {
    hotels: "hotels",
    hotel: "hotels",
    tanken: "fuel",
    tankstations: "fuel",
    fuel: "fuel",
    laadpalen: "charge",
    laden: "charge",
    charge: "charge",
    eten: "food",
    food: "food",
    uitjes: "discover",
    discover: "discover",
    wc: "wc"
  };

  function normalizeCategory(text){
    var key = String(text || "").toLowerCase().trim();
    key = key.replace(/\s+/g, "");
    return CATEGORY_ALIASES[key] || key || "stops";
  }

  function getLabelFromCard(card){
    if (!card) return "";
    var strong = card.querySelector("strong");
    if (strong && strong.textContent) return strong.textContent;
    var text = card.textContent || "";
    return text.replace(/[›>]/g, "").trim();
  }

  function setActiveCategory(category){
    category = normalizeCategory(category);
    document.body.setAttribute("data-active-stop-category", category);

    var cards = document.querySelectorAll("#mapDrawer .rd-sheet-card-v39, .rd-sheet-card-v39");
    cards.forEach(function(card){
      var label = getLabelFromCard(card);
      var cardCategory = normalizeCategory(label);
      card.classList.toggle("is-active-category-v3964", cardCategory === category);
    });

    // Future hook: map pin rendering can listen for this event without coupling to the drawer.
    window.dispatchEvent(new CustomEvent("roadora:stop-category-change", {
      detail: { category: category }
    }));

    if (window.RoadoraApp) {
      window.RoadoraApp.activeStopCategory = category;
    }
  }

  document.addEventListener("click", function(ev){
    var card = ev.target.closest("#mapDrawer .rd-sheet-card-v39, .rd-sheet-card-v39");
    if (!card) return;

    var label = getLabelFromCard(card);
    if (!label) return;

    var category = normalizeCategory(label);
    var valid = ["hotels","fuel","charge","food","discover","wc"].indexOf(category) > -1;
    if (!valid) return;

    setActiveCategory(category);
  }, true);

  window.RoadoraSetStopCategory = setActiveCategory;
})();


/* ===== Roadora v39.6.7 Roadtrip Button Link ===== */
/* Alleen Roadtrip-knop in de kaart-bottomnav koppelen aan Mijn Roadtrip subpage. */
(function(){
  if (window.__roadoraRoadtripButtonLinkV3967) return;
  window.__roadoraRoadtripButtonLinkV3967 = true;

  function goToRoadtrip(){
    document.body.removeAttribute("data-map-drawer");

    if (typeof openScreen === "function") {
      openScreen("roadtrip");
      return;
    }

    if (window.RoadoraApp && typeof window.RoadoraApp.openScreen === "function") {
      window.RoadoraApp.openScreen("roadtrip");
      return;
    }

    var screens = document.querySelectorAll("[data-screen], .screen, .app-screen");
    screens.forEach(function(screen){
      var isRoadtrip = screen.getAttribute("data-screen") === "roadtrip" ||
                       screen.id === "roadtripScreen" ||
                       screen.id === "roadtripPage" ||
                       screen.classList.contains("roadtrip-screen");
      screen.classList.toggle("is-active", isRoadtrip);
      screen.classList.toggle("active", isRoadtrip);
      if (isRoadtrip) {
        screen.removeAttribute("hidden");
        screen.style.display = "";
      } else if (
        screen.id === "mapScreen" ||
        screen.getAttribute("data-screen") === "map" ||
        screen.classList.contains("map-screen")
      ) {
        screen.classList.remove("is-active", "active");
      }
    });

    document.body.setAttribute("data-active-screen", "roadtrip");
    document.body.setAttribute("data-screen", "roadtrip");
  }

  document.addEventListener("click", function(e){
    var btn = e.target.closest(".rd-map-nav-v28 .rd-nav-btn-v28, .rd-map-bottom-nav-v28 button, .map-bottom-nav button, .bottom-nav button, .rd-bottom-nav button");
    if (!btn) return;

    var label = (btn.textContent || "").toLowerCase();
    var panel = (btn.dataset && (btn.dataset.mapPanel || btn.dataset.panel || btn.dataset.tab || btn.dataset.screen)) || "";

    if (panel === "roadtrip" || label.indexOf("roadtrip") > -1) {
      e.preventDefault();
      e.stopPropagation();
      goToRoadtrip();
    }
  }, true);
})();


/* ===== Roadora v39.6.8 Instant Sheet Panel ===== */
/* Sheet opent direct boven locked bottom nav; geen slide vanuit onderkant scherm. */
(function(){
  if (window.__roadoraInstantSheetPanelV3968) return;
  window.__roadoraInstantSheetPanelV3968 = true;

  function getMapNavButton(target){
    return target.closest(".rd-map-nav-v28 .rd-nav-btn-v28, .rd-map-bottom-nav-v28 button, .map-bottom-nav button, .bottom-nav button, .rd-bottom-nav button");
  }

  function getPanelFromButton(btn){
    if (!btn) return "";
    var ds = btn.dataset || {};
    var panel = ds.mapPanel || ds.panel || ds.tab || ds.screen || "";
    if (panel) return panel;

    var label = (btn.textContent || "").toLowerCase();
    if (label.indexOf("roadtrip") > -1) return "roadtrip";
    if (label.indexOf("stop") > -1) return "stops";
    if (label.indexOf("nu") > -1) return "now";
    if (label.indexOf("meer") > -1) return "more";
    return "";
  }

  function markActiveNav(panel){
    document.querySelectorAll(".rd-map-nav-v28 .rd-nav-btn-v28, .rd-map-bottom-nav-v28 button, .map-bottom-nav button, .bottom-nav button, .rd-bottom-nav button").forEach(function(btn){
      var btnPanel = getPanelFromButton(btn);
      btn.classList.toggle("is-active", btnPanel === panel);
    });
  }

  function openInstantPanel(panel){
    panel = panel || "stops";
    document.body.setAttribute("data-map-drawer", "open");
    document.body.setAttribute("data-sheet-state", "half");
    document.body.setAttribute("data-instant-map-panel", panel);
    document.body.classList.add("rd-instant-panel-open-v3968");
    markActiveNav(panel);

    // Re-use existing panel renderer if available through old click handlers.
    // If the legacy code already rendered content, CSS now changes only the animation/position.
  }

  document.addEventListener("click", function(e){
    var btn = getMapNavButton(e.target);
    if (!btn) return;

    var panel = getPanelFromButton(btn);

    if (panel === "roadtrip") {
      // Let v39.6.7 handler handle Mijn Roadtrip.
      document.body.classList.remove("rd-instant-panel-open-v3968");
      document.body.removeAttribute("data-instant-map-panel");
      return;
    }

    if (panel === "stops" || panel === "now" || panel === "more") {
      // Do not block old handler; it may update the sheet content.
      setTimeout(function(){
        openInstantPanel(panel);
      }, 0);
      setTimeout(function(){
        openInstantPanel(panel);
      }, 40);
    }
  }, true);
})();



/* ===== Roadora v39.6.19 Integrated Stops Render Toggle ===== */
(function(){
  if(window.__roadoraIntegratedStopsRenderV39619) return;
  window.__roadoraIntegratedStopsRenderV39619 = true;

  const STOP_CARDS = [
    { icon:'☾', title:'Hotels', category:'hotels' },
    { icon:'⛽', title:'Tanken', category:'fuel' },
    { icon:'⚡', title:'Laden', category:'charge' },
    { icon:'🍴', title:'Eten', category:'food' },
    { icon:'◎', title:'Uitjes', category:'discover' },
    { icon:'WC', title:'WC', category:'wc' }
  ];

  function getBtn(target){
    return target && target.closest && target.closest(".rd-map-nav-v28 .rd-nav-btn-v28, .rd-map-bottom-nav-v28 button, .map-bottom-nav button, .bottom-nav button, .rd-bottom-nav button");
  }

  function getPanel(btn){
    if(!btn) return "";
    const ds = btn.dataset || {};
    const panel = ds.mapPanel || ds.panel || ds.tab || ds.screen || "";
    if(panel) return panel;
    const label = (btn.textContent || "").toLowerCase();
    if(label.indexOf("roadtrip") > -1) return "roadtrip";
    if(label.indexOf("stop") > -1) return "stops";
    if(label.indexOf("nu") > -1) return "now";
    if(label.indexOf("meer") > -1) return "more";
    return "";
  }

  function setNavActive(panel){
    document.querySelectorAll(".rd-map-nav-v28 .rd-nav-btn-v28, .rd-map-bottom-nav-v28 button, .map-bottom-nav button, .bottom-nav button, .rd-bottom-nav button").forEach(function(btn){
      btn.classList.toggle("is-active", getPanel(btn) === panel);
    });
  }

  function findStopsContainer(){
    const drawer = document.querySelector("#mapDrawer");
    if(!drawer) return null;
    return drawer.querySelector(".rd-sheet-cards-v39") ||
           drawer.querySelector(".rd-sheet-scroll-v393") ||
           drawer.querySelector('[class*="cards"]') ||
           drawer;
  }

  const HOTEL_STRIP_CARDS_V39636 = [
    { name:'Van der Valk Venlo', meta:'105 km vanaf start', rating:'4.3', price:'€€', img:'assets/hero-hotels.webp' },
    { name:'Hotel Koblenz', meta:'245 km vanaf start', rating:'4.2', price:'€€', img:'assets/hero-overview.webp' },
    { name:'Hotel am Main', meta:'390 km vanaf start', rating:'4.4', price:'€€€', img:'assets/hero-routeplan.webp' },
    { name:'Landhotel Bayern', meta:'520 km vanaf start', rating:'4.5', price:'€€', img:'assets/hero-roadtrip.webp' },
    { name:'City Hotel München', meta:'680 km vanaf start', rating:'4.1', price:'€€', img:'assets/hero-hotels.webp' }
  ];


  const FUEL_STRIP_CARDS_V39646 = [
    { name:'Shell Venlo', meta:'98 km vanaf start', rating:'Open', price:'€1.89', img:'assets/hero-routeplan.webp', chips:['Koffie','Toilet','Shop'] },
    { name:'Aral Koblenz', meta:'238 km vanaf start', rating:'24/7', price:'€1.86', img:'assets/hero-overview.webp', chips:['24/7','Snelweg','Snacks'] },
    { name:'TotalEnergies Main', meta:'382 km vanaf start', rating:'Open', price:'€1.91', img:'assets/hero-roadtrip.webp', chips:['Rustplek','Koffie','Toilet'] },
    { name:'OMV Nürnberg', meta:'515 km vanaf start', rating:'Open', price:'€1.88', img:'assets/hero-hotels.webp', chips:['Shop','Parking','Eten'] },
    { name:'Esso München', meta:'665 km vanaf start', rating:'Open', price:'€1.93', img:'assets/hero-diary.webp', chips:['Laatste stop','Koffie','Toilet'] }
  ];

  const CHARGE_STRIP_CARDS_V39647 = [
    { name:'Fastned Venlo', meta:'110 km vanaf start', rating:'4/6 vrij', power:'300 kW', img:'assets/hero-routeplan.webp', chips:['Snellader','CCS','Koffie'] },
    { name:'Ionity Koblenz', meta:'255 km vanaf start', rating:'3/4 vrij', power:'350 kW', img:'assets/hero-overview.webp', chips:['Ultra fast','24/7','Parking'] },
    { name:'EnBW Würzburg', meta:'430 km vanaf start', rating:'5/8 vrij', power:'300 kW', img:'assets/hero-roadtrip.webp', chips:['Snelweg','Toilet','Shop'] },
    { name:'Tesla Nürnberg', meta:'545 km vanaf start', rating:'8/12 vrij', power:'250 kW', img:'assets/hero-hotels.webp', chips:['Supercharger','Rustplek','Eten'] },
    { name:'Aral Pulse München', meta:'690 km vanaf start', rating:'2/4 vrij', power:'300 kW', img:'assets/hero-diary.webp', chips:['HPC','Laatste stop','Koffie'] }
  ];

  const FOOD_STRIP_CARDS_V39648 = [
    { name:'Bistro Maasduinen', meta:'115 km vanaf start', rating:'4.5', type:'Lunch', img:'assets/hero-routeplan.webp', chips:['Terras','Koffie','Rustig'] },
    { name:'Rheinblick Café', meta:'260 km vanaf start', rating:'4.4', type:'Koffie', img:'assets/hero-overview.webp', chips:['Uitzicht','Gebak','Parkeren'] },
    { name:'Gasthof Würzburg', meta:'420 km vanaf start', rating:'4.6', type:'Diner', img:'assets/hero-roadtrip.webp', chips:['Warm eten','Toilet','Familie'] },
    { name:'Autohof Nürnberg', meta:'555 km vanaf start', rating:'4.1', type:'Snelle hap', img:'assets/hero-hotels.webp', chips:['Snelweg','24/7','Shop'] },
    { name:'Alpen Café München', meta:'690 km vanaf start', rating:'4.7', type:'Ontbijt', img:'assets/hero-diary.webp', chips:['Ontbijt','Koffie','Laatste stop'] }
  ];

  const FOOD_FILTERS_V39678 = [
    { icon:'🍔', title:'Fastfood', key:'fastfood' },
    { icon:'☕', title:'Koffie', key:'coffee' },
    { icon:'🍽', title:'Restaurant', key:'restaurant' },
    { icon:'🥐', title:'Bakery', key:'bakery' },
    { icon:'🛒', title:'Supermarkt', key:'supermarket' },
    { icon:'🚗', title:'Drive-thru', key:'drivethru' }
  ];

  const FOOD_STRIP_BY_FILTER_V39678 = {
    fastfood: [
      { name:'McDonalds Venlo', meta:'108 km vanaf start', rating:'4.0', type:'Fastfood', img:'assets/hero-routeplan.webp', chips:['Snel','Drive-thru','WC'] },
      { name:'Burger King Koblenz', meta:'248 km vanaf start', rating:'4.1', type:'Fastfood', img:'assets/hero-overview.webp', chips:['Snelweg','Parking','Snacks'] },
      { name:'KFC Würzburg', meta:'425 km vanaf start', rating:'4.0', type:'Fastfood', img:'assets/hero-roadtrip.webp', chips:['Warm','Snel','Familie'] },
      { name:'Autohof Nürnberg', meta:'555 km vanaf start', rating:'4.1', type:'Snelle hap', img:'assets/hero-hotels.webp', chips:['24/7','Shop','Toilet'] },
      { name:'Subway München', meta:'685 km vanaf start', rating:'4.2', type:'Fastfood', img:'assets/hero-diary.webp', chips:['Broodjes','Snel','Parking'] }
    ],
    coffee: [
      { name:'Rheinblick Café', meta:'260 km vanaf start', rating:'4.4', type:'Koffie', img:'assets/hero-overview.webp', chips:['Uitzicht','Gebak','Parkeren'] },
      { name:'Starbucks Autohof', meta:'390 km vanaf start', rating:'4.2', type:'Koffie', img:'assets/hero-routeplan.webp', chips:['Take-away','Wifi','WC'] },
      { name:'Kaffee Mainblick', meta:'430 km vanaf start', rating:'4.5', type:'Café', img:'assets/hero-roadtrip.webp', chips:['Rustig','Terras','Gebak'] },
      { name:'Coffee Fellows', meta:'545 km vanaf start', rating:'4.3', type:'Koffie', img:'assets/hero-hotels.webp', chips:['Snelweg','Ontbijt','Parking'] },
      { name:'Alpen Café München', meta:'690 km vanaf start', rating:'4.7', type:'Ontbijt', img:'assets/hero-diary.webp', chips:['Ontbijt','Koffie','Laatste stop'] }
    ],
    restaurant: [
      { name:'Bistro Maasduinen', meta:'115 km vanaf start', rating:'4.5', type:'Lunch', img:'assets/hero-routeplan.webp', chips:['Terras','Rustig','Parkeren'] },
      { name:'Gasthof Würzburg', meta:'420 km vanaf start', rating:'4.6', type:'Diner', img:'assets/hero-roadtrip.webp', chips:['Warm eten','Toilet','Familie'] },
      { name:'Ratskeller Koblenz', meta:'255 km vanaf start', rating:'4.4', type:'Restaurant', img:'assets/hero-overview.webp', chips:['Lokaal','Centrum','Diner'] },
      { name:'Landgasthof Bayern', meta:'535 km vanaf start', rating:'4.5', type:'Restaurant', img:'assets/hero-hotels.webp', chips:['Duits','Rustig','Parking'] },
      { name:'Trattoria Süd', meta:'675 km vanaf start', rating:'4.3', type:'Restaurant', img:'assets/hero-diary.webp', chips:['Italiaans','Familie','Diner'] }
    ],
    bakery: [
      { name:'Bakker Maas', meta:'112 km vanaf start', rating:'4.3', type:'Bakery', img:'assets/hero-routeplan.webp', chips:['Broodjes','Koffie','Snel'] },
      { name:'BackWerk Koblenz', meta:'252 km vanaf start', rating:'4.1', type:'Bakery', img:'assets/hero-overview.webp', chips:['Ontbijt','Take-away','Budget'] },
      { name:'Bäckerei Main', meta:'410 km vanaf start', rating:'4.5', type:'Bakery', img:'assets/hero-roadtrip.webp', chips:['Gebak','Koffie','Lokaal'] },
      { name:'Der Beck Nürnberg', meta:'550 km vanaf start', rating:'4.4', type:'Bakery', img:'assets/hero-hotels.webp', chips:['Broodjes','Snel','Parkeren'] },
      { name:'München Bakery', meta:'690 km vanaf start', rating:'4.2', type:'Bakery', img:'assets/hero-diary.webp', chips:['Ontbijt','Koffie','Laatste stop'] }
    ],
    supermarket: [
      { name:'REWE To Go Venlo', meta:'105 km vanaf start', rating:'Open', type:'Supermarkt', img:'assets/hero-routeplan.webp', chips:['Snacks','Drinken','Snel'] },
      { name:'Edeka Koblenz', meta:'245 km vanaf start', rating:'Open', type:'Supermarkt', img:'assets/hero-overview.webp', chips:['Boodschappen','Parking','Lunch'] },
      { name:'REWE Würzburg', meta:'418 km vanaf start', rating:'Open', type:'Supermarkt', img:'assets/hero-roadtrip.webp', chips:['Picknick','Drinken','Fruit'] },
      { name:'Lidl Nürnberg', meta:'552 km vanaf start', rating:'Open', type:'Supermarkt', img:'assets/hero-hotels.webp', chips:['Budget','Snacks','Parking'] },
      { name:'Edeka München', meta:'682 km vanaf start', rating:'Open', type:'Supermarkt', img:'assets/hero-diary.webp', chips:['Boodschappen','Laatste stop','Parking'] }
    ],
    drivethru: [
      { name:'McDrive Venlo', meta:'110 km vanaf start', rating:'4.0', type:'Drive-thru', img:'assets/hero-routeplan.webp', chips:['Auto','Snel','24/7'] },
      { name:'Burger King Drive', meta:'240 km vanaf start', rating:'4.1', type:'Drive-thru', img:'assets/hero-overview.webp', chips:['Snelweg','Auto','Snacks'] },
      { name:'KFC Drive Würzburg', meta:'428 km vanaf start', rating:'4.0', type:'Drive-thru', img:'assets/hero-roadtrip.webp', chips:['Auto','Warm','Snel'] },
      { name:'McDrive Nürnberg', meta:'548 km vanaf start', rating:'4.2', type:'Drive-thru', img:'assets/hero-hotels.webp', chips:['24/7','Toilet','Parking'] },
      { name:'Coffee Drive München', meta:'688 km vanaf start', rating:'4.3', type:'Drive-thru', img:'assets/hero-diary.webp', chips:['Koffie','Ontbijt','Auto'] }
    ]
  };

  function getFoodCardsV39678(filterKey){
    const key = filterKey || document.body.getAttribute('data-food-filter') || 'restaurant';
    return FOOD_STRIP_BY_FILTER_V39678[key] || FOOD_STRIP_CARDS_V39648;
  }

  const DISCOVER_STRIP_CARDS_V39649 = [
    { name:'Uitzichtpunt Maasduinen', meta:'125 km vanaf start', rating:'4.6', type:'Natuur', img:'assets/hero-routeplan.webp', chips:['10 min omweg','Uitzicht','Fotostop'] },
    { name:'Rijnpromenade Koblenz', meta:'265 km vanaf start', rating:'4.5', type:'Wandeling', img:'assets/hero-overview.webp', chips:['Aan de rivier','Koffie dichtbij','Kort bezoek'] },
    { name:'Altstadt Würzburg', meta:'415 km vanaf start', rating:'4.7', type:'Stad', img:'assets/hero-roadtrip.webp', chips:['Historisch','Lunchplek','Parkeren'] },
    { name:'Kasteel Nürnberg', meta:'555 km vanaf start', rating:'4.6', type:'Bezienswaardigheid', img:'assets/hero-hotels.webp', chips:['Panorama','Cultuur','Ruststop'] },
    { name:'Alpenblick Rosenheim', meta:'735 km vanaf start', rating:'4.8', type:'Scenic stop', img:'assets/hero-diary.webp', chips:['Bergen','Foto','Laatste pauze'] }
  ];

  const DISCOVER_FILTERS_V39681 = [
    { icon:'🌄', title:'Uitzicht', key:'viewpoint' },
    { icon:'🏰', title:'Cultuur', key:'culture' },
    { icon:'🌲', title:'Natuur', key:'nature' },
    { icon:'🎡', title:'Activiteit', key:'activity' },
    { icon:'📸', title:'Fotostop', key:'photo' },
    { icon:'☕', title:'Lokaal', key:'local' }
  ];

  const DISCOVER_STRIP_BY_FILTER_V39681 = {
    viewpoint: [
      { name:'Uitzichtpunt Maasduinen', meta:'125 km vanaf start', rating:'4.6', type:'Uitzicht', img:'assets/hero-routeplan.webp', chips:['10 min omweg','Panorama','Fotostop'] },
      { name:'Rheinblick Koblenz', meta:'265 km vanaf start', rating:'4.7', type:'Uitzicht', img:'assets/hero-overview.webp', chips:['Rivier','Koffie dichtbij','Kort bezoek'] },
      { name:'Mainblick Würzburg', meta:'415 km vanaf start', rating:'4.5', type:'Uitzicht', img:'assets/hero-roadtrip.webp', chips:['Panorama','Parkeren','Zonsondergang'] },
      { name:'Burcht Nürnberg View', meta:'555 km vanaf start', rating:'4.6', type:'Uitzicht', img:'assets/hero-hotels.webp', chips:['Stadzicht','Cultuur','Fotostop'] },
      { name:'Alpenblick Rosenheim', meta:'735 km vanaf start', rating:'4.8', type:'Uitzicht', img:'assets/hero-diary.webp', chips:['Bergen','Laatste pauze','Foto'] }
    ],
    culture: [
      { name:'Altstadt Koblenz', meta:'255 km vanaf start', rating:'4.5', type:'Cultuur', img:'assets/hero-overview.webp', chips:['Oude stad','Koffie','Kort bezoek'] },
      { name:'Dom van Limburg', meta:'190 km vanaf start', rating:'4.6', type:'Cultuur', img:'assets/hero-routeplan.webp', chips:['Historisch','Fotostop','Rustig'] },
      { name:'Residenz Würzburg', meta:'420 km vanaf start', rating:'4.7', type:'Cultuur', img:'assets/hero-roadtrip.webp', chips:['UNESCO','Parkeren','Museum'] },
      { name:'Kasteel Nürnberg', meta:'555 km vanaf start', rating:'4.6', type:'Cultuur', img:'assets/hero-hotels.webp', chips:['Kasteel','Panorama','Centrum'] },
      { name:'Altstadt München', meta:'690 km vanaf start', rating:'4.4', type:'Cultuur', img:'assets/hero-diary.webp', chips:['Stad','Lunchplek','Bezienswaardigheid'] }
    ],
    nature: [
      { name:'Maasduinen wandelstop', meta:'125 km vanaf start', rating:'4.6', type:'Natuur', img:'assets/hero-routeplan.webp', chips:['Wandelen','Rust','Parkeren'] },
      { name:'Rijnbocht Koblenz', meta:'265 km vanaf start', rating:'4.5', type:'Natuur', img:'assets/hero-overview.webp', chips:['Rivier','Uitzicht','Korte stop'] },
      { name:'Spessart bosstop', meta:'390 km vanaf start', rating:'4.4', type:'Natuur', img:'assets/hero-roadtrip.webp', chips:['Bos','Picknick','Rustig'] },
      { name:'Fränkische Schweiz', meta:'560 km vanaf start', rating:'4.7', type:'Natuur', img:'assets/hero-hotels.webp', chips:['Rotsen','Wandelen','Foto'] },
      { name:'Alpenrand pauzeplek', meta:'730 km vanaf start', rating:'4.8', type:'Natuur', img:'assets/hero-diary.webp', chips:['Bergen','Laatste stop','Rust'] }
    ],
    activity: [
      { name:'Adventure Maasduinen', meta:'130 km vanaf start', rating:'4.3', type:'Activiteit', img:'assets/hero-routeplan.webp', chips:['Buiten','Gezin','Korte omweg'] },
      { name:'Kabelbaan Koblenz', meta:'268 km vanaf start', rating:'4.6', type:'Activiteit', img:'assets/hero-overview.webp', chips:['Uitzicht','Leuk met kids','Stad'] },
      { name:'Zwembad Würzburg', meta:'418 km vanaf start', rating:'4.2', type:'Activiteit', img:'assets/hero-roadtrip.webp', chips:['Pauze','Familie','Binnen'] },
      { name:'Playmobil FunPark', meta:'548 km vanaf start', rating:'4.5', type:'Activiteit', img:'assets/hero-hotels.webp', chips:['Kids','Langere stop','Parking'] },
      { name:'Rodelbaan Alpenrand', meta:'725 km vanaf start', rating:'4.7', type:'Activiteit', img:'assets/hero-diary.webp', chips:['Bergen','Actief','Foto'] }
    ],
    photo: [
      { name:'Fotopunt Maasduinen', meta:'125 km vanaf start', rating:'4.6', type:'Fotostop', img:'assets/hero-routeplan.webp', chips:['Golden hour','Natuur','Kort'] },
      { name:'Rijnpromenade Koblenz', meta:'265 km vanaf start', rating:'4.5', type:'Fotostop', img:'assets/hero-overview.webp', chips:['Rivier','Stad','Uitzicht'] },
      { name:'Würzburg brugzicht', meta:'418 km vanaf start', rating:'4.7', type:'Fotostop', img:'assets/hero-roadtrip.webp', chips:['Historisch','Panorama','Snel'] },
      { name:'Nürnberg skyline', meta:'555 km vanaf start', rating:'4.6', type:'Fotostop', img:'assets/hero-hotels.webp', chips:['Kasteel','Stad','Zonsondergang'] },
      { name:'Alpenblick Rosenheim', meta:'735 km vanaf start', rating:'4.8', type:'Fotostop', img:'assets/hero-diary.webp', chips:['Bergen','Laatste pauze','Wow'] }
    ],
    local: [
      { name:'Lokale markt Venlo', meta:'110 km vanaf start', rating:'4.2', type:'Lokaal', img:'assets/hero-routeplan.webp', chips:['Markt','Koffie','Snel'] },
      { name:'Bakkerij Koblenz', meta:'250 km vanaf start', rating:'4.4', type:'Lokaal', img:'assets/hero-overview.webp', chips:['Gebak','Koffie','Centrum'] },
      { name:'Wijnstop Franken', meta:'430 km vanaf start', rating:'4.6', type:'Lokaal', img:'assets/hero-roadtrip.webp', chips:['Streek','Uitzicht','Rustig'] },
      { name:'Nürnberg koffiehuis', meta:'555 km vanaf start', rating:'4.5', type:'Lokaal', img:'assets/hero-hotels.webp', chips:['Lokaal','Terras','Kort bezoek'] },
      { name:'Bayerische Biergarten', meta:'690 km vanaf start', rating:'4.4', type:'Lokaal', img:'assets/hero-diary.webp', chips:['Regionaal','Eten','Gezellig'] }
    ]
  };

  function getDiscoverCardsV39681(filterKey){
    const key = filterKey || document.body.getAttribute('data-discover-filter') || 'viewpoint';
    return DISCOVER_STRIP_BY_FILTER_V39681[key] || DISCOVER_STRIP_CARDS_V39649;
  }


  const WC_STRIP_CARDS_V39653 = [
    { name:'Rastplatz Maasduinen', meta:'118 km vanaf start', rating:'Schoon', type:'WC', img:'assets/hero-routeplan.webp', chips:['Schoon','Parkeren','24/7'] },
    { name:'Service Koblenz', meta:'248 km vanaf start', rating:'Open', type:'WC', img:'assets/hero-overview.webp', chips:['Snelweg','Koffie','Parkeren'] },
    { name:'Pauzeplaats Main', meta:'392 km vanaf start', rating:'Schoon', type:'WC', img:'assets/hero-roadtrip.webp', chips:['Rustplek','Familie','Shop'] },
    { name:'Raststätte Nürnberg', meta:'548 km vanaf start', rating:'Open', type:'WC', img:'assets/hero-hotels.webp', chips:['24/7','Toilet','Snacks'] },
    { name:'Stop München Süd', meta:'690 km vanaf start', rating:'Schoon', type:'WC', img:'assets/hero-diary.webp', chips:['Laatste stop','Parkeren','Koffie'] }
  ];

  const NOW_NEEDED_CARDS_V39656 = [
    { icon:'⛽', title:'Tanken', meta:'Dichtbij via GPS', category:'fuel', hint:'Open tankstations rondom jou' },
    { icon:'⚡', title:'Laden', meta:'Dichtbij via GPS', category:'charge', hint:'Snelle laadpunten in je buurt' },
    { icon:'WC', title:'WC', meta:'Snelste stop', category:'wc', hint:'Praktische sanitaire stop' },
    { icon:'☕', title:'Eten', meta:'Koffie of snelle hap', category:'food', hint:'Pauzeplek dichtbij' },
    { icon:'☾', title:'Slapen', meta:'Hotel nu dichtbij', category:'sleep', hint:'Overnachten vanaf je locatie' },
    { icon:'SOS', title:'Hulp', meta:'Pech / garage', category:'help', hint:'Hulpdiensten en praktische support' }
  ];

  const NOW_HELP_FILTERS_V39674 = [
    { icon:'💊', title:'Apotheek', category:'help_pharmacy' },
    { icon:'🏥', title:'Ziekenhuis', category:'help_hospital' },
    { icon:'🔧', title:'Garage', category:'help_garage' },
    { icon:'🚑', title:'Pechhulp', category:'help_roadside' },
    { icon:'🛞', title:'Banden', category:'help_tires' },
    { icon:'👮', title:'Politie', category:'help_police' }
  ];


  const NOW_ASSIST_DATA_V39670 = {
    fuel: {
      title:'Tanken dichtbij', label:'Tanken', icon:'⛽', best:'Shell Hazeldonk', meta:'4 min · 2,1 km', sub:'Open 24/7 · snel bereikbaar', chips:['Open','Shop'], action:'Navigeer',
      alternatives:[{name:'BP Galder', meta:'6 min · 3,4 km'},{name:'TotalEnergies', meta:'7 min · 4,2 km'},{name:'Esso Rijsbergen', meta:'9 min · 5,6 km'}]
    },
    charge: {
      title:'Laden dichtbij', label:'Laden', icon:'⚡', best:'Fastned Breda', meta:'5 min · 3,0 km', sub:'Snellader · 150 kW', chips:['150 kW','Vrij'], action:'Navigeer',
      alternatives:[{name:'Allego', meta:'8 min · 4,8 km'},{name:'Ionity', meta:'12 min · 8,1 km'},{name:'Shell Recharge', meta:'14 min · 9,6 km'}]
    },
    wc: {
      title:'WC in de buurt', label:'WC', icon:'WC', best:'Rastplaats Hazeldonk', meta:'4 min · 2,1 km', sub:'Schoon · parkeren dichtbij', chips:['Schoon','Open'], action:'Navigeer',
      alternatives:[{name:'Shell Hazeldonk', meta:'5 min · 2,8 km'},{name:'BP Galder', meta:'7 min · 4,1 km'},{name:'Servicepunt Breda', meta:'9 min · 5,9 km'}]
    },
    food: {
      title:'Eten dichtbij', label:'Eten', icon:'☕', best:'La Place Breda', meta:'6 min · 3,4 km', sub:'Koffie · snelle hap', chips:['Koffie','Lunch'], action:'Navigeer',
      alternatives:[{name:'McDonald’s', meta:'7 min · 4,0 km'},{name:'Bakker Bart', meta:'9 min · 5,2 km'},{name:'Starbucks', meta:'11 min · 6,8 km'}]
    },
    sleep: {
      title:'Slapen dichtbij', label:'Slapen', icon:'☾', best:'Van der Valk Breda', meta:'9 min · 6,2 km', sub:'Parkeren · late check-in', chips:['Parkeren','Wifi'], action:'Bekijk',
      alternatives:[{name:'Bastion Hotel', meta:'11 min · 7,4 km'},{name:'Hotel Nassau', meta:'15 min · 10,1 km'},{name:'Campanile', meta:'18 min · 12,6 km'}]
    },
    help: {
      title:'Hulp dichtbij', label:'Hulp', icon:'SOS', best:'Garage Breda Service', meta:'8 min · 5,1 km', sub:'Pechhulp · banden · olie', chips:['Garage','Open'], action:'Bel / Navigeer',
      alternatives:[{name:'ANWB punt', meta:'10 min · 6,8 km'},{name:'Apotheek', meta:'12 min · 8,0 km'},{name:'Ziekenhuis', meta:'16 min · 11,3 km'}]
    },
    help_pharmacy: {
      title:'Apotheek dichtbij', label:'Apotheek', icon:'💊', best:'Apotheek Breda Zuid', meta:'7 min · 3,8 km', sub:'Medicijnen · advies · open', chips:['Apotheek','Open'], action:'Navigeer',
      alternatives:[{name:'Service Apotheek', meta:'10 min · 6,1 km'},{name:'BENU Apotheek', meta:'13 min · 8,4 km'},{name:'Apotheek Centrum', meta:'15 min · 10,2 km'}]
    },
    help_hospital: {
      title:'Ziekenhuis dichtbij', label:'Ziekenhuis', icon:'🏥', best:'Amphia Ziekenhuis', meta:'11 min · 6,5 km', sub:'Spoed · parkeren · route', chips:['Spoed','Zorg'], action:'Navigeer',
      alternatives:[{name:'Huisartsenpost', meta:'14 min · 8,8 km'},{name:'Spoedpost Breda', meta:'16 min · 10,6 km'},{name:'Medisch Centrum', meta:'18 min · 12,4 km'}]
    },
    help_garage: {
      title:'Garage dichtbij', label:'Garage', icon:'🔧', best:'Garage Breda Service', meta:'8 min · 5,1 km', sub:'Pech · olie · diagnose', chips:['Garage','Open'], action:'Bel / Navigeer',
      alternatives:[{name:'KwikFit Breda', meta:'9 min · 5,6 km'},{name:'Bosch Car Service', meta:'12 min · 7,9 km'},{name:'Euromaster', meta:'14 min · 9,1 km'}]
    },
    help_roadside: {
      title:'Pechhulp dichtbij', label:'Pechhulp', icon:'🚑', best:'ANWB Servicepunt', meta:'10 min · 7,0 km', sub:'Pechhulp · noodservice', chips:['Pechhulp','24/7'], action:'Bel / Navigeer',
      alternatives:[{name:'Route Mobiel', meta:'12 min · 8,2 km'},{name:'Bergingsdienst', meta:'15 min · 10,4 km'},{name:'Garage noodhulp', meta:'18 min · 12,7 km'}]
    },
    help_tires: {
      title:'Bandenservice dichtbij', label:'Banden', icon:'🛞', best:'Euromaster Breda', meta:'9 min · 5,8 km', sub:'Bandenspanning · reparatie', chips:['Banden','Service'], action:'Navigeer',
      alternatives:[{name:'KwikFit', meta:'11 min · 7,1 km'},{name:'Profile Tyrecenter', meta:'13 min · 8,7 km'},{name:'Banden Express', meta:'16 min · 10,9 km'}]
    },
    help_police: {
      title:'Politie dichtbij', label:'Politie', icon:'👮', best:'Politiebureau Breda', meta:'13 min · 8,2 km', sub:'Veiligheid · melding', chips:['Politie','Veilig'], action:'Navigeer',
      alternatives:[{name:'Servicepunt Politie', meta:'17 min · 10,8 km'},{name:'Gemeente loket', meta:'19 min · 12,0 km'},{name:'Noodnummer 112', meta:'Direct'}]
    }
  };

  function updateNowGpsStatusV39656(){
    const status = document.querySelector('#mapDrawer .rd-now-gps-status-v39656');
    if(!status) return;
    if(!navigator.geolocation){
      status.textContent = 'GPS niet beschikbaar';
      return;
    }
    status.textContent = 'GPS zoeken…';
    navigator.geolocation.getCurrentPosition(function(pos){
      const acc = pos && pos.coords && pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null;
      status.textContent = acc ? 'GPS actief · ± '+acc+' m' : 'GPS actief';
      document.body.setAttribute('data-now-gps','ready');
    }, function(){
      status.textContent = 'GPS toestemming nodig';
      document.body.setAttribute('data-now-gps','blocked');
    }, { enableHighAccuracy:false, timeout:3500, maximumAge:120000 });
  }

  function renderNowNeeded(){
    const container = findStopsContainer();
    if(!container) return;
    document.body.removeAttribute('data-stop-subpanel');
    document.body.removeAttribute('data-now-assist');
    document.body.removeAttribute('data-now-help-sub');
    document.body.setAttribute('data-now-needed','open');
    closeHotelPreview();
    container.innerHTML =
      '<span class="rd-now-gps-status-v39656" aria-live="polite">GPS voorbereiden…</span>' +
      NOW_NEEDED_CARDS_V39656.map(function(card){
        return '<button type="button" class="rd-render-stop-card-v39619" data-now-category="'+card.category+'">' +
          '<span class="rd-render-stop-icon-v39619">'+card.icon+'</span>' +
          '<strong>'+card.title+'</strong><em>›</em>' +
        '</button>';
      }).join('');
    setTimeout(updateNowGpsStatusV39656, 80);
  }

  function renderNowHelpFilters(){
    const container = findStopsContainer();
    if(!container) return;
    document.body.removeAttribute('data-stop-subpanel');
    document.body.removeAttribute('data-now-assist');
    document.body.setAttribute('data-now-needed','open');
    document.body.setAttribute('data-now-help-sub','open');
    closeHotelPreview();
    container.innerHTML = NOW_HELP_FILTERS_V39674.map(function(card){
      return '<button type="button" class="rd-render-stop-card-v39619" data-now-help-type="'+card.category+'">' +
        '<span class="rd-render-stop-icon-v39619">'+card.icon+'</span>' +
        '<strong>'+card.title+'</strong><em>›</em>' +
      '</button>';
    }).join('');
  }

  function renderNowAssist(category, selectedIndex){
    const container = findStopsContainer();
    if(!container) return;
    const data = NOW_ASSIST_DATA_V39670[category] || NOW_ASSIST_DATA_V39670.wc;
    const allOptions = [{
      name:data.best,
      meta:data.meta,
      sub:data.sub,
      originalBest:true
    }].concat(data.alternatives || []);
    const activeIndex = Math.max(0, Math.min(Number(selectedIndex || 0), allOptions.length - 1));
    const active = allOptions[activeIndex] || allOptions[0];
    document.body.removeAttribute('data-stop-subpanel');
    document.body.removeAttribute('data-now-help-sub');
    document.body.setAttribute('data-now-needed','open');
    document.body.setAttribute('data-now-assist', category);
    document.body.setAttribute('data-now-selected-index', String(activeIndex));
    closeHotelPreview();
    const alternatives = allOptions.map(function(item, index){
      if(index === activeIndex) return '';
      return '<button type="button" class="rd-now-alt-v39670" data-now-alt-index="'+index+'"><strong>'+item.name+'</strong><span>'+item.meta+'</span><em>›</em></button>';
    }).join('');
    container.innerHTML =
      '<div class="rd-now-assist-v39670 rd-now-assist-clean-v39671">' +
        '<div class="rd-now-best-v39670">' +
          '<span class="rd-now-best-icon-v39670">'+data.icon+'</span>' +
          '<span class="rd-now-best-copy-v39670"><strong>'+active.name+'</strong><small>'+(active.sub || data.sub)+'</small></span>' +
          '<span class="rd-now-best-time-v39670">'+active.meta+'</span>' +
          '<button type="button" class="rd-now-nav-v39670">'+data.action+'</button>' +
        '</div>' +
        '<div class="rd-now-alts-v39670" aria-label="Alternatieven">'+alternatives+'</div>' +
      '</div>';
    updateNowGpsStatusV39656();
  }

  function renderStops(){
    const container = findStopsContainer();
    if(!container) return;
    document.body.removeAttribute('data-stop-subpanel');
    document.body.removeAttribute('data-food-filter');
    document.body.removeAttribute('data-discover-filter');
    closeHotelPreview();
    container.innerHTML = STOP_CARDS.map(card =>
      '<button type="button" class="rd-render-stop-card-v39619" data-category="'+card.category+'">' +
      '<span class="rd-render-stop-icon-v39619">'+card.icon+'</span>' +
      '<strong>'+card.title+'</strong><em>›</em></button>'
    ).join("");
  }

  function renderHotelStrip(){
    const container = findStopsContainer();
    if(!container) return;
    document.body.setAttribute('data-stop-subpanel','hotels');
    document.body.removeAttribute('data-hotel-preview');
    document.body.removeAttribute('data-food-preview');
    document.body.removeAttribute('data-discover-preview');
    container.innerHTML =
      '<div class="rd-hotels-strip-shell-v39636 rd-hotels-fullcards-v39637 rd-hotels-swipeback-v39638">' +
        '<div class="rd-hotels-scroll-v39636" aria-label="Hotels langs je route">' +
          HOTEL_STRIP_CARDS_V39636.map((hotel, index)=>
            '<button type="button" class="rd-hotel-card-v39636" data-hotel-index="'+index+'">' +
              '<span class="rd-hotel-rank-v39636">'+(index+1)+'</span>' +
              '<span class="rd-hotel-photo-v39636" style="background-image:url('+hotel.img+')"></span>' +
              '<span class="rd-hotel-name-v39636">'+hotel.name+'</span>' +
              '<span class="rd-hotel-rating-v39636">★ '+hotel.rating+' · '+hotel.price+'</span>' +
              '<span class="rd-hotel-meta-v39636">'+hotel.meta+'</span>' +
            '</button>'
          ).join('') +
        '</div>' +
      '</div>';
    closeHotelPreview();
  }


  function renderFuelStrip(){
    const container = findStopsContainer();
    if(!container) return;
    document.body.setAttribute('data-stop-subpanel','fuel');
    document.body.removeAttribute('data-hotel-preview');
    document.body.removeAttribute('data-fuel-preview');
    container.innerHTML =
      '<div class="rd-hotels-strip-shell-v39636 rd-hotels-fullcards-v39637 rd-hotels-swipeback-v39638 rd-fuel-strip-shell-v39646">' +
        '<div class="rd-hotels-scroll-v39636 rd-fuel-scroll-v39646" aria-label="Tankstations langs je route">' +
          FUEL_STRIP_CARDS_V39646.map((fuel, index)=>
            '<button type="button" class="rd-hotel-card-v39636 rd-fuel-card-v39646" data-fuel-index="'+index+'">' +
              '<span class="rd-hotel-rank-v39636 rd-fuel-rank-v39646">'+(index+1)+'</span>' +
              '<span class="rd-hotel-photo-v39636 rd-fuel-photo-v39646" style="background-image:url('+fuel.img+')"></span>' +
              '<span class="rd-hotel-name-v39636 rd-fuel-name-v39646">'+fuel.name+'</span>' +
              '<span class="rd-hotel-rating-v39636 rd-fuel-rating-v39646">⛽ '+fuel.price+' · '+fuel.rating+'</span>' +
              '<span class="rd-hotel-meta-v39636 rd-fuel-meta-v39646">'+fuel.meta+'</span>' +
            '</button>'
          ).join('') +
        '</div>' +
      '</div>';
    closeHotelPreview();
  }

  function renderChargeStrip(){
    const container = findStopsContainer();
    if(!container) return;
    document.body.setAttribute('data-stop-subpanel','charge');
    document.body.removeAttribute('data-hotel-preview');
    document.body.removeAttribute('data-fuel-preview');
    document.body.removeAttribute('data-charge-preview');
    document.body.removeAttribute('data-food-preview');
    document.body.removeAttribute('data-discover-preview');
    container.innerHTML =
      '<div class="rd-hotels-strip-shell-v39636 rd-hotels-fullcards-v39637 rd-hotels-swipeback-v39638 rd-charge-strip-shell-v39647">' +
        '<div class="rd-hotels-scroll-v39636 rd-charge-scroll-v39647" aria-label="Laadpalen langs je route">' +
          CHARGE_STRIP_CARDS_V39647.map((charge, index)=>
            '<button type="button" class="rd-hotel-card-v39636 rd-charge-card-v39647" data-charge-index="'+index+'">' +
              '<span class="rd-hotel-rank-v39636 rd-charge-rank-v39647">'+(index+1)+'</span>' +
              '<span class="rd-hotel-photo-v39636 rd-charge-photo-v39647" style="background-image:url('+charge.img+')"></span>' +
              '<span class="rd-hotel-name-v39636 rd-charge-name-v39647">'+charge.name+'</span>' +
              '<span class="rd-hotel-rating-v39636 rd-charge-rating-v39647">⚡ '+charge.power+' · '+charge.rating+'</span>' +
              '<span class="rd-hotel-meta-v39636 rd-charge-meta-v39647">'+charge.meta+'</span>' +
            '</button>'
          ).join('') +
        '</div>' +
      '</div>';
    closeHotelPreview();
  }

  function renderFoodFilters(){
    const container = findStopsContainer();
    if(!container) return;
    document.body.setAttribute('data-stop-subpanel','food-filter');
    document.body.removeAttribute('data-food-filter');
    document.body.removeAttribute('data-hotel-preview');
    document.body.removeAttribute('data-fuel-preview');
    document.body.removeAttribute('data-charge-preview');
    document.body.removeAttribute('data-food-preview');
    document.body.removeAttribute('data-discover-preview');
    document.body.removeAttribute('data-wc-preview');
    closeHotelPreview();
    container.innerHTML = FOOD_FILTERS_V39678.map(function(card){
      return '<button type="button" class="rd-render-stop-card-v39619" data-food-filter="'+card.key+'">' +
        '<span class="rd-render-stop-icon-v39619">'+card.icon+'</span>' +
        '<strong>'+card.title+'</strong><em>›</em>' +
      '</button>';
    }).join('');
  }

  function renderFoodStrip(filterKey){
    const container = findStopsContainer();
    if(!container) return;
    const activeFilter = filterKey || document.body.getAttribute('data-food-filter') || 'restaurant';
    const foodCards = getFoodCardsV39678(activeFilter);
    document.body.setAttribute('data-stop-subpanel','food');
    document.body.setAttribute('data-food-filter', activeFilter);
    document.body.removeAttribute('data-hotel-preview');
    document.body.removeAttribute('data-fuel-preview');
    document.body.removeAttribute('data-charge-preview');
    document.body.removeAttribute('data-food-preview');
    document.body.removeAttribute('data-discover-preview');
    container.innerHTML =
      '<div class="rd-hotels-strip-shell-v39636 rd-hotels-fullcards-v39637 rd-hotels-swipeback-v39638 rd-food-strip-shell-v39648">' +
        '<div class="rd-hotels-scroll-v39636 rd-food-scroll-v39648" aria-label="Eten langs je route">' +
          foodCards.map((food, index)=>
            '<button type="button" class="rd-hotel-card-v39636 rd-food-card-v39648" data-food-index="'+index+'">' +
              '<span class="rd-hotel-rank-v39636 rd-food-rank-v39648">'+(index+1)+'</span>' +
              '<span class="rd-hotel-photo-v39636 rd-food-photo-v39648" style="background-image:url('+food.img+')"></span>' +
              '<span class="rd-hotel-name-v39636 rd-food-name-v39648">'+food.name+'</span>' +
              '<span class="rd-hotel-rating-v39636 rd-food-rating-v39648">🍴 '+food.type+' · ★ '+food.rating+'</span>' +
              '<span class="rd-hotel-meta-v39636 rd-food-meta-v39648">'+food.meta+'</span>' +
            '</button>'
          ).join('') +
        '</div>' +
      '</div>';
    closeHotelPreview();
  }

  function renderDiscoverFilters(){
    const container = findStopsContainer();
    if(!container) return;
    document.body.setAttribute('data-stop-subpanel','discover-filter');
    document.body.removeAttribute('data-discover-filter');
    document.body.removeAttribute('data-hotel-preview');
    document.body.removeAttribute('data-fuel-preview');
    document.body.removeAttribute('data-charge-preview');
    document.body.removeAttribute('data-food-preview');
    document.body.removeAttribute('data-discover-preview');
    document.body.removeAttribute('data-wc-preview');
    closeHotelPreview();
    container.innerHTML = DISCOVER_FILTERS_V39681.map(function(card){
      return '<button type="button" class="rd-render-stop-card-v39619" data-discover-filter="'+card.key+'">' +
        '<span class="rd-render-stop-icon-v39619">'+card.icon+'</span>' +
        '<strong>'+card.title+'</strong><em>›</em>' +
      '</button>';
    }).join('');
  }

  function renderDiscoverStrip(filterKey){
    const container = findStopsContainer();
    if(!container) return;
    const activeFilter = filterKey || document.body.getAttribute('data-discover-filter') || 'viewpoint';
    const discoverCards = getDiscoverCardsV39681(activeFilter);
    document.body.setAttribute('data-stop-subpanel','discover');
    document.body.setAttribute('data-discover-filter', activeFilter);
    document.body.removeAttribute('data-hotel-preview');
    document.body.removeAttribute('data-fuel-preview');
    document.body.removeAttribute('data-charge-preview');
    document.body.removeAttribute('data-food-preview');
    document.body.removeAttribute('data-discover-preview');
    document.body.removeAttribute('data-wc-preview');
    container.innerHTML =
      '<div class="rd-hotels-strip-shell-v39636 rd-hotels-fullcards-v39637 rd-hotels-swipeback-v39638 rd-discover-strip-shell-v39649">' +
        '<div class="rd-hotels-scroll-v39636 rd-discover-scroll-v39649" aria-label="Uitjes langs je route">' +
          discoverCards.map((discover, index)=>
            '<button type="button" class="rd-hotel-card-v39636 rd-discover-card-v39649" data-discover-index="'+index+'">' +
              '<span class="rd-hotel-rank-v39636 rd-discover-rank-v39649">'+(index+1)+'</span>' +
              '<span class="rd-hotel-photo-v39636 rd-discover-photo-v39649" style="background-image:url('+discover.img+')"></span>' +
              '<span class="rd-hotel-name-v39636 rd-discover-name-v39649">'+discover.name+'</span>' +
              '<span class="rd-hotel-rating-v39636 rd-discover-rating-v39649">◎ '+discover.type+' · ★ '+discover.rating+'</span>' +
              '<span class="rd-hotel-meta-v39636 rd-discover-meta-v39649">'+discover.meta+'</span>' +
            '</button>'
          ).join('') +
        '</div>' +
      '</div>';
    closeHotelPreview();
  }


  function renderWcStrip(){
    const container = findStopsContainer();
    if(!container) return;
    document.body.setAttribute('data-stop-subpanel','wc');
    document.body.removeAttribute('data-hotel-preview');
    document.body.removeAttribute('data-fuel-preview');
    document.body.removeAttribute('data-charge-preview');
    document.body.removeAttribute('data-food-preview');
    document.body.removeAttribute('data-discover-preview');
    document.body.removeAttribute('data-wc-preview');
    container.innerHTML =
      '<div class="rd-hotels-strip-shell-v39636 rd-hotels-fullcards-v39637 rd-hotels-swipeback-v39638 rd-wc-strip-shell-v39653">' +
        '<div class="rd-hotels-scroll-v39636 rd-wc-scroll-v39653" aria-label="WC-stops langs je route">' +
          WC_STRIP_CARDS_V39653.map((wc, index)=>
            '<button type="button" class="rd-hotel-card-v39636 rd-wc-card-v39653" data-wc-index="'+index+'">' +
              '<span class="rd-hotel-rank-v39636 rd-wc-rank-v39653">'+(index+1)+'</span>' +
              '<span class="rd-hotel-photo-v39636 rd-wc-photo-v39653" style="background-image:url('+wc.img+')"></span>' +
              '<span class="rd-hotel-name-v39636 rd-wc-name-v39653">'+wc.name+'</span>' +
              '<span class="rd-hotel-rating-v39636 rd-wc-rating-v39653">WC · '+wc.rating+'</span>' +
              '<span class="rd-hotel-meta-v39636 rd-wc-meta-v39653">'+wc.meta+'</span>' +
            '</button>'
          ).join('') +
        '</div>' +
      '</div>';
    closeHotelPreview();
  }

  function renderWcPreview(index){
    const drawer = document.querySelector('#mapDrawer');
    if(!drawer) return;
    const wc = WC_STRIP_CARDS_V39653[index] || WC_STRIP_CARDS_V39653[0];
    closeHotelPreview();
    document.body.setAttribute('data-wc-preview','open');
    document.body.setAttribute('data-hotel-preview','open');
    const pop = document.createElement('div');
    pop.className = 'rd-hotel-preview-popover-v39644 rd-wc-preview-popover-v39653';
    pop.setAttribute('role','dialog');
    pop.setAttribute('aria-label','WC preview');
    pop.innerHTML =
      '<button type="button" class="rd-hotel-preview-close-v39644" aria-label="Sluiten">×</button>' +
      '<div class="rd-hotel-preview-photo-v39644 rd-wc-preview-photo-v39653" style="background-image:url('+wc.img+')">' +
        '<span class="rd-hotel-preview-count-v39644">'+(index+1)+' / '+WC_STRIP_CARDS_V39653.length+'</span>' +
      '</div>' +
      '<div class="rd-hotel-preview-body-v39644 rd-wc-preview-body-v39653">' +
        '<div class="rd-hotel-preview-kicker-v39644">'+wc.meta.replace(' vanaf start','')+' vanaf start</div>' +
        '<strong class="rd-hotel-preview-title-v39644">'+wc.name+'</strong>' +
        '<div class="rd-hotel-preview-meta-v39644">WC · '+wc.rating+'</div>' +
        '<div class="rd-hotel-preview-chips-v39644">' +
          wc.chips.map(chip => '<span>'+chip+'</span>').join('') +
        '</div>' +
        '<p class="rd-hotel-preview-copy-v39644">Praktische korte stop langs je route voor een snelle en rustige pauze onderweg.</p>' +
        '<div class="rd-hotel-preview-actions-v39644">' +
          '<button type="button" class="rd-hotel-preview-nav-v39644">Navigeer</button>' +
          '<button type="button" class="rd-hotel-preview-save-v39644">Opslaan</button>' +
        '</div>' +
      '</div>';
    drawer.appendChild(pop);
  }

  function renderDiscoverPreview(index){
    const drawer = document.querySelector('#mapDrawer');
    if(!drawer) return;
    const discoverCards = getDiscoverCardsV39681();
    const discover = discoverCards[index] || discoverCards[0];
    closeHotelPreview();
    document.body.setAttribute('data-discover-preview','open');
    document.body.setAttribute('data-hotel-preview','open');
    const pop = document.createElement('div');
    pop.className = 'rd-hotel-preview-popover-v39644 rd-discover-preview-popover-v39649';
    pop.setAttribute('role','dialog');
    pop.setAttribute('aria-label','Uitje preview');
    pop.innerHTML =
      '<button type="button" class="rd-hotel-preview-close-v39644" aria-label="Sluiten">×</button>' +
      '<div class="rd-hotel-preview-photo-v39644 rd-discover-preview-photo-v39649" style="background-image:url('+discover.img+')">' +
        '<span class="rd-hotel-preview-count-v39644">'+(index+1)+' / '+discoverCards.length+'</span>' +
      '</div>' +
      '<div class="rd-hotel-preview-body-v39644 rd-discover-preview-body-v39649">' +
        '<div class="rd-hotel-preview-kicker-v39644">'+discover.meta.replace(' vanaf start','')+' vanaf start</div>' +
        '<strong class="rd-hotel-preview-title-v39644">'+discover.name+'</strong>' +
        '<div class="rd-hotel-preview-meta-v39644">◎ '+discover.type+' · ★ '+discover.rating+'</div>' +
        '<div class="rd-hotel-preview-chips-v39644">' +
          discover.chips.map(chip => '<span>'+chip+'</span>').join('') +
        '</div>' +
        '<p class="rd-hotel-preview-copy-v39644">Mooie korte stop langs je route voor uitzicht, ontspanning of een kleine ontdekking onderweg.</p>' +
        '<div class="rd-hotel-preview-actions-v39644">' +
          '<button type="button" class="rd-hotel-preview-nav-v39644">Navigeer</button>' +
          '<button type="button" class="rd-hotel-preview-save-v39644">Opslaan</button>' +
        '</div>' +
      '</div>';
    drawer.appendChild(pop);
  }

  function renderChargePreview(index){
    const drawer = document.querySelector('#mapDrawer');
    if(!drawer) return;
    const charge = CHARGE_STRIP_CARDS_V39647[index] || CHARGE_STRIP_CARDS_V39647[0];
    closeHotelPreview();
    document.body.setAttribute('data-charge-preview','open');
    document.body.setAttribute('data-hotel-preview','open');
    const pop = document.createElement('div');
    pop.className = 'rd-hotel-preview-popover-v39644 rd-charge-preview-popover-v39647';
    pop.setAttribute('role','dialog');
    pop.setAttribute('aria-label','Laadpaal preview');
    pop.innerHTML =
      '<button type="button" class="rd-hotel-preview-close-v39644" aria-label="Sluiten">×</button>' +
      '<div class="rd-hotel-preview-photo-v39644 rd-charge-preview-photo-v39647" style="background-image:url('+charge.img+')">' +
        '<span class="rd-hotel-preview-count-v39644">'+(index+1)+' / '+CHARGE_STRIP_CARDS_V39647.length+'</span>' +
      '</div>' +
      '<div class="rd-hotel-preview-body-v39644 rd-charge-preview-body-v39647">' +
        '<div class="rd-hotel-preview-kicker-v39644">'+charge.meta.replace(' vanaf start','')+' vanaf start</div>' +
        '<strong class="rd-hotel-preview-title-v39644">'+charge.name+'</strong>' +
        '<div class="rd-hotel-preview-meta-v39644">⚡ '+charge.power+' · '+charge.rating+'</div>' +
        '<div class="rd-hotel-preview-chips-v39644">' +
          charge.chips.map(chip => '<span>'+chip+'</span>').join('') +
        '</div>' +
        '<p class="rd-hotel-preview-copy-v39644">Snelle laadstop langs je route met actuele laadcapaciteit en handige voorzieningen.</p>' +
        '<div class="rd-hotel-preview-actions-v39644">' +
          '<button type="button" class="rd-hotel-preview-nav-v39644">Navigeer</button>' +
          '<button type="button" class="rd-hotel-preview-save-v39644">Opslaan</button>' +
        '</div>' +
      '</div>';
    drawer.appendChild(pop);
  }

  function renderFoodPreview(index){
    const drawer = document.querySelector('#mapDrawer');
    if(!drawer) return;
    const foodCards = getFoodCardsV39678();
    const food = foodCards[index] || foodCards[0];
    closeHotelPreview();
    document.body.setAttribute('data-food-preview','open');
    document.body.setAttribute('data-hotel-preview','open');
    const pop = document.createElement('div');
    pop.className = 'rd-hotel-preview-popover-v39644 rd-food-preview-popover-v39648';
    pop.setAttribute('role','dialog');
    pop.setAttribute('aria-label','Eten preview');
    pop.innerHTML =
      '<button type="button" class="rd-hotel-preview-close-v39644" aria-label="Sluiten">×</button>' +
      '<div class="rd-hotel-preview-photo-v39644 rd-food-preview-photo-v39648" style="background-image:url('+food.img+')">' +
        '<span class="rd-hotel-preview-count-v39644">'+(index+1)+' / '+foodCards.length+'</span>' +
      '</div>' +
      '<div class="rd-hotel-preview-body-v39644 rd-food-preview-body-v39648">' +
        '<div class="rd-hotel-preview-kicker-v39644">'+food.meta.replace(' vanaf start','')+' vanaf start</div>' +
        '<strong class="rd-hotel-preview-title-v39644">'+food.name+'</strong>' +
        '<div class="rd-hotel-preview-meta-v39644">🍴 '+food.type+' · ★ '+food.rating+'</div>' +
        '<div class="rd-hotel-preview-chips-v39644">' +
          food.chips.map(chip => '<span>'+chip+'</span>').join('') +
        '</div>' +
        '<p class="rd-hotel-preview-copy-v39644">Fijne eetstop langs je route voor een snelle pauze of rustige maaltijd onderweg.</p>' +
        '<div class="rd-hotel-preview-actions-v39644">' +
          '<button type="button" class="rd-hotel-preview-nav-v39644">Navigeer</button>' +
          '<button type="button" class="rd-hotel-preview-save-v39644">Opslaan</button>' +
        '</div>' +
      '</div>';
    drawer.appendChild(pop);
  }

  function renderFuelPreview(index){
    const drawer = document.querySelector('#mapDrawer');
    if(!drawer) return;
    const fuel = FUEL_STRIP_CARDS_V39646[index] || FUEL_STRIP_CARDS_V39646[0];
    closeHotelPreview();
    document.body.setAttribute('data-fuel-preview','open');
    document.body.setAttribute('data-hotel-preview','open');
    const pop = document.createElement('div');
    pop.className = 'rd-hotel-preview-popover-v39644 rd-fuel-preview-popover-v39646';
    pop.setAttribute('role','dialog');
    pop.setAttribute('aria-label','Tankstation preview');
    pop.innerHTML =
      '<button type="button" class="rd-hotel-preview-close-v39644" aria-label="Sluiten">×</button>' +
      '<div class="rd-hotel-preview-photo-v39644 rd-fuel-preview-photo-v39646" style="background-image:url('+fuel.img+')">' +
        '<span class="rd-hotel-preview-count-v39644">'+(index+1)+' / '+FUEL_STRIP_CARDS_V39646.length+'</span>' +
      '</div>' +
      '<div class="rd-hotel-preview-body-v39644 rd-fuel-preview-body-v39646">' +
        '<div class="rd-hotel-preview-kicker-v39644">'+fuel.meta.replace(' vanaf start','')+' vanaf start</div>' +
        '<strong class="rd-hotel-preview-title-v39644">'+fuel.name+'</strong>' +
        '<div class="rd-hotel-preview-meta-v39644">⛽ '+fuel.price+' · '+fuel.rating+'</div>' +
        '<div class="rd-hotel-preview-chips-v39644">' +
          fuel.chips.map(chip => '<span>'+chip+'</span>').join('') +
        '</div>' +
        '<p class="rd-hotel-preview-copy-v39644">Handige tankstop langs je route met snelle voorzieningen voor onderweg.</p>' +
        '<div class="rd-hotel-preview-actions-v39644">' +
          '<button type="button" class="rd-hotel-preview-nav-v39644">Navigeer</button>' +
          '<button type="button" class="rd-hotel-preview-save-v39644">Opslaan</button>' +
        '</div>' +
      '</div>';
    drawer.appendChild(pop);
  }

  function closeHotelPreview(){
    document.body.removeAttribute('data-hotel-preview');
    document.body.removeAttribute('data-fuel-preview');
    document.body.removeAttribute('data-charge-preview');
    document.body.removeAttribute('data-food-preview');
    document.body.removeAttribute('data-discover-preview');
    document.body.removeAttribute('data-wc-preview');
    const old = document.querySelector('#mapDrawer .rd-hotel-preview-popover-v39644');
    if(old) old.remove();
  }

  function renderHotelPreview(index){
    const drawer = document.querySelector('#mapDrawer');
    if(!drawer) return;
    const hotel = HOTEL_STRIP_CARDS_V39636[index] || HOTEL_STRIP_CARDS_V39636[0];
    closeHotelPreview();
    document.body.setAttribute('data-hotel-preview','open');
    const pop = document.createElement('div');
    pop.className = 'rd-hotel-preview-popover-v39644';
    pop.setAttribute('role','dialog');
    pop.setAttribute('aria-label','Hotel preview');
    pop.innerHTML =
      '<button type="button" class="rd-hotel-preview-close-v39644" aria-label="Sluiten">×</button>' +
      '<div class="rd-hotel-preview-photo-v39644" style="background-image:url('+hotel.img+')">' +
        '<span class="rd-hotel-preview-count-v39644">'+(index+1)+' / '+HOTEL_STRIP_CARDS_V39636.length+'</span>' +
      '</div>' +
      '<div class="rd-hotel-preview-body-v39644">' +
        '<div class="rd-hotel-preview-kicker-v39644">'+hotel.meta.replace(' vanaf start','')+' vanaf start</div>' +
        '<strong class="rd-hotel-preview-title-v39644">'+hotel.name+'</strong>' +
        '<div class="rd-hotel-preview-meta-v39644">★ '+hotel.rating+' · '+hotel.price+'</div>' +
        '<div class="rd-hotel-preview-chips-v39644">' +
          '<span>Parkeren</span><span>Ontbijt</span><span>Wifi</span>' +
        '</div>' +
        '<p class="rd-hotel-preview-copy-v39644">Comfortabele overnachtingsstop langs je route, handig gelegen voor een rustige pauze.</p>' +
        '<div class="rd-hotel-preview-actions-v39644">' +
          '<button type="button" class="rd-hotel-preview-nav-v39644">Navigeer</button>' +
          '<button type="button" class="rd-hotel-preview-save-v39644">Opslaan</button>' +
        '</div>' +
      '</div>';
    drawer.appendChild(pop);
  }

  function openPanel(panel){
    document.body.setAttribute("data-map-drawer", "open");
    document.body.setAttribute("data-sheet-state", "half");
    document.body.setAttribute("data-instant-map-panel", panel);
    document.body.classList.add("rd-instant-panel-open-v3968");
    setNavActive(panel);
    if(panel === "stops"){
      document.body.removeAttribute('data-now-needed');
      document.body.removeAttribute('data-now-assist');
      renderStops();
      setTimeout(renderStops, 50);
    } else if(panel === "now"){
      renderNowNeeded();
      setTimeout(renderNowNeeded, 50);
    } else {
      document.body.removeAttribute('data-now-needed');
      document.body.removeAttribute('data-now-assist');
      document.body.removeAttribute('data-stop-subpanel');
      closeHotelPreview();
    }
  }

  function closePanel(){
    document.body.removeAttribute("data-map-drawer");
    document.body.removeAttribute("data-instant-map-panel");
    document.body.removeAttribute('data-now-needed');
    document.body.removeAttribute('data-now-assist');
    document.body.removeAttribute('data-now-help-sub');
    document.body.removeAttribute('data-now-gps');
    document.body.removeAttribute('data-food-filter');
    document.body.classList.remove("rd-instant-panel-open-v3968");
    setNavActive("");
  }

  window.addEventListener("click", function(e){
    const btn = getBtn(e.target);
    if(!btn) return;
    const panel = getPanel(btn);
    if(panel !== "stops" && panel !== "now" && panel !== "more") return;
    e.preventDefault();
    e.stopPropagation();
    if(e.stopImmediatePropagation) e.stopImmediatePropagation();

    const current = document.body.getAttribute("data-instant-map-panel");
    const isOpen = document.body.getAttribute("data-map-drawer") === "open";
    if(isOpen && current === panel) closePanel();
    else openPanel(panel);
  }, true);

  document.addEventListener("click", function(e){
    const card = e.target.closest(".rd-render-stop-card-v39619");
    if(!card) return;
    const foodFilter = card.getAttribute("data-food-filter");
    if(foodFilter){
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll("[data-food-filter]").forEach(function(item){
        item.classList.toggle("is-active", item === card);
      });
      renderFoodStrip(foodFilter);
      if(window.RoadoraApp && typeof window.RoadoraApp.renderCategoryPins === 'function'){
        window.RoadoraApp.renderCategoryPins('food');
      }
      return;
    }
    const discoverFilter = card.getAttribute("data-discover-filter");
    if(discoverFilter){
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll("[data-discover-filter]").forEach(function(item){
        item.classList.toggle("is-active", item === card);
      });
      renderDiscoverStrip(discoverFilter);
      if(window.RoadoraApp && typeof window.RoadoraApp.renderCategoryPins === 'function'){
        window.RoadoraApp.renderCategoryPins('discover');
      }
      return;
    }
    const category = card.getAttribute("data-category");
    if(!category) return;
    document.body.setAttribute("data-active-stop-category", category);
    document.querySelectorAll(".rd-render-stop-card-v39619").forEach(function(item){
      item.classList.toggle("is-active", item === card);
    });
    window.dispatchEvent(new CustomEvent("roadora:stop-category-change", { detail:{ category:category } }));
    if(category === 'hotels'){
      renderHotelStrip();
    }else if(category === 'fuel'){
      renderFuelStrip();
    }else if(category === 'charge'){
      renderChargeStrip();
    }else if(category === 'food'){
      renderFoodFilters();
    }else if(category === 'discover'){
      renderDiscoverFilters();
    }else if(category === 'wc'){
      renderWcStrip();
    }else{
      document.body.removeAttribute('data-stop-subpanel');
      closeHotelPreview();
    }
  }, true);

  document.addEventListener("click", function(e){
    const nowHelpType = e.target.closest && e.target.closest('[data-now-help-type]');
    if(nowHelpType){
      e.preventDefault();
      e.stopPropagation();
      const category = nowHelpType.getAttribute('data-now-help-type') || 'help_garage';
      renderNowAssist(category, 0);
      return;
    }

    const nowAlt = e.target.closest && e.target.closest('[data-now-alt-index]');
    if(nowAlt){
      e.preventDefault();
      e.stopPropagation();
      const category = document.body.getAttribute('data-now-assist') || 'wc';
      const index = parseInt(nowAlt.getAttribute('data-now-alt-index') || '0', 10);
      renderNowAssist(category, isNaN(index) ? 0 : index);
      return;
    }

    const nowCard = e.target.closest && e.target.closest('[data-now-category]');
    if(!nowCard) return;
    e.preventDefault();
    e.stopPropagation();
    document.querySelectorAll('[data-now-category]').forEach(function(item){
      item.classList.toggle('is-active', item === nowCard);
    });
    const category = nowCard.getAttribute('data-now-category') || '';
    if(category === 'help'){
      renderNowHelpFilters();
      return;
    }
    if(window.RoadoraApp && typeof window.RoadoraApp.renderCategoryPins === 'function' && category !== 'sleep'){
      window.RoadoraApp.renderCategoryPins(category);
    }
    renderNowAssist(category, 0);
  }, true);

  document.addEventListener("click", function(e){
    const close = e.target.closest && e.target.closest(".rd-hotel-preview-close-v39644");
    if(close){
      e.preventDefault();
      e.stopPropagation();
      closeHotelPreview();
      return;
    }

    const fuel = e.target.closest && e.target.closest(".rd-fuel-card-v39646");
    if(fuel){
      e.preventDefault();
      e.stopPropagation();
      const fuelIndex = parseInt(fuel.getAttribute('data-fuel-index') || '0', 10) || 0;
      document.querySelectorAll(".rd-fuel-card-v39646").forEach(function(item){
        item.classList.toggle("is-active", item === fuel);
      });
      renderFuelPreview(fuelIndex);
      if(window.RoadoraApp && typeof window.RoadoraApp.renderCategoryPins === 'function'){
        window.RoadoraApp.renderCategoryPins('fuel', fuelIndex);
      }
      focusSelectedCategoryStopOnMap('fuel', fuelIndex);
      return;
    }

    const charge = e.target.closest && e.target.closest(".rd-charge-card-v39647");
    if(charge){
      e.preventDefault();
      e.stopPropagation();
      const chargeIndex = parseInt(charge.getAttribute('data-charge-index') || '0', 10) || 0;
      document.querySelectorAll(".rd-charge-card-v39647").forEach(function(item){
        item.classList.toggle("is-active", item === charge);
      });
      renderChargePreview(chargeIndex);
      if(window.RoadoraApp && typeof window.RoadoraApp.renderCategoryPins === 'function'){
        window.RoadoraApp.renderCategoryPins('charge', chargeIndex);
      }
      focusSelectedCategoryStopOnMap('charge', chargeIndex);
      return;
    }

    const food = e.target.closest && e.target.closest(".rd-food-card-v39648");
    if(food){
      e.preventDefault();
      e.stopPropagation();
      const foodIndex = parseInt(food.getAttribute('data-food-index') || '0', 10) || 0;
      document.querySelectorAll(".rd-food-card-v39648").forEach(function(item){
        item.classList.toggle("is-active", item === food);
      });
      renderFoodPreview(foodIndex);
      if(window.RoadoraApp && typeof window.RoadoraApp.renderCategoryPins === 'function'){
        window.RoadoraApp.renderCategoryPins('food', foodIndex);
      }
      focusSelectedCategoryStopOnMap('food', foodIndex);
      return;
    }

    const discover = e.target.closest && e.target.closest(".rd-discover-card-v39649");
    if(discover){
      e.preventDefault();
      e.stopPropagation();
      const discoverIndex = parseInt(discover.getAttribute('data-discover-index') || '0', 10) || 0;
      document.querySelectorAll(".rd-discover-card-v39649").forEach(function(item){
        item.classList.toggle("is-active", item === discover);
      });
      renderDiscoverPreview(discoverIndex);
      if(window.RoadoraApp && typeof window.RoadoraApp.renderCategoryPins === 'function'){
        window.RoadoraApp.renderCategoryPins('discover', discoverIndex);
      }
      focusSelectedCategoryStopOnMap('discover', discoverIndex);
      return;
    }

    const wc = e.target.closest && e.target.closest(".rd-wc-card-v39653");
    if(wc){
      e.preventDefault();
      e.stopPropagation();
      const wcIndex = parseInt(wc.getAttribute('data-wc-index') || '0', 10) || 0;
      document.querySelectorAll(".rd-wc-card-v39653").forEach(function(item){
        item.classList.toggle("is-active", item === wc);
      });
      renderWcPreview(wcIndex);
      if(window.RoadoraApp && typeof window.RoadoraApp.renderCategoryPins === 'function'){
        window.RoadoraApp.renderCategoryPins('wc', wcIndex);
      }
      focusSelectedCategoryStopOnMap('wc', wcIndex);
      return;
    }

    const hotel = e.target.closest && e.target.closest(".rd-hotel-card-v39636:not(.rd-fuel-card-v39646):not(.rd-charge-card-v39647):not(.rd-food-card-v39648):not(.rd-discover-card-v39649):not(.rd-wc-card-v39653)");
    if(!hotel) return;
    e.preventDefault();
    e.stopPropagation();
    const index = parseInt(hotel.getAttribute('data-hotel-index') || '0', 10) || 0;
    document.querySelectorAll(".rd-hotel-card-v39636").forEach(function(item){
      item.classList.toggle("is-active", item === hotel);
    });
    renderHotelPreview(index);
    if(window.RoadoraApp && typeof window.RoadoraApp.renderCategoryPins === 'function'){
      window.RoadoraApp.renderCategoryPins('hotels', index);
    }
    window.setTimeout(function(){ focusSelectedHotelOnMap(index); }, 120);
  }, true);


  /* v39.6.55 — robust Android swipe-down on the visible sheet handle.
     Extends the existing card-state swipe-back: card states swipe down to categories,
     and the categories state now swipes down to close the Stops sheet. Horizontal
     card scrolling remains untouched. */
  (function bindStopsHandleSwipeV39655(){
    if(window.__roadoraStopsHandleSwipeV39655) return;
    window.__roadoraStopsHandleSwipeV39655 = true;

    let startX = 0;
    let startY = 0;
    let tracking = false;
    const SWIPE_DOWN = 30;
    const MAX_SIDE_DRIFT = 58;

    function isCardState(){
      const subpanel = document.body.getAttribute('data-stop-subpanel');
      return subpanel === 'hotels' || subpanel === 'fuel' || subpanel === 'charge' || subpanel === 'food-filter' || subpanel === 'food' || subpanel === 'discover-filter' || subpanel === 'discover' || subpanel === 'wc';
    }

    function isStopsCategoryState(){
      const isOpen = document.body.getAttribute('data-map-drawer') === 'open';
      const panel = document.body.getAttribute('data-instant-map-panel');
      const subpanel = document.body.getAttribute('data-stop-subpanel');
      return isOpen && panel === 'stops' && !subpanel;
    }

    function isNowAssistState(){
      const isOpen = document.body.getAttribute('data-map-drawer') === 'open';
      const panel = document.body.getAttribute('data-instant-map-panel');
      return isOpen && panel === 'now' && !!document.body.getAttribute('data-now-assist');
    }

    function isNowHelpSubState(){
      const isOpen = document.body.getAttribute('data-map-drawer') === 'open';
      const panel = document.body.getAttribute('data-instant-map-panel');
      return isOpen && panel === 'now' && document.body.getAttribute('data-now-help-sub') === 'open';
    }

    function isNowNeededState(){
      const isOpen = document.body.getAttribute('data-map-drawer') === 'open';
      const panel = document.body.getAttribute('data-instant-map-panel');
      return isOpen && panel === 'now' && document.body.getAttribute('data-now-needed') === 'open' && !document.body.getAttribute('data-now-assist') && !document.body.getAttribute('data-now-help-sub');
    }

    function canSwipeHandleDown(){
      return isCardState() || isStopsCategoryState() || isNowAssistState() || isNowHelpSubState() || isNowNeededState();
    }

    function getPoint(e){
      const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
      return { x:t.clientX || 0, y:t.clientY || 0 };
    }

    function isHandleStart(target, y){
      const drawer = document.getElementById('mapDrawer');
      if(!drawer || !drawer.contains(target)) return false;
      const grab = target.closest && target.closest('.rd-sheet-grab-v28');
      if(grab) return true;

      /* Fallback: accept the top touch band of the drawer, because the visible bar can be
         composited above a very small button on Android Chrome. */
      const rect = drawer.getBoundingClientRect();
      return (y - rect.top) >= 0 && (y - rect.top) <= 42;
    }

    function start(e){
      if(!canSwipeHandleDown()) return;
      const p = getPoint(e);
      if(!isHandleStart(e.target, p.y)) return;
      tracking = true;
      startX = p.x;
      startY = p.y;
    }

    function move(e){
      if(!tracking) return;
      const p = getPoint(e);
      const dx = p.x - startX;
      const dy = p.y - startY;

      if(dy > 8 && Math.abs(dy) > Math.abs(dx)){
        if(e.cancelable) e.preventDefault();
      }

      if(dy > SWIPE_DOWN && Math.abs(dx) < MAX_SIDE_DRIFT && Math.abs(dy) > Math.abs(dx) * 1.08){
        tracking = false;
        if(isCardState()) {
          const subpanel = document.body.getAttribute('data-stop-subpanel');
          closeHotelPreview();
          if(subpanel === 'food'){
            renderFoodFilters();
          } else if(subpanel === 'discover'){
            renderDiscoverFilters();
          } else {
            renderStops();
          }
        } else if(isNowAssistState()) {
          if((document.body.getAttribute('data-now-assist') || '').indexOf('help_') === 0){
            renderNowHelpFilters();
          } else {
            renderNowNeeded();
          }
        } else if(isNowHelpSubState()) {
          renderNowNeeded();
        } else if(isStopsCategoryState() || isNowNeededState()) {
          closeHotelPreview();
          closePanel();
        }
      }
    }

    function end(){ tracking = false; }

    document.addEventListener('pointerdown', start, { passive:true });
    document.addEventListener('pointermove', move, { passive:false });
    document.addEventListener('pointerup', end, { passive:true });
    document.addEventListener('pointercancel', end, { passive:true });

    document.addEventListener('touchstart', start, { passive:true });
    document.addEventListener('touchmove', move, { passive:false });
    document.addEventListener('touchend', end, { passive:true });
    document.addEventListener('touchcancel', end, { passive:true });
  })();

  window.RoadoraRenderStopsSheet = renderStops;
  window.RoadoraRenderHotelStrip = renderHotelStrip;
  window.RoadoraRenderFuelStrip = renderFuelStrip;
  window.RoadoraRenderChargeStrip = renderChargeStrip;
  window.RoadoraRenderWcStrip = renderWcStrip;
  window.RoadoraRenderNowNeeded = renderNowNeeded;
  window.RoadoraRenderNowAssist = renderNowAssist;
  window.RoadoraRenderNowHelpFilters = renderNowHelpFilters;
  window.RoadoraCloseInstantPanel = closePanel;
})();
