// Roadora final safe app.js
document.addEventListener('DOMContentLoaded', () => {
  try {
    const container = document.getElementById('roadtripContainer');
    if(container){
      const existingHero = document.getElementById('roadtripHero');
      if(!existingHero){
        const hero = document.createElement('div');
        hero.id = 'roadtripHero';
        hero.className = 'hero';
        hero.style.backgroundImage = "url('assets/roadtrip-bg.png')";
        hero.style.backgroundSize = 'cover';
        hero.style.backgroundPosition = 'center';
        hero.style.width = '100%';
        hero.style.height = '50vh';
        hero.innerHTML = '';
        container.parentNode.insertBefore(hero, container);
      }
      container.innerHTML = '';
      console.log('Roadtrip hero initialized successfully.');
    } else {
      console.warn('roadtripContainer not found.');
    }
  } catch(e){ console.error('Error initializing Roadtrip hero:', e); }
});
