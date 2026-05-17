// Roadora safe clean app.js
// Alle Roadtrip hero en panels verwijderd voor veilige deploy
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('roadtripContainer');
  if(container){
    container.innerHTML = ''; // Leeg format
  }
});