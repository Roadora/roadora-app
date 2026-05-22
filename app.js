/* Roadora router active fix v2 */

document.addEventListener("DOMContentLoaded", () => {
  const screens = Array.from(document.querySelectorAll(".rd-screen"));
  const buttons = Array.from(document.querySelectorAll(".bottom-nav-item"));

  function showScreen(tab){
    const target = screens.find(screen => screen.dataset.screen === tab);

    // Eerst ALLES resetten
    buttons.forEach(btn => {
      btn.classList.remove("active");
      btn.removeAttribute("aria-current");
    });

    screens.forEach(screen => {
      screen.classList.remove("active");
      screen.setAttribute("hidden", "");
    });

    // Dan alleen gevraagde knop actief
    const activeButton = buttons.find(btn => btn.dataset.tab === tab);
    if(activeButton){
      activeButton.classList.add("active");
      activeButton.setAttribute("aria-current", "page");
    }

    // Alleen scherm tonen als het bestaat
    if(target){
      target.removeAttribute("hidden");
      target.classList.add("active");
      window.scrollTo(0, 0);
    }
  }

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      showScreen(button.dataset.tab);
    });
  });

  // Start altijd schoon op Overzicht
  showScreen("overview");
});
