
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.bottom-nav-item').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
      });
      button.classList.add('active');
    });
  });
});
