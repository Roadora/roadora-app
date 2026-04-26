# Roadora GitHub + Vercel pakket

## Bestanden

- `index.html` = je Roadora app
- `api/maps-search.js` = veilige backend voor SerpApi
- `package.json` = minimale Vercel-config

## Upload naar GitHub

Upload alle bestanden en mappen naar je GitHub repository.

Belangrijk: de map `api` moet in de hoofdmap staan:

```text
roadora-app/
├─ index.html
├─ package.json
└─ api/
   └─ maps-search.js
```

## Koppelen aan Vercel

1. Ga naar Vercel
2. Kies **Add New Project**
3. Import je GitHub repository
4. Deploy
5. Ga naar **Settings → Environment Variables**
6. Voeg toe:

```text
SERPAPI_KEY = jouw_serpapi_sleutel
```

7. Deploy opnieuw

## Backend test

Na deploy werkt je backend op:

```text
https://jouw-project.vercel.app/api/maps-search?q=tankstation&lat=52.3676&lng=4.9041
```

## Frontend backend URL

In `index.html` staat:

```js
const SERPAPI_BACKEND_URL = "/api/maps-search";
```

Dat werkt automatisch als je frontend ook via Vercel draait.

Gebruik je GitHub Pages voor frontend en Vercel alleen voor backend? Vervang dit dan door:

```js
const SERPAPI_BACKEND_URL = "https://jouw-project.vercel.app/api/maps-search";
```
