/* Roadora appstructuur — Overzicht, Mijn Roadtrip, Kaart */

document.addEventListener("DOMContentLoaded", () => {
  const screens = document.querySelectorAll(".roadora-screen");
  const buttons = document.querySelectorAll(".bottom-nav-item");

  function showScreen(tab) {
    const target = document.querySelector('.roadora-screen[data-screen="' + tab + '"]');

    buttons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });

    if (!target) return;

    screens.forEach(screen => {
      const active = screen.dataset.screen === tab;
      screen.classList.toggle("active", active);

      if (active) {
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
  }

  buttons.forEach(button => {
    button.addEventListener("click", () => showScreen(button.dataset.tab));
  });
});
