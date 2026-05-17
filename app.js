document.addEventListener('DOMContentLoaded', () => {
  const hero = document.querySelector('.hero');
  if(hero) hero.style.display = 'none';
  const ids = ['mapStatusTitle','mapStatusBadge','mapStatusSub','mapStatusEta','mapStatusDistance','mapStatusNext'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if(el) el.textContent = '';
  });
  const panels = document.querySelectorAll('.roadtripPanelEmptyV584, .hotelPlannerHero, .hotelPlannerResultCard');
  panels.forEach(p => p.innerHTML = '');
});