# Roadora route fix pakket

Dit pakket fixt eerst de backend voor route-stops.

## Bestanden
- index.html
- api/maps-search.js
- package.json

## Upload naar GitHub
Upload de inhoud van deze map naar je repository.

Belangrijk:
api/maps-search.js moet echt in de map api staan.

## Vercel
Zorg dat Environment Variable bestaat:

SERPAPI_KEY = jouw SerpApi key

Daarna Redeploy.

## Test
Open na deploy:

/api/maps-search?q=tankstation&lat=52.3676&lng=4.9041

Als je JSON ziet met ok:true, werkt de backend.
