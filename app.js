/* Roadora v39.3 clean sheet DOM - map/ORS/Maps untouched */
const STORAGE_KEY = 'roadora_phase1_state_v44_clean';
const DEMO_TRIP_ENABLED = false;

// v39.6.93 — stable shared app namespace for map/sheet controllers.
// Some map code runs before sheet handlers, so this object must exist upfront.
window.RoadoraApp = window.RoadoraApp || {};

const defaultState = {
  activeScreen: 'overview',
  route: {
    start: '',
    end: '',
    vehicle: 'auto',
    planned: false,
    plannedAt: null,
    summary: null
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
const routePlanPreview = document.getElementById('routePlanPreview');
const routePreviewDistance = document.getElementById('routePreviewDistance');
const routePreviewDuration = document.getElementById('routePreviewDuration');
const routePreviewHint = document.getElementById('routePreviewHint');

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

/* Roadora v39.7.43 — global route summary formatters.
   renderRoutePlan() can be called after ORS updates from inside the map engine;
   these helpers must exist outside the map closure to prevent a silent JS stop. */
function fmtKm(value){
  const n = Number(value || 0);
  return n ? `${Math.round(n/1000).toLocaleString('nl-NL')} km` : '— km';
}

function fmtTime(value){
  const sec = Number(value || 0);
  if(!sec) return '—';
  const h = Math.floor(sec / 3600);
  const min = Math.round((sec % 3600) / 60);
  return h ? `${h}u ${String(min).padStart(2,'0')}m` : `${min} min`;
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

  const ready = isRouteReady();
  const summary = RoadoraState.route.summary || null;
  const hasSummary = !!(ready && summary && (Number(summary.distance) || Number(summary.duration)));

  if(routePlanPreview){
    routePlanPreview.classList.toggle('is-ready', ready);
    routePlanPreview.classList.toggle('has-summary', hasSummary);
  }
  if(routePreviewDistance){
    routePreviewDistance.textContent = hasSummary ? fmtKm(summary.distance) : (ready ? 'Live afstand' : '— km');
  }
  if(routePreviewDuration){
    routePreviewDuration.textContent = hasSummary ? fmtTime(summary.duration) : (ready ? 'Live reistijd' : '—');
  }
  if(routePreviewHint){
    routePreviewHint.textContent = hasSummary ? 'Live ORS-preview' : (ready ? 'Plan route om afstand en tijd te berekenen' : 'Vul vertrek en bestemming in');
  }

  if(planBtn){
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
  if(name === 'roadtrip') setRoadtripView('home');

  // Roadora v39.7.40 — safe map boot after routeplan layout changes.
  // The routeplan screen now uses a fixed/sticky hero. On some mobile browsers
  // Leaflet can be initialized one frame too early while the map screen is
  // still settling, causing a beige fallback layer instead of the real map.
  // Keep Maps/ORS logic unchanged, but retry invalidate/load after the map
  // screen is visibly active.
  if(name === 'map' && window.RoadoraMap){
    // Roadora v39.7.45 — single map boot.
    // Do not call ensure/refresh multiple times here: every refresh starts with
    // a fallback line before ORS returns, which caused straight-line → ORS flicker.
    window.RoadoraMap.ensure();
    setTimeout(() => window.RoadoraMap?.fit?.(), 780);
  }

  if(options.scroll !== false){
    requestAnimationFrame(() => window.scrollTo({ top:0, behavior: options.instant ? 'auto' : 'smooth' }));
  }
}

function updateRouteField(field, value){
  RoadoraState.route[field] = value;
  RoadoraState.route.planned = false;
  RoadoraState.route.summary = null;
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
    RoadoraState.route.summary = null;
    saveState();
    renderAll();
  });
});

planBtn?.addEventListener('click', planRoute);

function setRoadtripView(view){
  const safeView = ['saved-stops','saved-hotels','saved-food','saved-discover'].includes(view) ? view : 'home';
  const hub = document.querySelector('[data-roadtrip-view]');
  if(hub) hub.dataset.roadtripView = safeView;
  document.body.dataset.roadtripView = safeView;
  document.querySelectorAll('[data-roadtrip-state]').forEach(panel => {
    const active = panel.dataset.roadtripState === safeView;
    panel.hidden = !active;
  });
}

document.addEventListener('click', (event) => {
  const roadtripEntry = event.target.closest('[data-roadtrip-entry]');
  if(roadtripEntry){
    event.preventDefault();
    const entry = roadtripEntry.dataset.roadtripEntry;
    if(entry === 'saved-stops') setRoadtripView('saved-stops');
    else if(entry === 'saved-hotels') setRoadtripView('saved-hotels');
    else if(entry === 'saved-food') setRoadtripView('saved-food');
    else if(entry === 'saved-discover') setRoadtripView('saved-discover');
    else if(entry === 'home') setRoadtripView('home');
    return;
  }

  const savedCategory = event.target.closest('[data-saved-stop-category]');
  if(savedCategory){
    event.preventDefault();
    const category = savedCategory.dataset.savedStopCategory;
    if(category === 'hotels'){
      setRoadtripView('saved-hotels');
      return;
    }
    if(category === 'food'){
      setRoadtripView('saved-food');
      return;
    }
    if(category === 'discover'){
      setRoadtripView('saved-discover');
      return;
    }
    showToast(`${savedCategory.textContent.trim().replace(/›/g,'')} komt in fase 3`);
    return;
  }

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
    praag: [14.4378,50.0755],
    prague: [14.4378,50.0755],
    praha: [14.4378,50.0755],
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
  let activeLoadKeyV39745 = '';
  let displayedRouteKeyV39745 = '';
  let pendingReloadV39745 = false;

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

  function routeKeyV39745(route){
    const r = route || activeRoute();
    return [norm(r.start), norm(r.end), r.vehicle || 'auto'].join('|');
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
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom:19 }).addTo(map);
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
      iconSize: [34,34],
      iconAnchor: [17,17],
      popupAnchor: [0,-18]
    });
  }

  function routePointAt(percent){
    if(!routeCoordinates.length) return null;
    const idx = Math.max(0, Math.min(routeCoordinates.length - 1, Math.floor(routeCoordinates.length * percent)));
    return routeCoordinates[idx];
  }

  /* v39.6.88 — one stop source of truth for pins, cards, popovers and map focus.
     Old fixed route percentages + visual offset hacks are removed. A stop now gets
     its coordinate from its own data/meta first, then from its real km position on
     the current route as a safe fallback. */
  let routeDistanceCacheV39686 = null;

  function distanceKmV39686(a, b){
    if(!a || !b) return 0;
    const lon1 = Number(a[0]), lat1 = Number(a[1]), lon2 = Number(b[0]), lat2 = Number(b[1]);
    if(!isFinite(lon1) || !isFinite(lat1) || !isFinite(lon2) || !isFinite(lat2)) return 0;
    const R = 6371;
    const dLat = (lat2-lat1) * Math.PI / 180;
    const dLon = (lon2-lon1) * Math.PI / 180;
    const rLat1 = lat1 * Math.PI / 180;
    const rLat2 = lat2 * Math.PI / 180;
    const x = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  }

  function getRouteDistanceKmV39686(){
    if(!routeCoordinates.length) return 0;
    if(routeDistanceCacheV39686 && routeDistanceCacheV39686.count === routeCoordinates.length) return routeDistanceCacheV39686.km;
    let km = 0;
    for(let i=1; i<routeCoordinates.length; i++) km += distanceKmV39686(routeCoordinates[i-1], routeCoordinates[i]);
    routeDistanceCacheV39686 = { count: routeCoordinates.length, km: km };
    return km;
  }

  function pointAlongRouteByKmV39686(targetKm){
    if(!routeCoordinates.length) return null;
    const total = getRouteDistanceKmV39686();
    const safeTarget = Math.max(0, Math.min(Number(targetKm) || 0, Math.max(total, 0)));
    if(!total || routeCoordinates.length < 2) return routeCoordinates[0];
    let travelled = 0;
    for(let i=1; i<routeCoordinates.length; i++){
      const prev = routeCoordinates[i-1];
      const next = routeCoordinates[i];
      const segment = distanceKmV39686(prev, next);
      if(travelled + segment >= safeTarget){
        const ratio = segment ? (safeTarget - travelled) / segment : 0;
        return [
          prev[0] + ((next[0] - prev[0]) * ratio),
          prev[1] + ((next[1] - prev[1]) * ratio)
        ];
      }
      travelled += segment;
    }
    return routeCoordinates[routeCoordinates.length - 1];
  }

  function parseKmFromMetaV39686(meta){
    const text = String(meta || '').replace(',', '.');
    const match = text.match(/(\d+(?:\.\d+)?)\s*km/i);
    return match ? Number(match[1]) : null;
  }

  function getRawCategoryCardsV39687(category){
    const c = category || document.body.getAttribute('data-active-stop-category') || 'hotels';

    // v39.6.88 — the map engine runs in a separate closure from the sheet data.
    // Read stops through the shared registry so pins/cards/popovers use the same source.
    const registry = window.RoadoraStopDataV39688 || window.RoadoraStopData || null;
    if(registry && typeof registry.getCards === 'function'){
      try{
        const cards = registry.getCards(c);
        if(Array.isArray(cards)) return cards;
      }catch(_){ }
    }

    // Last-resort fallback keeps demo pins visible if the registry has not booted yet.
    const fallback = {
      hotels:[
        { name:'Van der Valk Venlo', meta:'105 km vanaf start' },
        { name:'Hotel Koblenz', meta:'245 km vanaf start' },
        { name:'Hotel am Main', meta:'390 km vanaf start' },
        { name:'Landhotel Bayern', meta:'520 km vanaf start' },
        { name:'City Hotel München', meta:'680 km vanaf start' }
      ],
      fuel:[
        { name:'Shell Venlo', meta:'98 km vanaf start' },
        { name:'Aral Koblenz', meta:'238 km vanaf start' },
        { name:'TotalEnergies Main', meta:'382 km vanaf start' },
        { name:'OMV Nürnberg', meta:'515 km vanaf start' },
        { name:'Esso München', meta:'665 km vanaf start' }
      ],
      charge:[
        { name:'Fastned Venlo', meta:'110 km vanaf start' },
        { name:'Ionity Koblenz', meta:'255 km vanaf start' },
        { name:'EnBW Würzburg', meta:'430 km vanaf start' },
        { name:'Tesla Nürnberg', meta:'545 km vanaf start' },
        { name:'Aral Pulse München', meta:'690 km vanaf start' }
      ],
      food:[
        { name:'Bistro Maasduinen', meta:'115 km vanaf start' },
        { name:'Rheinblick Café', meta:'260 km vanaf start' },
        { name:'Gasthof Würzburg', meta:'420 km vanaf start' },
        { name:'Autohof Nürnberg', meta:'555 km vanaf start' },
        { name:'Alpen Café München', meta:'690 km vanaf start' }
      ],
      discover:[
        { name:'Uitzichtpunt Maasduinen', meta:'125 km vanaf start' },
        { name:'Rijnpromenade Koblenz', meta:'265 km vanaf start' },
        { name:'Altstadt Würzburg', meta:'415 km vanaf start' },
        { name:'Kasteel Nürnberg', meta:'555 km vanaf start' },
        { name:'Alpenblick Rosenheim', meta:'735 km vanaf start' }
      ],
      wc:[
        { name:'Rastplatz Maasduinen', meta:'118 km vanaf start' },
        { name:'Service Koblenz', meta:'248 km vanaf start' },
        { name:'Pauzeplaats Main', meta:'392 km vanaf start' },
        { name:'Raststätte Nürnberg', meta:'548 km vanaf start' },
        { name:'Stop München Süd', meta:'690 km vanaf start' }
      ]
    };
    return fallback[c] || fallback.hotels;
  }

  function isValidLonLatV39687(coord){
    if(!Array.isArray(coord) || coord.length < 2) return false;
    const lon = Number(coord[0]);
    const lat = Number(coord[1]);
    return isFinite(lon) && isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90;
  }

  function explicitCoordFromStopV39687(stop){
    if(!stop) return null;
    const candidates = [];
    if(Array.isArray(stop.coord)) candidates.push(stop.coord);
    if(Array.isArray(stop.coords)) candidates.push(stop.coords);
    if(Array.isArray(stop.coordinates)) candidates.push(stop.coordinates);
    if(stop.location && Array.isArray(stop.location.coordinates)) candidates.push(stop.location.coordinates);
    if(stop.geometry && Array.isArray(stop.geometry.coordinates)) candidates.push(stop.geometry.coordinates);
    if(stop.position && stop.position.lng !== undefined && stop.position.lat !== undefined) candidates.push([stop.position.lng, stop.position.lat]);
    if(stop.location && stop.location.lng !== undefined && stop.location.lat !== undefined) candidates.push([stop.location.lng, stop.location.lat]);
    if(stop.lon !== undefined && stop.lat !== undefined) candidates.push([stop.lon, stop.lat]);
    if(stop.lng !== undefined && stop.lat !== undefined) candidates.push([stop.lng, stop.lat]);

    for(const candidate of candidates){
      const coord = [Number(candidate[0]), Number(candidate[1])];
      if(isValidLonLatV39687(coord)) return coord;
    }
    return null;
  }

  function fallbackCoordForStopV39687(stop, index, total){
    const metaKm = parseKmFromMetaV39686(stop && stop.meta);
    if(metaKm !== null){
      const byKm = pointAlongRouteByKmV39686(metaKm);
      if(isValidLonLatV39687(byKm)) return { coord: byKm, km: metaKm, source: 'route-km' };
    }

    // Future-proof demo fallback: derived from the current route and the number of cards.
    // This keeps pins/cards/popovers synced until real API lat/lng is provided.
    const pct = (Math.max(0, Number(index) || 0) + 1) / ((Math.max(1, Number(total) || 1)) + 1);
    const byPercent = routePointAt(pct);
    if(isValidLonLatV39687(byPercent)){
      const routeKm = getRouteDistanceKmV39686();
      return { coord: byPercent, km: routeKm ? routeKm * pct : null, source: 'route-derived' };
    }

    return { coord: null, km: metaKm, source: 'missing' };
  }

  function normalizeRoadoraStopV39687(rawStop, category, index, total){
    const raw = rawStop || {};
    const explicit = explicitCoordFromStopV39687(raw);
    const fallback = explicit
      ? { coord: explicit, km: parseKmFromMetaV39686(raw.meta), source: 'api-coord' }
      : fallbackCoordForStopV39687(raw, index, total);

    const coord = fallback.coord;
    const km = fallback.km !== null && fallback.km !== undefined ? Number(fallback.km) : parseKmFromMetaV39686(raw.meta);

    return Object.assign({}, raw, {
      id: raw.id || raw.placeId || raw.place_id || raw.name || `${category || 'stop'}-${index}`,
      category: category || raw.category || raw.type || 'stop',
      title: raw.title || raw.name || raw.label || 'Stop',
      name: raw.name || raw.title || raw.label || 'Stop',
      lon: coord ? Number(coord[0]) : undefined,
      lng: coord ? Number(coord[0]) : undefined,
      lat: coord ? Number(coord[1]) : undefined,
      coord: coord,
      coordinates: coord,
      distanceKm: isFinite(km) ? km : undefined,
      _coordSource: fallback.source
    });
  }

  function getActiveCategoryCardsV39686(category){
    const c = category || document.body.getAttribute('data-active-stop-category') || 'hotels';
    const rawCards = getRawCategoryCardsV39687(c) || [];
    return rawCards.map(function(stop, index){
      return normalizeRoadoraStopV39687(stop, c, index, rawCards.length);
    });
  }

  function getStopCoordV39686(category, index){
    const cards = getActiveCategoryCardsV39686(category);
    const safeIndex = Math.max(0, Math.min(cards.length - 1, Number(index) || 0));
    const stop = cards[safeIndex] || cards[0] || null;
    if(!stop || !isValidLonLatV39687(stop.coord)) return null;
    return stop.coord;
  }

  function getStopPercentV39686(category, index){
    const cards = getActiveCategoryCardsV39686(category);
    const stop = cards[Math.max(0, Math.min(cards.length - 1, Number(index) || 0))] || null;
    const total = getRouteDistanceKmV39686();
    if(stop && isFinite(stop.distanceKm) && total) return Math.max(0.02, Math.min(0.98, stop.distanceKm / total));
    return 0.5;
  }

  function getActiveMapOverlayTopV39684(){
    // Measure the first visible Roadora surface that covers the bottom of the map.
    const selectors = [
      '#mapDrawer .rd-hotel-preview-popover-v39644',
      '#mapDrawer',
      '.rd-map-nav-v28'
    ];
    let top = window.innerHeight || 760;
    selectors.forEach(function(sel){
      const el = document.querySelector(sel);
      if(!el) return;
      try{
        const rect = el.getBoundingClientRect();
        const visible = rect && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < (window.innerHeight || 760);
        if(visible && rect.top > 0) top = Math.min(top, rect.top);
      }catch(_){ }
    });
    return top;
  }

  function getRouteSegmentBoundsPointsV39685(percent, selected){
    const points = [];
    if(!routeCoordinates.length){
      points.push(selected);
      return points;
    }

    const start = routeCoordinates[0];
    const destination = routeCoordinates[routeCoordinates.length - 1];
    if(start) points.push(latLng(start));

    // Keep the meaningful route context from start/current-context to the selected stop.
    const routeIndex = Math.max(0, Math.min(routeCoordinates.length - 1, Math.floor(routeCoordinates.length * Math.max(0.04, Math.min(0.96, percent)))));
    const marginIndex = Math.max(routeIndex, Math.min(routeCoordinates.length - 1, routeIndex + Math.floor(routeCoordinates.length * 0.035)));
    const step = Math.max(1, Math.floor(Math.max(1, marginIndex) / 16));
    for(let i = 0; i <= marginIndex; i += step){
      if(routeCoordinates[i]) points.push(latLng(routeCoordinates[i]));
    }

    if(routeCoordinates[routeIndex]) points.push(latLng(routeCoordinates[routeIndex]));
    points.push(selected);
    if(percent > 0.72 && destination) points.push(latLng(destination));
    return points;
  }

  function ensureSelectedStopAboveOverlayV39689(selected){
    if(!map || !selected || !map.latLngToContainerPoint) return;
    try{
      const viewportH = window.innerHeight || 760;
      const overlayTop = getActiveMapOverlayTopV39684();
      // Keep the selected stop in the visible map area, just above the active
      // hotel/fuel/etc. popover. This is the missing correction after fitBounds:
      // Leaflet padding protects bounds, but the selected point can still sit
      // behind the large Roadora popover on Android Chrome.
      const desiredY = Math.max(136, Math.min(overlayTop - 92, Math.round(viewportH * 0.58)));
      const point = map.latLngToContainerPoint(selected);
      const overflow = point.y - desiredY;
      if(overflow > 10){
        map.panBy([0, overflow], { animate:true, duration:.28 });
      }
    }catch(_){ }
  }

  function focusSelectedCategoryStopOnMap(category, index){
    if(!map || !window.L || !routeCoordinates.length) return;
    const safeCategory = category || 'hotels';
    const safeIndex = Math.max(0, Number(index) || 0);
    const coord = getStopCoordV39686(safeCategory, safeIndex);
    if(!coord) return;

    const percent = getStopPercentV39686(safeCategory, safeIndex);
    const selected = latLng(coord);
    const boundPoints = getRouteSegmentBoundsPointsV39685(percent, selected);

    try{
      map.invalidateSize && map.invalidateSize(false);

      const viewportH = window.innerHeight || 760;
      const viewportW = window.innerWidth || 390;
      const overlayTop = getActiveMapOverlayTopV39684();
      const coveredBottom = Math.max(0, viewportH - overlayTop);
      const bottomPadding = Math.max(360, Math.min(Math.round(viewportH * 0.72), Math.round(coveredBottom + 170)));
      const topPadding = Math.max(118, Math.min(174, Math.round(viewportH * 0.17)));
      const sidePadding = Math.max(30, Math.min(52, Math.round(viewportW * 0.10)));

      const bounds = L.latLngBounds(boundPoints);
      map.fitBounds(bounds.pad(0.10), {
        animate:true,
        duration:.45,
        maxZoom:8,
        paddingTopLeft:[sidePadding, topPadding],
        paddingBottomRight:[sidePadding, bottomPadding]
      });

      // Second pass after the popover has finished rendering/measuring. Then do
      // a pixel correction so the selected pin is physically above the popover.
      window.setTimeout(function(){
        try{
          const overlayTopNow = getActiveMapOverlayTopV39684();
          const coveredNow = Math.max(0, (window.innerHeight || viewportH) - overlayTopNow);
          const bottomNow = Math.max(380, Math.min(Math.round((window.innerHeight || viewportH) * 0.74), Math.round(coveredNow + 190)));
          map.fitBounds(bounds.pad(0.10), {
            animate:true,
            duration:.28,
            maxZoom:8,
            paddingTopLeft:[sidePadding, topPadding],
            paddingBottomRight:[sidePadding, bottomNow]
          });
        }catch(_){ }
      }, 130);

      window.setTimeout(function(){ ensureSelectedStopAboveOverlayV39689(selected); }, 430);
      window.setTimeout(function(){ ensureSelectedStopAboveOverlayV39689(selected); }, 760);
    }catch(_){
      try{
        map.setView(selected, Math.min((map.getZoom && map.getZoom()) || 7, 7), { animate:true, duration:.35 });
        window.setTimeout(function(){ ensureSelectedStopAboveOverlayV39689(selected); }, 160);
      }catch(__){ }
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
    const cards = getActiveCategoryCardsV39686(category);
    const created = [];

    cards.forEach((stop, i)=>{
      const coord = getStopCoordV39686(category, i);
      if(!coord) return;
      const name = (stop && stop.name) || (meta.items && meta.items[i]) || meta.label;
      const isActivePin = activeCategoryPinV39682 === category && activeCategoryPinIndexV39682 === i;
      const marker = L.marker(latLng(coord), { icon: categoryPinIcon(category, i, isActivePin), riseOnHover:true, zIndexOffset: isActivePin ? 900 : 0 });
      marker.on('click', function(ev){
        try{
          if(ev && ev.originalEvent){
            ev.originalEvent.preventDefault && ev.originalEvent.preventDefault();
            ev.originalEvent.stopPropagation && ev.originalEvent.stopPropagation();
          }

          // v39.7.06 — robust cross-scope stop selection.
          // Leaflet marker clicks live in the map closure, while the popover
          // renderer lives in the sheet/controller closure. Dispatch one global
          // event so the real Stop Controller handles pin clicks exactly like
          // card clicks. This avoids calling preview functions across scopes.
          window.dispatchEvent(new CustomEvent('roadora:select-stop', {
            detail:{ category: category, index: i, source:'pin' }
          }));
        }catch(err){
          console.warn('Roadora stop selection failed', err);
        }
      });
      marker.addTo(categoryLayer);
      created.push(marker);
    });

    // Only category selection may show the overview of available stops. Card selection
    // is handled exclusively by focusSelectedCategoryStopOnMap(), so no two map-focus
    // systems can fight each other anymore.
    if(created.length && !(typeof activeIndex === 'number' && activeIndex >= 0)){
      const group = L.featureGroup(created);
      try{
        map.fitBounds(group.getBounds().pad(0.75), {
          animate:true,
          duration:.30,
          maxZoom:7,
          paddingTopLeft:[34,126],
          paddingBottomRight:[34,300]
        });
      }catch(_){ }
    }

    setText('#mapStatusNext', meta.label + ' geselecteerd');
    showMapToast(meta.toast);
  }

  // v39.6.96 — gated pins for filter-based categories.
  // Eten and Uitjes first show a filter menu. Pins are rendered only after the
  // user chooses a concrete subfilter, so the map never shows generic/old pins.
  function clearCategoryPinsForFilterMenuV39696(label){
    try{
      if(categoryLayer) categoryLayer.clearLayers();
      activeCategoryPinV39682 = '';
      activeCategoryPinIndexV39682 = -1;
      if(label) setText('#mapStatusNext', label);
    }catch(_){ }
  }

  window.addEventListener('roadora:stop-category-change', function(ev){
    const category = ev.detail && ev.detail.category;
    if(!category) return;
    if(category === 'food' && !document.body.getAttribute('data-food-filter')){
      clearCategoryPinsForFilterMenuV39696('Kies type eten');
      return;
    }
    if(category === 'discover' && !document.body.getAttribute('data-discover-filter')){
      clearCategoryPinsForFilterMenuV39696('Kies type uitje');
      return;
    }
    renderCategoryPins(category);
  });

  if (window.RoadoraApp) {
    window.RoadoraApp.renderCategoryPins = renderCategoryPins;
    window.RoadoraApp.clearCategoryPins = clearCategoryPinsForFilterMenuV39696;
  }


  /* Roadora v39.6.94 — remove only orphan endpoint marker in the top-left corner.
     This is a DOM cleanup for a stale Leaflet endpoint element; it does not touch
     route logic, card/pin selection, ORS, Maps export or sheet flow. */
  function cleanupTopLeftEndpointGhostV39694(){
    const mapEl = document.getElementById('routeLeafletMap');
    if(!mapEl) return;
    const endpoints = Array.from(mapEl.querySelectorAll('.endpointMarker'));
    if(endpoints.length <= 2) return;
    const mapRect = mapEl.getBoundingClientRect();
    endpoints.forEach(el=>{
      const rect = el.getBoundingClientRect();
      const isTopLeftGhost = rect.left <= mapRect.left + 4 && rect.top <= mapRect.top + 4;
      if(isTopLeftGhost) el.classList.add('rdEndpointGhostHiddenV39694');
      else el.classList.remove('rdEndpointGhostHiddenV39694');
    });
  }
  function scheduleEndpointGhostCleanupV39694(){
    cleanupTopLeftEndpointGhostV39694();
    requestAnimationFrame(cleanupTopLeftEndpointGhostV39694);
    setTimeout(cleanupTopLeftEndpointGhostV39694, 120);
    setTimeout(cleanupTopLeftEndpointGhostV39694, 420);
  }

  function addEndpoints(startCoord, endCoord){
    const r=activeRoute();
    L.marker(latLng(startCoord), { icon:endpointIcon() }).addTo(markerLayer);
    L.marker(latLng(endCoord), { icon:endpointIcon() }).addTo(markerLayer);
    L.marker(latLng(startCoord), { icon:labelIcon(`${r.start}<br><small>Start</small>`) }).addTo(labelLayer);
    L.marker(latLng(endCoord), { icon:labelIcon(`${r.end}<br><small>Eindbestemming</small>`) }).addTo(labelLayer);
    scheduleEndpointGhostCleanupV39694();
  }
  function drawFallback(startCoord, endCoord){
    routeCoordinates=[startCoord,endCoord];
    routeDistanceCacheV39686 = null;
    routeLayer.clearLayers(); markerLayer.clearLayers(); labelLayer.clearLayers(); if(categoryLayer) categoryLayer.clearLayers();
    L.polyline([latLng(startCoord), latLng(endCoord)], { color:'#b87932', weight:5, opacity:.95, lineCap:'round', lineJoin:'round' }).addTo(routeLayer);
    addEndpoints(startCoord,endCoord);
    fitRoute();
  }
  function drawGeoJson(data,startCoord,endCoord){
    routeLayer.clearLayers(); markerLayer.clearLayers(); labelLayer.clearLayers(); if(categoryLayer) categoryLayer.clearLayers();
    const coords=data?.features?.[0]?.geometry?.coordinates || [];
    routeCoordinates = coords.length ? coords : [startCoord,endCoord];
    routeDistanceCacheV39686 = null;
    L.geoJSON(data, { style:{ color:'#b87932', weight:5, opacity:.95, lineCap:'round', lineJoin:'round' } }).addTo(routeLayer);
    addEndpoints(startCoord,endCoord);
    const summary = data?.features?.[0]?.properties?.summary || {};
    updateLabels(summary);
    if(summary && (Number(summary.distance) || Number(summary.duration))){
      RoadoraState.route.summary = {
        distance: Number(summary.distance || 0),
        duration: Number(summary.duration || 0)
      };
      saveState();
      renderRoutePlan();
    }
    fitRoute();
  }
  async function loadRoute(force=false){
    ensureBase();
    if(!map) return;

    const r=activeRoute();
    const key = routeKeyV39745(r);

    // Roadora v39.7.45 — no concurrent route builds.
    // A forced refresh during an active ORS request used to draw the fallback line
    // again, then ORS again. That created the visible straight-line flicker.
    if(loading){
      if(force) pendingReloadV39745 = true;
      return;
    }

    // If this exact route is already on the map, only repair Leaflet's size/fit.
    if(!force && displayedRouteKeyV39745 === key && routeCoordinates.length){
      try{ map.invalidateSize(false); }catch(_){ }
      fitRoute();
      return;
    }

    loading=true;
    activeLoadKeyV39745 = key;
    const startCoord=coordFor(r.start, DEFAULT_START);
    const endCoord=coordFor(r.end, DEFAULT_END);
    updateLabels(null);

    // Roadora v39.7.46 — no pre-fallback.
    // Do not draw the straight fallback line while ORS is still loading.
    // The fallback is only visualised when ORS really fails. If an older route is
    // already visible, keep it on screen until the new ORS geometry replaces it.
    if(displayedRouteKeyV39745 !== key && !routeCoordinates.length){
      routeLayer.clearLayers();
      markerLayer.clearLayers();
      labelLayer.clearLayers();
      if(categoryLayer) categoryLayer.clearLayers();
    }

    showMapToast('Route laden…');
    try{
      const url=`/api/route?start=${encodeURIComponent(startCoord.join(','))}&end=${encodeURIComponent(endCoord.join(','))}&profile=${encodeURIComponent(profileFor(r.vehicle))}`;
      const res=await fetch(url);
      if(!res.ok) throw new Error(`ORS ${res.status}`);
      const data=await res.json();
      if(activeLoadKeyV39745 !== key) return;
      drawGeoJson(data,startCoord,endCoord);
      displayedRouteKeyV39745 = key;
      showMapToast('Echte ORS route geladen');
    }catch(err){
      console.warn('Roadora map fallback:',err);
      drawFallback(startCoord,endCoord);
      updateLabels(null);
      displayedRouteKeyV39745 = key;
      showMapToast('Fallback route actief');
    }finally{
      loading=false;
      setTimeout(()=>map?.invalidateSize(false),80);
      if(pendingReloadV39745){
        pendingReloadV39745 = false;
        setTimeout(()=>loadRoute(true), 120);
      }
    }
  }
  // Roadora v39.7.44 — route label + fit padding fix.
  // Keep ORS/Maps untouched. Fit only adapts to the visible topbar + map bottom nav
  // so the real route, start marker and destination marker stay out of the UI surfaces.
  function fitRoute(){
    if(!map || !routeCoordinates.length) return;
    const bounds=L.latLngBounds(routeCoordinates.map(latLng));
    let topPad = 154;
    let bottomPad = 178;
    try{
      const topbar = document.querySelector('#mapScreen .mapTopbar.smartTopbar');
      const nav = document.querySelector('.rd-map-nav-v28');
      const drawer = document.querySelector('#mapDrawer');
      if(topbar){
        const r = topbar.getBoundingClientRect();
        if(r.height) topPad = Math.max(138, Math.round(r.bottom + 24));
      }
      const vh = window.innerHeight || 760;
      let overlayTop = vh;
      [drawer, nav].forEach(function(el){
        if(!el) return;
        const r = el.getBoundingClientRect();
        const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh;
        if(visible && r.top > 0) overlayTop = Math.min(overlayTop, r.top);
      });
      if(overlayTop < vh){
        bottomPad = Math.max(188, Math.min(310, Math.round(vh - overlayTop + 72)));
      }
    }catch(_){ }
    map.fitBounds(bounds, {
      paddingTopLeft:[44,topPad],
      paddingBottomRight:[44,bottomPad],
      maxZoom:9,
      animate:true
    });
    setTimeout(function(){ try{ map.invalidateSize(false); }catch(_){ } }, 80);
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
  // Roadora v39.7.43 — robust map boot after Routeplan → Map.
  // Some mobile browsers open the map screen before Leaflet has a measurable
  // container. Keep ORS/Maps logic unchanged, but retry size + route load a few
  // times so the user never lands on an empty blue fallback canvas.
  function bootMapV39743(force){
    ensureBase();
    if(!map){
      setTimeout(function(){ bootMapV39743(force); }, 160);
      return;
    }

    // Roadora v39.7.45 — one route load, multiple size repairs.
    // The size repairs keep Leaflet stable after screen changes, but they no
    // longer trigger new route fetches/fallback redraws.
    setTimeout(function(){ loadRoute(!!force); }, 80);
    [180, 420, 900, 1500].forEach(function(delay){
      setTimeout(function(){
        try{ map.invalidateSize(false); }catch(_){ }
        if(routeCoordinates.length) fitRoute();
      }, delay);
    });
  }

  window.RoadoraMap = {
    ensure(){ bootMapV39743(false); },
    refresh(){ bootMapV39743(true); },
    fit: fitRoute
  };
  if(document.body.dataset.activeScreen === 'map') window.RoadoraMap.ensure();
})();


/* Roadora v39.7.48 — oude ongebruikte map-nav handlers verwijderd.
   De huidige kaart gebruikt alleen body > nav.rd-map-nav-v28. */

/* Roadora v39.7.48 — dubbele v28 active-state handler verwijderd.
   Drawer-controller is nu de enige bron voor map-panel state. */

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

    document.querySelectorAll("body > nav.rd-map-nav-v28 .rd-nav-btn-v28").forEach(function(btn){
      var active = btn.dataset.mapPanel === panel;
      btn.classList.toggle("is-active", active);
      btn.classList.remove("active");
      if(active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
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
    document.querySelectorAll("body > nav.rd-map-nav-v28 .rd-nav-btn-v28").forEach(function(btn){
      btn.classList.remove("is-active", "active");
      btn.removeAttribute("aria-current");
    });
  }

  document.addEventListener("click", function(e){
    var btn = e.target.closest("body > nav.rd-map-nav-v28 .rd-nav-btn-v28");
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
    var btn = e.target.closest("body > nav.rd-map-nav-v28 .rd-nav-btn-v28");
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
    return target.closest("body > nav.rd-map-nav-v28 .rd-nav-btn-v28");
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
    document.querySelectorAll("body > nav.rd-map-nav-v28 .rd-nav-btn-v28").forEach(function(btn){
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
    return target && target.closest && target.closest("body > nav.rd-map-nav-v28 .rd-nav-btn-v28");
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
    document.querySelectorAll("body > nav.rd-map-nav-v28 .rd-nav-btn-v28").forEach(function(btn){
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


  // v39.7.21 — isolate Food filter layout from normal card strips.
  // Food filters are a compact grid state, not horizontal result cards.
  function clearFoodFilterHostV39721(){
    try{
      const container = findStopsContainer && findStopsContainer();
      if(container){
        container.classList.remove('rd-food-filter-grid-v39719');
        container.classList.remove('rd-food-filter-host-v39720');
        container.classList.remove('rd-food-filter-host-v39721');
      }
    }catch(_){ }
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

  // v39.6.88 — shared stop registry for map pins, cards, popovers and future API data.
  // The map engine is an earlier closure, so all sheet datasets must be exposed through
  // one safe read-only bridge instead of direct cross-closure variable access.
  window.RoadoraStopDataV39688 = {
    getCards:function(category){
      const c = category || document.body.getAttribute('data-active-stop-category') || 'hotels';
      if(c === 'hotels') return HOTEL_STRIP_CARDS_V39636 || [];
      if(c === 'fuel') return FUEL_STRIP_CARDS_V39646 || [];
      if(c === 'charge') return CHARGE_STRIP_CARDS_V39647 || [];
      if(c === 'food') return getFoodCardsV39678 ? getFoodCardsV39678() : (FOOD_STRIP_CARDS_V39648 || []);
      if(c === 'discover') return getDiscoverCardsV39681 ? getDiscoverCardsV39681() : (DISCOVER_STRIP_CARDS_V39649 || []);
      if(c === 'wc') return WC_STRIP_CARDS_V39653 || [];
      return HOTEL_STRIP_CARDS_V39636 || [];
    }
  };
  window.RoadoraStopData = window.RoadoraStopDataV39688;

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


  // v39.7.04 — oude Nu Nodig assist-data verwijderd. Nu Nodig gebruikt dezelfde stop/card/popover-flow als Stops.

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
    clearFoodFilterHostV39721();
    document.body.removeAttribute('data-stop-subpanel');
    document.body.removeAttribute('data-food-filter');
    document.body.removeAttribute('data-discover-filter');
    document.body.removeAttribute('data-now-assist');
    document.body.removeAttribute('data-now-help-sub');
    document.body.setAttribute('data-now-needed','open');
    closeHotelPreview();
    clearStopMapPinsV39697('Kies wat je nu nodig hebt');
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
    clearFoodFilterHostV39721();
    document.body.removeAttribute('data-stop-subpanel');
    document.body.removeAttribute('data-now-assist');
    document.body.setAttribute('data-now-needed','open');
    document.body.setAttribute('data-now-help-sub','open');
    closeHotelPreview();
    clearStopMapPinsV39697('Kies type hulp');
    container.innerHTML = NOW_HELP_FILTERS_V39674.map(function(card){
      return '<button type="button" class="rd-render-stop-card-v39619" data-now-help-type="'+card.category+'">' +
        '<span class="rd-render-stop-icon-v39619">'+card.icon+'</span>' +
        '<strong>'+card.title+'</strong><em>›</em>' +
      '</button>';
    }).join('');
  }

  // v39.7.04 — oude renderNowAssist verwijderd; Nu Nodig resultaat-states lopen via Stops-renderers.


  // v39.6.99-step1 — Nu Nodig clean foundation.
  // Reuse the stable Stops renderers instead of the old assist layout for core
  // categories. This keeps Nu Nodig on the same pin/card/popover architecture
  // without touching the working Stops flow.
  function renderNowCategoryWithStopsFlowV39699(category){
    const c = category || '';
    document.body.setAttribute('data-now-needed','open');
    document.body.removeAttribute('data-now-assist');
    document.body.removeAttribute('data-now-help-sub');
    closeHotelPreview();

    if(c === 'help'){
      renderNowHelpFilters();
      return;
    }
    if(c === 'food'){
      clearStopMapPinsV39697('Kies type eten');
      renderFoodFilters();
      return;
    }
    if(c === 'sleep'){
      document.body.setAttribute('data-active-stop-category', 'hotels');
      renderHotelStrip();
      if(window.RoadoraApp && typeof window.RoadoraApp.renderCategoryPins === 'function'){
        window.RoadoraApp.renderCategoryPins('hotels');
      }
      return;
    }
    if(c === 'fuel'){
      document.body.setAttribute('data-active-stop-category', 'fuel');
      renderFuelStrip();
      if(window.RoadoraApp && typeof window.RoadoraApp.renderCategoryPins === 'function'){
        window.RoadoraApp.renderCategoryPins('fuel');
      }
      return;
    }
    if(c === 'charge'){
      document.body.setAttribute('data-active-stop-category', 'charge');
      renderChargeStrip();
      if(window.RoadoraApp && typeof window.RoadoraApp.renderCategoryPins === 'function'){
        window.RoadoraApp.renderCategoryPins('charge');
      }
      return;
    }
    if(c === 'wc'){
      document.body.setAttribute('data-active-stop-category', 'wc');
      renderWcStrip();
      if(window.RoadoraApp && typeof window.RoadoraApp.renderCategoryPins === 'function'){
        window.RoadoraApp.renderCategoryPins('wc');
      }
    }
  }

  function renderStops(){
    const container = findStopsContainer();
    if(!container) return;
    clearFoodFilterHostV39721();
    container.classList.remove('rd-food-filter-host-v39720');
    container.classList.remove('rd-food-filter-grid-v39719');
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
    clearFoodFilterHostV39721();
    container.classList.remove('rd-food-filter-host-v39720');
    container.classList.remove('rd-food-filter-grid-v39719');
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
    clearFoodFilterHostV39721();
    container.classList.remove('rd-food-filter-host-v39720');
    container.classList.remove('rd-food-filter-grid-v39719');
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
    clearFoodFilterHostV39721();
    container.classList.remove('rd-food-filter-host-v39720');
    container.classList.remove('rd-food-filter-grid-v39719');
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
    // v39.7.20 — food filters use their own tiny inner grid.
    // This bypasses old Stops/Nu Nodig card-list CSS that was forcing one-column rows.
    container.classList.remove('rd-food-filter-grid-v39719');
    container.classList.remove('rd-food-filter-host-v39720');
    container.classList.add('rd-food-filter-host-v39721');
    document.body.setAttribute('data-stop-subpanel','food-filter');
    document.body.removeAttribute('data-food-filter');
    document.body.removeAttribute('data-hotel-preview');
    document.body.removeAttribute('data-fuel-preview');
    document.body.removeAttribute('data-charge-preview');
    document.body.removeAttribute('data-food-preview');
    document.body.removeAttribute('data-discover-preview');
    document.body.removeAttribute('data-wc-preview');
    closeHotelPreview();
    container.innerHTML = '<div class="rd-food-filter-grid-v39721" aria-label="Kies type eten">' +
      FOOD_FILTERS_V39678.map(function(card){
        return '<button type="button" class="rd-render-stop-card-v39619 rd-food-filter-option-v39721" data-food-filter="'+card.key+'">' +
          '<span class="rd-render-stop-icon-v39619">'+card.icon+'</span>' +
          '<strong>'+card.title+'</strong><em>›</em>' +
        '</button>';
      }).join('') +
    '</div>';
  }

  function renderFoodStrip(filterKey){
    const container = findStopsContainer();
    if(!container) return;
    container.classList.remove('rd-food-filter-grid-v39719');
    container.classList.remove('rd-food-filter-host-v39720');
    container.classList.remove('rd-food-filter-host-v39721');
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
    clearFoodFilterHostV39721();
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
    clearFoodFilterHostV39721();
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
    clearFoodFilterHostV39721();
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


  // v39.7.15 — restore correct Nu Nodig floating preview mount.
  // Stops keep their preview inside #mapDrawer. Nu Nodig uses the same
  // renderer/classes/data, but mounts the preview directly on #mapScreen so
  // the fixed card-strip cannot clip or swallow the popover.
  function getRoadoraPreviewMountV39707(drawer){
    try{
      if(document.body.getAttribute('data-instant-map-panel') === 'now'){
        return document.getElementById('mapScreen') || drawer || document.body;
      }
    }catch(_){ }
    return drawer || document.getElementById('mapDrawer') || document.getElementById('mapScreen') || document.body;
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
    getRoadoraPreviewMountV39707(drawer).appendChild(pop);
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
    getRoadoraPreviewMountV39707(drawer).appendChild(pop);
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
    getRoadoraPreviewMountV39707(drawer).appendChild(pop);
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
    getRoadoraPreviewMountV39707(drawer).appendChild(pop);
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
    getRoadoraPreviewMountV39707(drawer).appendChild(pop);
  }

  function closeHotelPreview(){
    document.body.removeAttribute('data-hotel-preview');
    document.body.removeAttribute('data-fuel-preview');
    document.body.removeAttribute('data-charge-preview');
    document.body.removeAttribute('data-food-preview');
    document.body.removeAttribute('data-discover-preview');
    document.body.removeAttribute('data-wc-preview');
    document.querySelectorAll('#mapDrawer .rd-hotel-preview-popover-v39644, #mapScreen > .rd-hotel-preview-popover-v39644, body > .rd-hotel-preview-popover-v39644').forEach(function(old){
      old.remove();
    });
  }


  // v39.6.97 — safe cleanup for stop-map state.
  // Keep this as a thin wrapper around the existing map API so the Stops
  // selection flow remains untouched. Used when switching categories,
  // closing the Stops tab, or leaving Stops for another bottom-nav panel.
  function clearStopMapPinsV39697(label){
    try{
      if(window.RoadoraApp && typeof window.RoadoraApp.clearCategoryPins === 'function'){
        window.RoadoraApp.clearCategoryPins(label || '');
      }
    }catch(_){ }
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
        '<div class="rd-hotel-preview-actions-v39644 rd-hotel-preview-actions-v39763">' +
          '<button type="button" class="rd-hotel-preview-save-v39644">Opslaan</button>' +
          '<button type="button" class="rd-hotel-preview-add-v39763">Toevoegen</button>' +
          '<button type="button" class="rd-hotel-preview-nav-v39644">Navigeer</button>' +
        '</div>' +
      '</div>';
    getRoadoraPreviewMountV39707(drawer).appendChild(pop);
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
      closeHotelPreview();
      clearStopMapPinsV39697('Kies stop');
      renderStops();
      setTimeout(renderStops, 50);
    } else if(panel === "now"){
      closeHotelPreview();
      clearStopMapPinsV39697('');
      renderNowNeeded();
      setTimeout(renderNowNeeded, 50);
    } else {
      document.body.removeAttribute('data-now-needed');
      document.body.removeAttribute('data-now-assist');
      document.body.removeAttribute('data-stop-subpanel');
      closeHotelPreview();
      clearStopMapPinsV39697('');
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
    document.body.removeAttribute('data-discover-filter');
    document.body.removeAttribute('data-stop-subpanel');
    closeHotelPreview();
    clearStopMapPinsV39697('');
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
    // v39.6.97 — category changes must never leave old pins/popovers behind.
    // The selected category will render fresh pins later when applicable.
    closeHotelPreview();
    clearStopMapPinsV39697('');
    document.querySelectorAll(".rd-render-stop-card-v39619").forEach(function(item){
      item.classList.toggle("is-active", item === card);
    });

    // Filter-based categories should not immediately place generic pins.
    // First show the subfilter menu; after a subfilter click, renderCategoryPins()
    // is called with the filtered data.
    if(category === 'food'){
      if(window.RoadoraApp && typeof window.RoadoraApp.clearCategoryPins === 'function'){
        window.RoadoraApp.clearCategoryPins('Kies type eten');
      }
      renderFoodFilters();
    }else if(category === 'discover'){
      if(window.RoadoraApp && typeof window.RoadoraApp.clearCategoryPins === 'function'){
        window.RoadoraApp.clearCategoryPins('Kies type uitje');
      }
      renderDiscoverFilters();
    }else{
      window.dispatchEvent(new CustomEvent("roadora:stop-category-change", { detail:{ category:category } }));
      if(category === 'hotels'){
        renderHotelStrip();
      }else if(category === 'fuel'){
        renderFuelStrip();
      }else if(category === 'charge'){
        renderChargeStrip();
      }else if(category === 'wc'){
        renderWcStrip();
      }else{
        document.body.removeAttribute('data-stop-subpanel');
        closeHotelPreview();
      }
    }
  }, true);

  document.addEventListener("click", function(e){
    const nowHelpType = e.target.closest && e.target.closest('[data-now-help-type]');
    if(nowHelpType){
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('[data-now-help-type]').forEach(function(item){
        item.classList.toggle('is-active', item === nowHelpType);
      });
      // v39.7.04 — hulp-subtypes blijven in dezelfde clean Stops-architectuur.
      // Tot echte hulp-API's gekoppeld worden, gebruiken we de uitjes/voorzieningen-strip
      // als veilige card/pin/popover basis in plaats van de oude assist-flow.
      document.body.setAttribute('data-active-stop-category', 'discover');
      renderDiscoverStrip('viewpoint');
      if(window.RoadoraApp && typeof window.RoadoraApp.renderCategoryPins === 'function'){
        window.RoadoraApp.renderCategoryPins('discover');
      }
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
    renderNowCategoryWithStopsFlowV39699(category);
  }, true);



  /* v39.6.92 — Roadora Stop Controller Foundation.
     One central selection path for Stops: card-click and pin-click both call
     selectRoadoraStop(category, index). This keeps preview, active card, active
     pin and map focus in sync without bridge/patch functions. */
  function getStopCardSelectorV39692(category){
    if(category === 'fuel') return '.rd-fuel-card-v39646';
    if(category === 'charge') return '.rd-charge-card-v39647';
    if(category === 'food') return '.rd-food-card-v39648';
    if(category === 'discover') return '.rd-discover-card-v39649';
    if(category === 'wc') return '.rd-wc-card-v39653';
    return '.rd-hotel-card-v39636:not(.rd-fuel-card-v39646):not(.rd-charge-card-v39647):not(.rd-food-card-v39648):not(.rd-discover-card-v39649):not(.rd-wc-card-v39653)';
  }

  function scrollSelectedStopCardIntoViewV39692(category, index){
    try{
      const selector = getStopCardSelectorV39692(category);
      const attr = category === 'fuel' ? 'data-fuel-index'
        : category === 'charge' ? 'data-charge-index'
        : category === 'food' ? 'data-food-index'
        : category === 'discover' ? 'data-discover-index'
        : category === 'wc' ? 'data-wc-index'
        : 'data-hotel-index';
      const card = Array.from(document.querySelectorAll(selector)).find(function(item){
        return parseInt(item.getAttribute(attr) || '0', 10) === index;
      });
      if(card){
        card.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' });
      }
    }catch(_){ }
  }

  function setActiveStopCardV39692(category, index){
    try{
      const selector = getStopCardSelectorV39692(category);
      const attr = category === 'fuel' ? 'data-fuel-index'
        : category === 'charge' ? 'data-charge-index'
        : category === 'food' ? 'data-food-index'
        : category === 'discover' ? 'data-discover-index'
        : category === 'wc' ? 'data-wc-index'
        : 'data-hotel-index';
      document.querySelectorAll(selector).forEach(function(item){
        const itemIndex = parseInt(item.getAttribute(attr) || '0', 10) || 0;
        item.classList.toggle('is-active', itemIndex === index);
      });
    }catch(_){ }
  }

  function renderStopPreviewV39692(category, index){
    if(category === 'fuel') return renderFuelPreview(index);
    if(category === 'charge') return renderChargePreview(index);
    if(category === 'food') return renderFoodPreview(index);
    if(category === 'discover') return renderDiscoverPreview(index);
    if(category === 'wc') return renderWcPreview(index);
    return renderHotelPreview(index);
  }

  function selectRoadoraStop(category, index, options){
    const opts = options || {};
    const safeCategory = category || 'hotels';
    const safeIndex = Math.max(0, parseInt(index || 0, 10) || 0);

    document.body.setAttribute('data-active-stop-category', safeCategory);
    setActiveStopCardV39692(safeCategory, safeIndex);
    renderStopPreviewV39692(safeCategory, safeIndex);

    if(window.RoadoraApp && typeof window.RoadoraApp.renderCategoryPins === 'function'){
      window.RoadoraApp.renderCategoryPins(safeCategory, safeIndex);
    }

    window.setTimeout(function(){ scrollSelectedStopCardIntoViewV39692(safeCategory, safeIndex); }, 40);

    if(opts.focus !== false){
      window.setTimeout(function(){
        try{ focusSelectedCategoryStopOnMap(safeCategory, safeIndex); }catch(_){ }
      }, opts.source === 'pin' ? 80 : 120);
    }
  }

  if(window.RoadoraApp){
    window.RoadoraApp.selectStop = selectRoadoraStop;
  }

  // v39.7.06 — single global selection event for Leaflet pins.
  // Pins are rendered in the map closure; previews/cards live in this controller
  // closure. This listener keeps both sides coupled without temporary bridges.
  if(!window.__roadoraSelectStopEventV39706){
    window.__roadoraSelectStopEventV39706 = true;
    window.addEventListener('roadora:select-stop', function(ev){
      try{
        const detail = (ev && ev.detail) || {};
        selectRoadoraStop(detail.category || 'hotels', detail.index || 0, {
          source: detail.source || 'pin'
        });
      }catch(err){
        console.warn('Roadora select-stop event failed', err);
      }
    });
  }
  document.addEventListener("click", function(e){
    // Roadora v39.7.70 — remove legacy saved-hotel intercept.
    // Saved Hotels now use the real persistent route-state handler below
    // ([data-hotel-add-route] inside [data-saved-hotel-card]).
    // Map preview "Toevoegen" keeps using .rd-hotel-preview-add-v39763.
    const addPreviewRoute = e.target.closest && e.target.closest(".rd-hotel-preview-add-v39763");
    if(addPreviewRoute){
      e.preventDefault();
      e.stopPropagation();
      addPreviewRoute.classList.add("is-added-v39763");
      addPreviewRoute.textContent = "Toegevoegd";
      showMapToast("Hotel klaar om toe te voegen aan je route");
      return;
    }

    const previewNav = e.target.closest && e.target.closest(".rd-hotel-preview-nav-v39644");
    if(previewNav){
      e.preventDefault();
      e.stopPropagation();
      openGoogleMapsRoute();
      return;
    }

    const savePreview = e.target.closest && e.target.closest(".rd-hotel-preview-save-v39644");
    if(savePreview){
      e.preventDefault();
      e.stopPropagation();
      // v39.6.97 — saving a stop should return the user to the calm sheet state.
      // Do not change selected stop/pins here; only close the temporary popover.
      closeHotelPreview();
      return;
    }

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
      selectRoadoraStop('fuel', fuelIndex, { source:'card' });
      return;
    }

    const charge = e.target.closest && e.target.closest(".rd-charge-card-v39647");
    if(charge){
      e.preventDefault();
      e.stopPropagation();
      const chargeIndex = parseInt(charge.getAttribute('data-charge-index') || '0', 10) || 0;
      selectRoadoraStop('charge', chargeIndex, { source:'card' });
      return;
    }

    const food = e.target.closest && e.target.closest(".rd-food-card-v39648");
    if(food){
      e.preventDefault();
      e.stopPropagation();
      const foodIndex = parseInt(food.getAttribute('data-food-index') || '0', 10) || 0;
      selectRoadoraStop('food', foodIndex, { source:'card' });
      return;
    }

    const discover = e.target.closest && e.target.closest(".rd-discover-card-v39649");
    if(discover){
      e.preventDefault();
      e.stopPropagation();
      const discoverIndex = parseInt(discover.getAttribute('data-discover-index') || '0', 10) || 0;
      selectRoadoraStop('discover', discoverIndex, { source:'card' });
      return;
    }

    const wc = e.target.closest && e.target.closest(".rd-wc-card-v39653");
    if(wc){
      e.preventDefault();
      e.stopPropagation();
      const wcIndex = parseInt(wc.getAttribute('data-wc-index') || '0', 10) || 0;
      selectRoadoraStop('wc', wcIndex, { source:'card' });
      return;
    }

    const hotel = e.target.closest && e.target.closest(".rd-hotel-card-v39636:not(.rd-fuel-card-v39646):not(.rd-charge-card-v39647):not(.rd-food-card-v39648):not(.rd-discover-card-v39649):not(.rd-wc-card-v39653)");
    if(!hotel) return;
    e.preventDefault();
    e.stopPropagation();
    const index = parseInt(hotel.getAttribute('data-hotel-index') || '0', 10) || 0;
    selectRoadoraStop('hotels', index, { source:'card' });
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
          const panel = document.body.getAttribute('data-instant-map-panel');
          // v39.6.98/v39.6.99 — swipe-back from cards to categories must also clear
          // the active map stop state. Stops returns to Stops categories; Nu Nodig
          // returns to Nu Nodig categories.
          closeHotelPreview();
          clearStopMapPinsV39697(panel === 'now' ? 'Kies wat je nu nodig hebt' : 'Kies stop');
          if(panel === 'now'){
            renderNowNeeded();
          } else if(subpanel === 'food'){
            clearStopMapPinsV39697('Kies type eten');
            renderFoodFilters();
          } else if(subpanel === 'discover'){
            clearStopMapPinsV39697('Kies type uitje');
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
  window.RoadoraRenderNowHelpFilters = renderNowHelpFilters;
  window.RoadoraCloseInstantPanel = closePanel;
})();

/* =========================================================
   Roadora v39.7.42 — router/nav public guard
   Houdt de bestaande router intact, maar maakt hem ook beschikbaar
   voor oudere kaart-handlers die window.RoadoraApp.openScreen zoeken.
   ========================================================= */
(function(){
  window.RoadoraApp = window.RoadoraApp || {};
  if (typeof openScreen === 'function') window.RoadoraApp.openScreen = openScreen;
  if (typeof renderAll === 'function') window.RoadoraApp.render = renderAll;
})();


/* Roadora v39.7.51 — map nav neutral state fix.
   Roadtrip mag niet standaard blijven branden op de kaart.
   Alleen Stops / Nu nodig / Meer krijgen active-state wanneer hun sheet open is.
   De Roadtrip-knop blijft een launcher naar Mijn Roadtrip en is dus op de kaart neutraal. */
(function(){
  if(window.__roadoraMapNavNeutralStateV39751) return;
  window.__roadoraMapNavNeutralStateV39751 = true;

  function panelFrom(btn){
    return (btn && btn.dataset && btn.dataset.mapPanel) || '';
  }

  function clearMapNavActive(){
    document.querySelectorAll('body > nav.rd-map-nav-v28 .rd-nav-btn-v28').forEach(function(btn){
      btn.classList.remove('is-active', 'active');
      btn.removeAttribute('aria-current');
    });
  }

  function sync(panel){
    panel = panel || document.body.getAttribute('data-map-panel') || '';

    // Roadtrip is not a sheet-tab anymore; it opens Mijn Roadtrip.
    // Therefore it should never stay highlighted on the map surface.
    if(panel === 'roadtrip') panel = '';

    if(panel){
      document.body.setAttribute('data-map-panel', panel);
    }else{
      document.body.removeAttribute('data-map-panel');
    }

    document.querySelectorAll('body > nav.rd-map-nav-v28 .rd-nav-btn-v28').forEach(function(btn){
      const btnPanel = panelFrom(btn);
      const active = !!panel && btnPanel === panel && btnPanel !== 'roadtrip';
      btn.classList.toggle('is-active', active);
      btn.classList.remove('active');
      if(active) btn.setAttribute('aria-current','page');
      else btn.removeAttribute('aria-current');
    });
  }

  document.addEventListener('click', function(e){
    const btn = e.target.closest('body > nav.rd-map-nav-v28 .rd-nav-btn-v28');
    if(!btn) return;
    const panel = panelFrom(btn);
    setTimeout(function(){ sync(panel); }, 0);
    setTimeout(function(){ sync(panel); }, 80);
  }, true);

  document.addEventListener('DOMContentLoaded', function(){ clearMapNavActive(); });
  window.addEventListener('roadora:map-nav-sync', function(e){ sync(e.detail && e.detail.panel); });
  window.RoadoraMapNavSyncV39751 = sync;
})();

/* =========================================================
   Roadora v39.7.56 — Hotels compare toggle
   Scope: Mijn Roadtrip > Hotels only. No map/ORS/sheet logic touched.
   ========================================================= */
(function(){
  if(window.__roadoraSavedHotelsCompareV39756) return;
  window.__roadoraSavedHotelsCompareV39756 = true;

  function updateCompareBar(){
    var selected = document.querySelectorAll('[data-roadtrip-state="saved-hotels"] [data-saved-hotel-card].is-compare-selected-v39756');
    var bar = document.querySelector('.saved-hotels-comparebar-v39756');
    var count = document.getElementById('savedHotelCompareCount');
    var action = document.getElementById('savedHotelCompareAction');
    var amount = selected.length;
    if(count) count.textContent = String(amount);
    if(action) action.textContent = 'Vergelijk ' + amount + ' hotels';
    if(bar) bar.hidden = amount < 2;
  }

  document.addEventListener('click', function(event){
    var compare = event.target.closest && event.target.closest('[data-hotel-compare]');
    if(compare){
      var hotelsState = compare.closest('[data-roadtrip-state="saved-hotels"]');
      if(!hotelsState) return;
      event.preventDefault();
      var card = compare.closest('[data-saved-hotel-card]');
      if(!card) return;
      var active = !card.classList.contains('is-compare-selected-v39756');
      card.classList.toggle('is-compare-selected-v39756', active);
      compare.setAttribute('aria-pressed', String(active));
      updateCompareBar();
      return;
    }

    var compareAction = event.target.closest && event.target.closest('#savedHotelCompareAction');
    if(compareAction){
      event.preventDefault();
      var amount = document.querySelectorAll('[data-roadtrip-state="saved-hotels"] [data-saved-hotel-card].is-compare-selected-v39756').length;
      if(window.showToast) window.showToast('Vergelijking met ' + amount + ' hotels komt in de volgende stap');
    }
  });

  window.RoadoraSavedHotelsCompareV39756 = { update: updateCompareBar };
})();


/* =========================================================
   Roadora v39.7.64 — Saved Eten & Uitjes component reuse
   Scope: Mijn Roadtrip saved content states only. No map/ORS/sheet logic touched.
   ========================================================= */
(function(){
  if(window.__roadoraSavedFoodDiscoverV39764) return;
  window.__roadoraSavedFoodDiscoverV39764 = true;

  function getStateName(state){
    if(!state) return 'plekken';
    if(state.dataset.roadtripState === 'saved-food') return 'plekken';
    if(state.dataset.roadtripState === 'saved-discover') return 'uitjes';
    return 'items';
  }

  function updateCompareBar(state){
    if(!state) return;
    var selected = state.querySelectorAll('[data-saved-content-card].is-compare-selected-v39756');
    var bar = state.querySelector('.saved-content-comparebar-v39764');
    var count = state.querySelector('[data-saved-content-count]');
    var action = state.querySelector('[data-saved-content-compare-action]');
    var amount = selected.length;
    if(count) count.textContent = String(amount);
    if(action) action.textContent = 'Vergelijk ' + amount + ' ' + getStateName(state);
    if(bar) bar.hidden = amount < 2;
  }

  document.addEventListener('click', function(event){
    var compare = event.target.closest && event.target.closest('[data-saved-place-compare]');
    if(compare){
      var state = compare.closest('[data-roadtrip-state="saved-food"], [data-roadtrip-state="saved-discover"]');
      if(!state) return;
      event.preventDefault();
      var card = compare.closest('[data-saved-content-card]');
      if(!card) return;
      var active = !card.classList.contains('is-compare-selected-v39756');
      card.classList.toggle('is-compare-selected-v39756', active);
      compare.setAttribute('aria-pressed', String(active));
      updateCompareBar(state);
      return;
    }

    var add = event.target.closest && event.target.closest('[data-saved-place-add-route]');
    if(add){
      event.preventDefault();
      add.classList.add('is-added-v39763');
      add.textContent = 'Toegevoegd';
      var state = add.closest('[data-roadtrip-state]');
      var label = state && state.dataset.roadtripState === 'saved-discover' ? 'Uitje' : 'Plek';
      if(window.showToast) window.showToast(label + ' klaar om toe te voegen aan je route');
      return;
    }

    var action = event.target.closest && event.target.closest('[data-saved-content-compare-action]');
    if(action){
      event.preventDefault();
      var state = action.closest('[data-roadtrip-state="saved-food"], [data-roadtrip-state="saved-discover"]');
      var amount = state ? state.querySelectorAll('[data-saved-content-card].is-compare-selected-v39756').length : 0;
      if(window.showToast) window.showToast('Vergelijking met ' + amount + ' ' + getStateName(state) + ' komt in de volgende stap');
    }
  });
})();

/* =========================================================
   Roadora v39.7.66 — Hotel Actions Phase 2
   Scope: route-stop state only. No ORS/Maps/export recalculation yet.
   Adds a persistent "Toegevoegd aan route" state for Hotels, Eten and Uitjes.
   ========================================================= */
(function(){
  if(window.__roadoraRouteStopStateV39766) return;
  window.__roadoraRouteStopStateV39766 = true;

  var STORAGE_KEY = 'roadora_route_stops_v39766';

  function readStops(){
    try{
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    }catch(_){
      return [];
    }
  }

  function writeStops(stops){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(stops || [])); }catch(_){ }
  }

  function toast(message){
    if(typeof window.showToast === 'function'){
      window.showToast(message);
      return;
    }
    try{
      var t = document.getElementById('toast') || document.getElementById('mapToast');
      if(!t) return;
      t.textContent = message;
      t.classList.add('show');
      clearTimeout(toast.timer);
      toast.timer = setTimeout(function(){ t.classList.remove('show'); }, 1700);
    }catch(_){ }
  }

  function slug(value){
    return String(value || 'stop')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'stop';
  }

  function typeLabel(type){
    if(type === 'hotel') return 'Hotel';
    if(type === 'food') return 'Eetplek';
    if(type === 'discover') return 'Uitje';
    return 'Stop';
  }

  function getCardData(button){
    var card = button && button.closest && button.closest('[data-saved-hotel-card], [data-saved-content-card]');
    if(!card) return null;
    var titleEl = card.querySelector('h3');
    var metaEl = card.querySelector('.hotel-title-row-v39754 p');
    var name = card.dataset.routeStopName || (titleEl && titleEl.textContent.trim()) || 'Stop';
    var type = card.dataset.routeStopType || (card.closest('[data-roadtrip-state="saved-hotels"]') ? 'hotel' : (card.closest('[data-roadtrip-state="saved-food"]') ? 'food' : 'discover'));
    return {
      id: card.dataset.routeStopId || (type + '-' + slug(name)),
      type: type,
      name: name,
      meta: metaEl ? metaEl.textContent.trim() : '',
      source: 'saved-content',
      status: 'in_route',
      addedAt: new Date().toISOString()
    };
  }

  function getPreviewData(button){
    var pop = button && button.closest && button.closest('.rd-hotel-preview-popover-v39644');
    if(!pop) return null;
    var titleEl = pop.querySelector('.rd-hotel-preview-title-v39644');
    var metaEl = pop.querySelector('.rd-hotel-preview-meta-v39644');
    var name = (titleEl && titleEl.textContent.trim()) || 'Hotel';
    return {
      id: 'hotel-' + slug(name),
      type: 'hotel',
      name: name,
      meta: metaEl ? metaEl.textContent.trim() : '',
      source: 'map-preview',
      status: 'in_route',
      addedAt: new Date().toISOString()
    };
  }

  function hasStop(id){
    return readStops().some(function(stop){ return stop && stop.id === id; });
  }

  function addStop(stop){
    if(!stop || !stop.id) return false;
    var stops = readStops();
    var existing = stops.findIndex(function(item){ return item && item.id === stop.id; });
    if(existing >= 0){
      stops[existing] = Object.assign({}, stops[existing], stop, { status:'in_route', updatedAt:new Date().toISOString() });
    }else{
      stops.push(stop);
    }
    writeStops(stops);
    try{
      window.RoadoraState = window.RoadoraState || {};
      window.RoadoraState.routeStops = stops;
    }catch(_){ }
    return true;
  }

  // Roadora v39.7.68 — complete route state toggle.
  // Removing from route only updates the local route-stop state; ORS/Maps export
  // are still intentionally untouched until the next integration phase.
  function removeStop(id){
    if(!id) return false;
    var before = readStops();
    var after = before.filter(function(item){ return item && item.id !== id; });
    writeStops(after);
    try{
      window.RoadoraState = window.RoadoraState || {};
      window.RoadoraState.routeStops = after;
    }catch(_){ }
    return after.length !== before.length;
  }

  function markButton(button, added){
    if(!button) return;
    button.classList.toggle('is-added-v39763', !!added);
    button.classList.toggle('is-in-route-v39766', !!added);
    button.setAttribute('aria-pressed', String(!!added));
    button.textContent = added ? '✓ In route' : 'Toevoegen';
  }

  function markCard(card, added){
    if(!card) return;
    card.classList.toggle('is-in-route-v39766', !!added);
    var badge = card.querySelector('.route-added-badge-v39766');
    if(added && !badge){
      var title = card.querySelector('.hotel-title-row-v39754');
      if(title){
        badge = document.createElement('span');
        badge.className = 'route-added-badge-v39766';
        badge.textContent = 'In route';
        title.appendChild(badge);
      }
    }
    if(!added && badge) badge.remove();
  }

  function syncSavedButtons(){
    document.querySelectorAll('[data-hotel-add-route], [data-saved-place-add-route]').forEach(function(button){
      var data = getCardData(button);
      var added = data ? hasStop(data.id) : false;
      markButton(button, added);
      var card = button.closest('[data-saved-hotel-card], [data-saved-content-card]');
      markCard(card, added);
    });
  }

  function handleAdd(button, getDataFn){
    var data = getDataFn(button);
    if(!data) return;
    var alreadyAdded = hasStop(data.id);
    if(alreadyAdded){
      removeStop(data.id);
      markButton(button, false);
      var removedCard = button.closest && button.closest('[data-saved-hotel-card], [data-saved-content-card]');
      if(removedCard) markCard(removedCard, false);
      toast(typeLabel(data.type) + ' verwijderd uit je route');
      window.dispatchEvent(new CustomEvent('roadora:route-stops-updated', { detail:{ stops: readStops(), removed:data } }));
      syncSavedButtons();
      return;
    }
    addStop(data);
    markButton(button, true);
    var card = button.closest && button.closest('[data-saved-hotel-card], [data-saved-content-card]');
    if(card) markCard(card, true);
    toast(typeLabel(data.type) + ' toegevoegd aan je route');
    window.dispatchEvent(new CustomEvent('roadora:route-stops-updated', { detail:{ stops: readStops(), added:data } }));
    syncSavedButtons();
  }

  document.addEventListener('click', function(event){
    var savedAdd = event.target.closest && event.target.closest('[data-hotel-add-route], [data-saved-place-add-route]');
    if(savedAdd){
      event.preventDefault();
      handleAdd(savedAdd, getCardData);
      return;
    }

    var previewAdd = event.target.closest && event.target.closest('.rd-hotel-preview-add-v39763');
    if(previewAdd){
      event.preventDefault();
      handleAdd(previewAdd, getPreviewData);
      return;
    }
  });

  document.addEventListener('DOMContentLoaded', syncSavedButtons);
  window.addEventListener('storage', function(e){ if(e && e.key === STORAGE_KEY) syncSavedButtons(); });
  window.addEventListener('roadora:route-stops-updated', syncSavedButtons);

  window.RoadoraRouteStopsV39766 = {
    all: readStops,
    add: addStop,
    remove: removeStop,
    has: hasStop,
    sync: syncSavedButtons,
    key: STORAGE_KEY
  };

  syncSavedButtons();
})();



/* =========================================================
   Roadora v39.7.69 — Hotel Add Handler Sync
   Scope: fix saved Hotels so they use the same route-stop state as Eten/Uitjes.
   No ORS/Maps/export recalculation yet.
   ========================================================= */
(function(){
  if(window.__roadoraHotelAddHandlerSyncV39769) return;
  window.__roadoraHotelAddHandlerSyncV39769 = true;

  function slug(value){
    return String(value || 'hotel')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'hotel';
  }

  function normalizeHotelCards(){
    document.querySelectorAll('[data-roadtrip-state="saved-hotels"] [data-saved-hotel-card]').forEach(function(card){
      var title = card.querySelector('h3');
      var name = (card.dataset.routeStopName || (title && title.textContent.trim()) || 'Hotel').trim();
      if(!card.dataset.routeStopType) card.dataset.routeStopType = 'hotel';
      if(!card.dataset.routeStopName) card.dataset.routeStopName = name;
      if(!card.dataset.routeStopId) card.dataset.routeStopId = 'hotel-' + slug(name);

      var button = card.querySelector('[data-hotel-add-route]');
      if(button){
        button.dataset.routeStopId = card.dataset.routeStopId;
        button.dataset.routeStopType = 'hotel';
      }
    });
  }

  function sync(){
    normalizeHotelCards();
    if(window.RoadoraRouteStopsV39766 && typeof window.RoadoraRouteStopsV39766.sync === 'function'){
      window.RoadoraRouteStopsV39766.sync();
    }
    if(window.RoadoraTrajectenV39767 && typeof window.RoadoraTrajectenV39767.render === 'function'){
      window.RoadoraTrajectenV39767.render();
    }
  }

  document.addEventListener('DOMContentLoaded', sync);
  window.addEventListener('roadora:route-stops-updated', sync);
  document.addEventListener('click', function(event){
    if(event.target.closest && event.target.closest('[data-roadtrip-entry="saved-hotels"], [data-saved-stop-category="hotels"], [data-hotel-add-route]')){
      setTimeout(sync, 0);
      setTimeout(sync, 120);
    }
  }, true);

  sync();
})();

/* =========================================================
   Roadora v39.7.67 — Trajecten v1
   Scope: reads route-stop state from v39.7.66 and renders a clean timeline.
   No ORS/Maps/export recalculation yet.
   ========================================================= */
(function(){
  if(window.__roadoraTrajectenV39767) return;
  window.__roadoraTrajectenV39767 = true;

  function readStops(){
    try{
      if(window.RoadoraRouteStopsV39766 && typeof window.RoadoraRouteStopsV39766.all === 'function'){
        var apiStops = window.RoadoraRouteStopsV39766.all();
        if(Array.isArray(apiStops)) return apiStops;
      }
      var raw = JSON.parse(localStorage.getItem('roadora_route_stops_v39766') || '[]');
      return Array.isArray(raw) ? raw : [];
    }catch(_){ return []; }
  }

  function routeState(){
    try{ return (window.RoadoraState && window.RoadoraState.route) || {}; }catch(_){ return {}; }
  }

  function typeMeta(type){
    if(type === 'hotel') return { icon:'☾', label:'Overnachting' };
    if(type === 'food') return { icon:'🍴', label:'Eten' };
    if(type === 'discover') return { icon:'◎', label:'Uitje' };
    return { icon:'⌁', label:'Stop' };
  }

  function escapeText(value){
    return String(value || '').replace(/[&<>"]/g, function(ch){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[ch];
    });
  }

  function renderTrajecten(){
    var list = document.getElementById('routesListV39767');
    var empty = document.getElementById('routesEmptyV39767');
    var timeline = document.getElementById('routesTimelineV39767');
    var stopsWrap = document.getElementById('routesStopsV39767');
    if(!list || !empty || !timeline || !stopsWrap) return;

    var stops = readStops().filter(function(stop){ return stop && stop.status === 'in_route'; });
    var route = routeState();
    var start = document.getElementById('routesStartV39767');
    var end = document.getElementById('routesEndV39767');
    if(start) start.textContent = route.start || 'Vertrekpunt';
    if(end) end.textContent = route.end || 'Bestemming';

    empty.hidden = stops.length > 0;
    timeline.hidden = stops.length === 0;

    stopsWrap.innerHTML = stops.map(function(stop, index){
      var meta = typeMeta(stop.type);
      return '<article class="route-stop-card-v39767 route-stop-card-v39771" data-route-stop-id="' + escapeText(stop.id) + '">' +
        '<span class="route-stop-icon-v39767">' + meta.icon + '</span>' +
        '<div class="route-stop-copy-v39767">' +
          '<small>' + meta.label + ' ' + (index + 1) + '</small>' +
          '<strong>' + escapeText(stop.name || 'Stop') + '</strong>' +
          '<p>' + escapeText(stop.meta || 'Toegevoegd aan je route') + '</p>' +
        '</div>' +
        '<div class="route-stop-actions-v39771">' +
          '<em>In route</em>' +
          '<button class="route-stop-remove-v39771" type="button" data-route-stop-remove="' + escapeText(stop.id) + '" aria-label="Verwijder uit traject">Verwijder</button>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function toastV39771(message){
    if(typeof window.showToast === 'function'){ window.showToast(message); return; }
    try{
      var t = document.getElementById('toast') || document.getElementById('mapToast');
      if(!t) return;
      t.textContent = message;
      t.classList.add('show');
      clearTimeout(toastV39771.timer);
      toastV39771.timer = setTimeout(function(){ t.classList.remove('show'); }, 1700);
    }catch(_){ }
  }

  document.addEventListener('click', function(event){
    var removeBtn = event.target.closest && event.target.closest('[data-route-stop-remove]');
    if(removeBtn){
      event.preventDefault();
      var id = removeBtn.dataset.routeStopRemove;
      if(id && window.RoadoraRouteStopsV39766 && typeof window.RoadoraRouteStopsV39766.remove === 'function'){
        window.RoadoraRouteStopsV39766.remove(id);
        renderTrajecten();
        if(typeof window.RoadoraRouteStopsV39766.sync === 'function') window.RoadoraRouteStopsV39766.sync();
        window.dispatchEvent(new CustomEvent('roadora:route-stops-updated', { detail:{ stops: readStops(), removedId:id, source:'trajecten' } }));
        toastV39771('Stop verwijderd uit je traject');
      }
      return;
    }

    var cta = event.target.closest && event.target.closest('.routes-empty-cta-v39767');
    if(!cta) return;
    event.preventDefault();
    try{
      if(window.RoadoraRouter && typeof window.RoadoraRouter.open === 'function'){
        window.RoadoraRouter.open('roadtrip');
        setTimeout(function(){
          var btn = document.querySelector('[data-roadtrip-entry="saved-stops"]');
          if(btn) btn.click();
        }, 80);
      }
    }catch(_){ }
  });

  window.addEventListener('roadora:route-stops-updated', renderTrajecten);
  window.addEventListener('storage', function(e){ if(e && e.key === 'roadora_route_stops_v39766') renderTrajecten(); });
  document.addEventListener('DOMContentLoaded', renderTrajecten);
  document.addEventListener('click', function(event){
    if(event.target.closest && event.target.closest('[data-screen-target="routes"]')){
      setTimeout(renderTrajecten, 120);
    }
  });

  window.RoadoraTrajectenV39767 = { render: renderTrajecten };
  renderTrajecten();
})();


/* =========================================================
   Roadora v39.7.72 — Trajecten Premium Timeline
   Scope: visual timeline + stats based on existing route-stop state.
   No ORS/Maps/export recalculation.
   ========================================================= */
(function(){
  if(window.__roadoraTrajectenPremiumV39772) return;
  window.__roadoraTrajectenPremiumV39772 = true;

  function readStops(){
    try{
      if(window.RoadoraRouteStopsV39766 && typeof window.RoadoraRouteStopsV39766.all === 'function'){
        var apiStops = window.RoadoraRouteStopsV39766.all();
        if(Array.isArray(apiStops)) return apiStops.filter(function(stop){ return stop && stop.status === 'in_route'; });
      }
      var raw = JSON.parse(localStorage.getItem('roadora_route_stops_v39766') || '[]');
      return Array.isArray(raw) ? raw.filter(function(stop){ return stop && stop.status === 'in_route'; }) : [];
    }catch(_){ return []; }
  }

  function routeState(){
    try{ return (window.RoadoraState && window.RoadoraState.route) || {}; }catch(_){ return {}; }
  }

  function escapeText(value){
    return String(value || '').replace(/[&<>\"]/g, function(ch){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'})[ch];
    });
  }

  function typeMeta(type){
    if(type === 'hotel') return { icon:'☾', label:'Overnachting', className:'is-hotel' };
    if(type === 'food') return { icon:'🍴', label:'Eten', className:'is-food' };
    if(type === 'discover') return { icon:'◎', label:'Uitje', className:'is-discover' };
    return { icon:'⌁', label:'Stop', className:'is-stop' };
  }

  function fmtKmMeters(meters){
    var km = Math.round((Number(meters) || 0) / 1000);
    return km ? km.toLocaleString('nl-NL') + ' km' : '— km';
  }

  function fmtDuration(seconds){
    seconds = Number(seconds) || 0;
    if(!seconds) return '—';
    var h = Math.floor(seconds / 3600);
    var m = Math.round((seconds % 3600) / 60);
    if(m === 60){ h += 1; m = 0; }
    return h ? (h + 'u ' + String(m).padStart(2,'0') + 'm') : (m + ' min');
  }

  function fallbackTotal(stops){
    var count = Math.max(1, stops.length + 1);
    return { distance: count * 145000, duration: count * 5400 };
  }

  function totals(stops){
    var summary = routeState().summary || null;
    if(summary && (Number(summary.distance) || Number(summary.duration))){
      return { distance:Number(summary.distance || 0), duration:Number(summary.duration || 0), source:'ors' };
    }
    var fb = fallbackTotal(stops);
    fb.source = 'preview';
    return fb;
  }

  function metricFor(index, stops, total){
    var fraction = (index + 1) / (stops.length + 1);
    var distance = Math.max(0, Math.round((Number(total.distance) || 0) * fraction));
    var duration = Math.max(0, Math.round((Number(total.duration) || 0) * fraction));
    return fmtKmMeters(distance) + ' vanaf start · ' + fmtDuration(duration) + ' rijden';
  }

  function ensureStatsCard(list){
    var stats = document.getElementById('routesStatsV39772');
    if(stats) return stats;
    stats = document.createElement('section');
    stats.className = 'routes-stats-v39772';
    stats.id = 'routesStatsV39772';
    stats.innerHTML = '<div><small>AFSTAND</small><strong id="routesStatsKmV39772">— km</strong></div>' +
      '<div><small>REISTIJD</small><strong id="routesStatsTimeV39772">—</strong></div>' +
      '<div><small>STOPS</small><strong id="routesStatsStopsV39772">0</strong></div>';
    var empty = document.getElementById('routesEmptyV39767');
    if(empty && empty.parentNode === list) list.insertBefore(stats, empty);
    else list.insertBefore(stats, list.firstChild);
    return stats;
  }

  function renderPremiumTrajecten(){
    var list = document.getElementById('routesListV39767');
    var empty = document.getElementById('routesEmptyV39767');
    var timeline = document.getElementById('routesTimelineV39767');
    var stopsWrap = document.getElementById('routesStopsV39767');
    if(!list || !empty || !timeline || !stopsWrap) return;

    var stops = readStops();
    var route = routeState();
    var start = document.getElementById('routesStartV39767');
    var end = document.getElementById('routesEndV39767');
    if(start) start.textContent = route.start || 'Vertrekpunt';
    if(end) end.textContent = route.end || 'Bestemming';

    list.classList.add('routes-premium-list-v39772');
    timeline.classList.add('routes-premium-timeline-v39772');
    var intro = list.querySelector('.routes-intro-card-v39767');
    if(intro) intro.hidden = true;

    var stats = ensureStatsCard(list);
    var total = totals(stops);
    var kmEl = document.getElementById('routesStatsKmV39772');
    var timeEl = document.getElementById('routesStatsTimeV39772');
    var stopsEl = document.getElementById('routesStatsStopsV39772');
    if(kmEl) kmEl.textContent = fmtKmMeters(total.distance);
    if(timeEl) timeEl.textContent = fmtDuration(total.duration);
    if(stopsEl) stopsEl.textContent = String(stops.length);
    if(stats) stats.hidden = stops.length === 0;

    empty.hidden = stops.length > 0;
    timeline.hidden = stops.length === 0;

    stopsWrap.innerHTML = stops.map(function(stop, index){
      var meta = typeMeta(stop.type);
      var metric = metricFor(index, stops, total);
      return '<article class="route-stop-card-v39767 route-stop-card-v39771 route-stop-card-v39772 ' + meta.className + '" data-route-stop-id="' + escapeText(stop.id) + '">' +
        '<span class="route-stop-icon-v39767 route-stop-icon-v39772">' + meta.icon + '</span>' +
        '<div class="route-stop-copy-v39767 route-stop-copy-v39772">' +
          '<small><em>' + meta.label + '</em><b>Stop ' + (index + 1) + '</b></small>' +
          '<strong>' + escapeText(stop.name || 'Stop') + '</strong>' +
          '<p>' + escapeText(metric) + '</p>' +
        '</div>' +
        '<div class="route-stop-actions-v39771 route-stop-actions-v39772">' +
          '<button class="route-stop-view-v39772" type="button" data-route-stop-view="' + escapeText(stop.id) + '">Bekijk</button>' +
          '<button class="route-stop-remove-v39771" type="button" data-route-stop-remove="' + escapeText(stop.id) + '" aria-label="Verwijder uit traject">Verwijder</button>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function schedule(){
    setTimeout(renderPremiumTrajecten, 0);
    setTimeout(renderPremiumTrajecten, 90);
  }

  document.addEventListener('DOMContentLoaded', schedule);
  window.addEventListener('roadora:route-stops-updated', schedule);
  window.addEventListener('storage', function(e){ if(e && e.key === 'roadora_route_stops_v39766') schedule(); });
  document.addEventListener('click', function(event){
    if(event.target.closest && event.target.closest('[data-screen-target="routes"]')) schedule();
    if(event.target.closest && event.target.closest('[data-route-stop-view]')){
      event.preventDefault();
      if(typeof window.showToast === 'function') window.showToast('Stopdetails komen in de volgende stap');
    }
  });

  window.RoadoraTrajectenPremiumV39772 = { render: renderPremiumTrajecten };
  schedule();
})();
