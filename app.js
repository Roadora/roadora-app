const DEMO_TRIP_ENABLED = false;

const RoadoraState = {
  activeScreen: 'overview',
  activeTrip: DEMO_TRIP_ENABLED ? {
    title: 'Noord-Spanje Roadtrip',
    meta: '12 dagen · 6 stops · 16 – 27 mei 2025'
  } : null
};

const app = document.querySelector('#app');
const screens = [...document.querySelectorAll('[data-screen]')];
const navButtons = [...document.querySelectorAll('.bottom-nav [data-screen-target]')];
const toast = document.querySelector('#toast');

function renderTripState(){
  app.dataset.trip = RoadoraState.activeTrip ? 'planned' : 'empty';
}

function openScreen(name){
  const target = screens.find(s => s.dataset.screen === name);
  if(!target) return;
  screens.forEach(screen => screen.classList.toggle('is-active', screen === target));
  navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.screenTarget === name));
  RoadoraState.activeScreen = name;
  try { localStorage.setItem('roadora_active_screen', name); } catch(e) {}
}

function showToast(message){
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1700);
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-screen-target]');
  if(target){
    event.preventDefault();
    openScreen(target.dataset.screenTarget);
    return;
  }
  const action = event.target.closest('[data-action]');
  if(action?.dataset.action === 'demo-trip'){
    RoadoraState.activeTrip = { title:'Noord-Spanje Roadtrip', meta:'12 dagen · 6 stops · 16 – 27 mei 2025' };
    renderTripState();
    showToast('Roadtrip gepland');
    openScreen('overview');
  }
});

renderTripState();
openScreen('overview');
window.RoadoraState = RoadoraState;
window.RoadoraRouter = { open: openScreen };


// ROADORA PREMIUM HERO MENU
document.addEventListener('DOMContentLoaded', () => {
  const menuBtn = document.getElementById('heroMenuBtn');
  const menuOverlay = document.getElementById('heroMenuOverlay');
  const menuClose = document.getElementById('heroMenuClose');

  if(menuBtn && menuOverlay){
    menuBtn.addEventListener('click', () => {
      menuOverlay.classList.add('open');
    });
  }

  if(menuClose && menuOverlay){
    menuClose.addEventListener('click', () => {
      menuOverlay.classList.remove('open');
    });
  }

  if(menuOverlay){
    menuOverlay.addEventListener('click', (e) => {
      if(e.target === menuOverlay){
        menuOverlay.classList.remove('open');
      }
    });
  }
});


// ROADORA MENU AUTO CLOSE ON MENU ITEM CLICK
document.addEventListener('DOMContentLoaded', () => {
  const menuOverlay = document.getElementById('heroMenuOverlay');
  const menuItems = document.querySelectorAll('.hero-menu-item, .hero-menu-nav button, .hero-menu-nav a');

  menuItems.forEach((item) => {
    item.addEventListener('click', () => {
      if (menuOverlay) {
        menuOverlay.classList.remove('open');
      }
    });
  });
});


// ROADORA ROUTEPLAN NAVIGATION SAFE
document.addEventListener('DOMContentLoaded', () => {
  const screens = document.querySelectorAll('.screen');
  const navButtons = document.querySelectorAll('[data-screen-target]');

  function showScreen(target){
    const screen = document.querySelector(`[data-screen="${target}"]`);
    if(!screen) return;

    screens.forEach((item) => item.classList.remove('is-active'));
    screen.classList.add('is-active');

    document.querySelectorAll('.bottom-nav button').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-screen-target') === target);
    });

    const menuOverlay = document.getElementById('heroMenuOverlay');
    if(menuOverlay) menuOverlay.classList.remove('open');

    window.scrollTo({ top:0, behavior:'smooth' });
  }

  navButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      const target = button.getAttribute('data-screen-target');
      if(!target) return;
      event.preventDefault();
      showScreen(target);
    });
  });
});
