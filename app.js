/* Roadora Overzicht + Mijn Roadtrip + Kaart Pixel Appstructuur v1 */

document.addEventListener("DOMContentLoaded", () => {
  const screens = document.querySelectorAll(".roadora-screen");
  const buttons = document.querySelectorAll(".bottom-nav-item");

  function showScreen(tab) {
    const targetExists = document.querySelector('.roadora-screen[data-screen="' + tab + '"]');

    if (!targetExists) {
      buttons.forEach(btn => btn.classList.remove("active"));
      const btn = document.querySelector('.bottom-nav-item[data-tab="' + tab + '"]');
      if (btn) btn.classList.add("active");
      return;
    }

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

    buttons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
  }

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      showScreen(button.dataset.tab);
    });
  });
});
