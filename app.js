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

  function categoryPinIcon(category){
    const meta = CATEGORY_PIN_META[category] || CATEGORY_PIN_META.hotels;
    return L.divIcon({
      className: `rdCategoryPin rdCategoryPin-${category}`,
      html: `<span>${meta.icon}</span>`,
      iconSize: [34,34],
      iconAnchor: [17,17],
      popupAnchor: [0,-16]
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
    return category === 'hotels' ? [0.20, 0.34, 0.50, 0.66, 0.80] : [0.28, 0.50, 0.72];
  }

  function getCategoryPreviewCoord(category, index){
    const positions = getCategoryPreviewPositions(category);
    const safeIndex = Math.max(0, Math.min(positions.length - 1, Number(index) || 0));
    const base = routePointAt(positions[safeIndex]);
    if(!base) return null;
    return offsetCoord(base, safeIndex);
  }

  function focusSelectedHotelOnMap(index){
    if(!map || !window.L || !routeCoordinates.length) return;
    const coord = getCategoryPreviewCoord('hotels', index);
    if(!coord) return;
    const target = latLng(coord);
    const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : 6;
    const targetZoom = Math.max(currentZoom || 0, 7);
    try{
      map.setView(target, Math.min(targetZoom, 8), { animate:true, duration:.45 });
      // Keep the selected hotel visually above the fixed sheet/popover on mobile.
      window.setTimeout(function(){
        try{ map.panBy([0, 88], { animate:true, duration:.25 }); }catch(_){ }
      }, 260);
    }catch(_){ }
  }

  function renderCategoryPins(category){
    if(!map || !window.L) return;
    if(!categoryLayer) categoryLayer = L.layerGroup().addTo(map);
    categoryLayer.clearLayers();

    if(!routeCoordinates.length){
      showMapToast('Plan eerst een route');
      return;
    }

    const meta = CATEGORY_PIN_META[category] || CATEGORY_PIN_META.hotels;
    const positions = getCategoryPreviewPositions(category);
    const created = [];

    positions.forEach((p, i)=>{
      const base = routePointAt(p);
      if(!base) return;

      const coord = offsetCoord(base, i);
      const name = meta.items[i] || meta.label;
      const marker = L.marker(latLng(coord), { icon: categoryPinIcon(category), riseOnHover:true });
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

  function renderStops(){
    const container = findStopsContainer();
    if(!container) return;
    document.body.removeAttribute('data-stop-subpanel');
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

  function closeHotelPreview(){
    document.body.removeAttribute('data-hotel-preview');
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
      renderStops();
      setTimeout(renderStops, 50);
    }
  }

  function closePanel(){
    document.body.removeAttribute("data-map-drawer");
    document.body.removeAttribute("data-instant-map-panel");
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
    const category = card.getAttribute("data-category");
    document.body.setAttribute("data-active-stop-category", category);
    document.querySelectorAll(".rd-render-stop-card-v39619").forEach(function(item){
      item.classList.toggle("is-active", item === card);
    });
    window.dispatchEvent(new CustomEvent("roadora:stop-category-change", { detail:{ category:category } }));
    if(category === 'hotels'){
      renderHotelStrip();
    }else{
      document.body.removeAttribute('data-stop-subpanel');
    }
  }, true);

  document.addEventListener("click", function(e){
    const close = e.target.closest && e.target.closest(".rd-hotel-preview-close-v39644");
    if(close){
      e.preventDefault();
      e.stopPropagation();
      closeHotelPreview();
      return;
    }

    const hotel = e.target.closest && e.target.closest(".rd-hotel-card-v39636");
    if(!hotel) return;
    e.preventDefault();
    e.stopPropagation();
    const index = parseInt(hotel.getAttribute('data-hotel-index') || '0', 10) || 0;
    document.querySelectorAll(".rd-hotel-card-v39636").forEach(function(item){
      item.classList.toggle("is-active", item === hotel);
    });
    renderHotelPreview(index);
    if(window.RoadoraApp && typeof window.RoadoraApp.renderCategoryPins === 'function'){
      window.RoadoraApp.renderCategoryPins('hotels');
    }
    window.setTimeout(function(){ focusSelectedHotelOnMap(index); }, 120);
  }, true);


  /* v39.6.39 — robust Android swipe-back on the visible sheet handle.
     Fix: v39.6.38 listened to the drawer top-zone, but Android/browser scrolling and the
     tiny 5px handle could cancel pointermove before the threshold. This version binds to
     the real grab handle, enlarges the logical hit-zone, adds touch fallback, and prevents
     only vertical handle drags. Hotel horizontal scrolling remains untouched. */
  (function bindHotelsSwipeBackV39639(){
    if(window.__roadoraHotelsSwipeBackV39639) return;
    window.__roadoraHotelsSwipeBackV39639 = true;

    let startX = 0;
    let startY = 0;
    let tracking = false;
    const SWIPE_DOWN = 30;
    const MAX_SIDE_DRIFT = 58;

    function isHotelsState(){
      return document.body.getAttribute('data-stop-subpanel') === 'hotels';
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
      if(!isHotelsState()) return;
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
        renderStops();
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
  window.RoadoraCloseInstantPanel = closePanel;
})();
