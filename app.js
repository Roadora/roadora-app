const frames = document.querySelectorAll('.tab-frame');
const buttons = document.querySelectorAll('.bottom-nav-item');

buttons.forEach(button => {
  button.addEventListener('click', () => {
    const tab = button.dataset.tab;
    frames.forEach(frame => frame.classList.toggle('active', frame.dataset.tab === tab));
    buttons.forEach(btn => btn.classList.toggle('active', btn === button));
  });
});