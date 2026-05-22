// Roadora Overzicht Exact Appstructuur v1
// Alleen basis-interactie voor bestaande knoppen, geen router en geen tabs.

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      // Later koppelen we hier echte acties aan.
    });
  });
});
