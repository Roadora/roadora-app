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


// ROADORA HAMBURGER MENU
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('menuToggle');
  const menu = document.getElementById('sideMenu');
  const closeBtn = document.getElementById('menuClose');

  if(toggle && menu){
    toggle.addEventListener('click', () => {
      menu.classList.add('open');
    });
  }

  if(closeBtn && menu){
    closeBtn.addEventListener('click', () => {
      menu.classList.remove('open');
    });
  }

  if(menu){
    menu.addEventListener('click', (e) => {
      if(e.target === menu){
        menu.classList.remove('open');
      }
    });
  }
});


// ROADORA LANGUAGE MENU
document.addEventListener('DOMContentLoaded', () => {
  const langToggle = document.getElementById('languageToggle');
  const langMenu = document.getElementById('languageMenu');

  if(langToggle && langMenu){
    langToggle.addEventListener('click', () => {
      langMenu.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if(!langMenu.contains(e.target) && !langToggle.contains(e.target)){
        langMenu.classList.remove('open');
      }
    });
  }
});
