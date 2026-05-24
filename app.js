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
