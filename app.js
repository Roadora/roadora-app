const RoadoraState = {
  activeScreen: 'overview',
  activeTrip: null
};
const screens = [...document.querySelectorAll('[data-screen]')];
const navItems = [...document.querySelectorAll('.nav-item')];
function openScreen(name){
  RoadoraState.activeScreen = name;
  screens.forEach(s => s.classList.toggle('is-active', s.dataset.screen === name));
  navItems.forEach(n => n.classList.toggle('active', n.dataset.screenTarget === mainTab(name)));
}
function mainTab(name){
  if(['hotels','diary','routes','routeplan','plan'].includes(name)) return 'roadtrip';
  return name;
}
document.addEventListener('click', (e)=>{
  const target = e.target.closest('[data-screen-target]');
  if(target){ openScreen(target.dataset.screenTarget); return; }
  const action = e.target.closest('[data-action]');
  if(action?.dataset.action === 'profile') openScreen('profile');
  if(action?.dataset.action === 'demoTrip') {
    RoadoraState.activeTrip = { title:'Je roadtrip', days:3, hotels:2 };
    openScreen('map');
  }
});
window.Roadora = { state: RoadoraState, openScreen };
