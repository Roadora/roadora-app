
document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".bottom-nav-item");

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      buttons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
    });
  });
});
