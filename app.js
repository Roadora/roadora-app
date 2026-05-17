// Roadora safe clean app.js
// Dynamic hero verwijderd
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('roadtripContainer');
  if(container){
    container.innerHTML = ''; // Leeg format
    console.log('Roadtrip container ready');
  }
});