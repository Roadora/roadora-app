/* Roadora router active fix v3 */

document.addEventListener("DOMContentLoaded", () => {
  const screens = Array.from(document.querySelectorAll(".rd-screen"));
  const buttons = Array.from(document.querySelectorAll(".bottom-nav-item"));

  function showScreen(tab){
    const target = screens.find(screen => screen.dataset.screen === tab);

    buttons.forEach(btn => {
      const isActive = btn.dataset.tab === tab;
      btn.classList.toggle("active", isActive);
      if(isActive){
        btn.setAttribute("aria-current", "page");
      }else{
        btn.removeAttribute("aria-current");
      }
    });

    if(!target) return;

    screens.forEach(screen => {
      const isActive = screen === target;
      screen.classList.toggle("active", isActive);

      if(isActive){
        screen.removeAttribute("hidden");
      }else{
        screen.setAttribute("hidden", "");
      }
    });

    window.scrollTo(0, 0);
  }

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      showScreen(button.dataset.tab);
    });
  });

  // Belangrijk: start zichtbaar op Overzicht
  showScreen("overview");
});
