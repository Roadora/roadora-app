/* Roadora router fix v4 */

document.addEventListener("DOMContentLoaded", () => {
  const screens = Array.from(document.querySelectorAll(".rd-screen"));
  const buttons = Array.from(document.querySelectorAll(".bottom-nav-item"));

  function showScreen(tab){
    const target = screens.find(screen => screen.dataset.screen === tab);

    // Alleen schakelen als het scherm echt bestaat.
    // Kaart/Dagboek/Profiel bouwen we later.
    if(!target){
      return;
    }

    screens.forEach(screen => {
      const active = screen.dataset.screen === tab;
      screen.classList.toggle("active", active);

      if(active){
        screen.removeAttribute("hidden");
      }else{
        screen.setAttribute("hidden", "");
      }
    });

    buttons.forEach(btn => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle("active", active);

      if(active){
        btn.setAttribute("aria-current", "page");
      }else{
        btn.removeAttribute("aria-current");
      }
    });

    window.scrollTo(0, 0);
  }

  buttons.forEach(button => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      showScreen(button.dataset.tab);
    });
  });

  showScreen("overview");
});
