/* =========================================================
   ROADORA FUTURE PROOF SHELL V1
   Centrale router + state voor tabs zonder iframes.
   ========================================================= */

(function(){
  "use strict";

  const Roadora = {
    state: {
      activeScreen: "overview",
      route: null,
      selectedDay: null,
      selectedStop: null,
      savedHotels: [],
      memories: [],
      profile: {}
    },

    screens: {},
    navItems: {},

    init(){
      this.root = document.getElementById("roadoraAppRoot") || document.querySelector(".shell");
      this.screenNodes = Array.from(document.querySelectorAll("[data-roadora-screen]"));
      this.navNodes = Array.from(document.querySelectorAll("[data-tab].bottom-nav-item"));

      this.screenNodes.forEach(screen => {
        this.screens[screen.dataset.screen] = screen;
      });

      this.navNodes.forEach(button => {
        this.navItems[button.dataset.tab] = button;
        button.addEventListener("click", () => this.navigate(button.dataset.tab));
      });

      const initial = this.getScreenFromHash() || this.root?.dataset.activeScreen || "overview";
      this.navigate(initial, { replaceHash:false, animate:false });
      this.bindInternalActions();

      window.RoadoraApp = this;
    },

    getScreenFromHash(){
      const hash = window.location.hash.replace("#", "").trim();
      return this.screens[hash] ? hash : null;
    },

    navigate(screenName, options = {}){
      const { replaceHash = true, animate = true } = options;

      if(!this.screens[screenName]) screenName = "overview";

      this.state.activeScreen = screenName;

      if(this.root) this.root.dataset.activeScreen = screenName;

      this.screenNodes.forEach(screen => {
        const active = screen.dataset.screen === screenName;
        screen.classList.toggle("active", active);
        screen.classList.remove("is-entering");

        if(active){
          screen.setAttribute("aria-hidden", "false");
          if(animate) requestAnimationFrame(() => screen.classList.add("is-entering"));
          try{ screen.scrollTo({ top:0, behavior:"instant" }); }
          catch(e){ screen.scrollTop = 0; }
        }else{
          screen.setAttribute("aria-hidden", "true");
        }
      });

      this.navNodes.forEach(button => {
        const active = button.dataset.tab === screenName;
        button.classList.toggle("active", active);
        if(active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      });

      if(replaceHash) history.replaceState(null, "", "#" + screenName);

      this.emit("screenchange", { screen:screenName });
    },

    bindInternalActions(){
      document.addEventListener("click", event => {
        const action = event.target.closest("[data-roadora-action]");
        if(!action) return;

        const name = action.dataset.roadoraAction;
        const map = {
          "open-map":"kaart",
          "open-roadtrip":"roadtrip",
          "open-journal":"dagboek",
          "open-profile":"profiel",
          "open-overview":"overview"
        };

        if(map[name]){
          event.preventDefault();
          this.navigate(map[name]);
        }
      });

      window.addEventListener("hashchange", () => {
        const hashScreen = this.getScreenFromHash();
        if(hashScreen && hashScreen !== this.state.activeScreen){
          this.navigate(hashScreen, { replaceHash:false });
        }
      });
    },

    setState(partial){
      this.state = { ...this.state, ...partial };
      this.emit("statechange", this.state);
    },

    emit(name, detail){
      document.dispatchEvent(new CustomEvent("roadora:" + name, { detail }));
    }
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", () => Roadora.init());
  }else{
    Roadora.init();
  }
})();
