/* Roadora component system router v1 */

document.addEventListener("DOMContentLoaded", () => {
  const screens = Array.from(document.querySelectorAll(".rd-screen"));
  const buttons = Array.from(document.querySelectorAll(".bottom-nav-item"));

  function showScreen(tab){
    const target = screens.find(screen => screen.dataset.screen === tab);
    if(!target) return;

    screens.forEach(screen => {
      const active = screen === target;
      screen.classList.toggle("active", active);

      if(active){
        screen.removeAttribute("hidden");
      }else{
        screen.setAttribute("hidden", "");
      }
    });

    buttons.forEach(button => {
      const active = button.dataset.tab === tab;
      button.classList.toggle("active", active);
      if(active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });

    window.scrollTo(0, 0);
  }

  buttons.forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      showScreen(button.dataset.tab);
    });
  });

  showScreen("overview");
});
