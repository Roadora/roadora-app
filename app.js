// Roadora fallback app.js for deploy
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('roadtripContainer');
  if(container){
    container.innerHTML = '<p>Welkom bij Mijn Roadtrip fallback versie</p>';
    console.log('Fallback Roadtrip container geladen');
  }
});