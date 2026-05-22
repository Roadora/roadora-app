/* Roadora Overzicht + Mijn Roadtrip Pixel Appstructuur v1 */

document.addEventListener("DOMContentLoaded", () => {
  const screens = document.querySelectorAll(".roadora-screen");
  const buttons = document.querySelectorAll(".bottom-nav-item");

  function showScreen(tab) {
    const targetExists = document.querySelector('.roadora-screen[data-screen="' + tab + '"]');

    screens.forEach(screen => {
      const active = screen.dataset.screen === tab;
      screen.classList.toggle("active", active);
      if(active) {
        screen.removeAttribute("hidden");
        try {
          screen.scrollTo({ top:0, behavior:"instant" });
        } catch(e) {
          window.scrollTo(0,0);
        }
      } else {
        screen.setAttribute("hidden", "");
      }
    });

    buttons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
  }

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;

      if(tab === "overview" || tab === "roadtrip") {
        showScreen(tab);
      } else {
        // andere tabs bouwen we later pixel voor pixel
        buttons.forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
      }
    });
  });

  // roadtrip-specifieke originele scripts
  try {
document.addEventListener('DOMContentLoaded', () => {

  const dayCards = document.querySelectorAll('.day-card');
  const overlay = document.getElementById('dayDetailOverlay');
  const closeBtn = document.getElementById('closeDayDetail');
  const detailKicker = document.getElementById('detailKicker');
  const detailTitle = document.getElementById('detailTitle');
  const detailSub = document.getElementById('detailSub');
  const routeScroll = document.getElementById('dayRouteScroll');
  const bekijkDagBtn = document.querySelector('.details-btn');

  const dayDetails = {
    1: ['Dag 1', 'Rotterdam → Frankfurt', '480 km · 5u 10m · 2 stops onderweg'],
    2: ['Dag 2', 'Frankfurt → Innsbruck', '460 km · 5u 30m · 2 stops onderweg'],
    3: ['Vandaag · Dag 3', 'Innsbruck → Gardameer', '320 km · 4u 15m · 2 stops onderweg'],
    4: ['Dag 4', 'Gardameer → Toscane', '410 km · 5u 20m · 3 stops onderweg'],
    5: ['Dag 5', 'Toscane → Rome', '280 km · 3u 45m · 1 stop onderweg'],
    6: ['Dag 6', 'Rome → Amalfi', '275 km · 3u 50m · 2 stops onderweg'],
    7: ['Dag 7', 'Rustdag Amalfi', '0 km · vrije dag · hotel blijft hetzelfde'],
    8: ['Dag 8', 'Amalfi → Florence', '520 km · 6u 10m · 3 stops onderweg'],
    9: ['Dag 9', 'Florence → Zwitserland', '610 km · 7u 05m · 3 stops onderweg'],
    10: ['Dag 10', 'Zwitserland → Rotterdam', '720 km · 8u 20m · 4 stops onderweg']
  };

  function openDayDetail(dayNumber){
    const detail = dayDetails[dayNumber] || dayDetails[3];

    detailKicker.textContent = detail[0];
    detailTitle.textContent = detail[1];
    detailSub.textContent = detail[2];

    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden','false');

    document.body.style.overflow = 'hidden';

    if(routeScroll){
      routeScroll.scrollTop = 0;
    }
  }

  function closeDayDetail(){
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
  }

  // Dagen scrollcards
  dayCards.forEach((card, index) => {
    card.addEventListener('click', () => {
      openDayDetail(index + 1);
    });
  });

  // Bekijk dag knop -> opent actieve dag
  if(bekijkDagBtn){
    bekijkDagBtn.addEventListener('click', () => {
      openDayDetail(3);
    });
  }

  if(closeBtn){
    closeBtn.addEventListener('click', closeDayDetail);
  }

  overlay.addEventListener('click', (event) => {
    if(event.target === overlay){
      closeDayDetail();
    }
  });

  document.addEventListener('keydown', (event) => {
    if(event.key === 'Escape'){
      closeDayDetail();
    }
  });
});
  } catch(error) {
    console.warn("Roadtrip script kon niet volledig starten:", error);
  }
});
