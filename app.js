(function(){
  let roadoraMapInitialized=false;
  window.initRoadoraMapSubpage=function(){
    if(roadoraMapInitialized){
      if(window.roadoraLeafletMap){ setTimeout(()=>window.roadoraLeafletMap.invalidateSize(),80); }
      return;
    }
    roadoraMapInitialized=true;

const route=[[51.9244,4.4777],[51.56,5.15],[50.94,6.96],[50.25,8.4],[49.35,8.72],[48.78,9.18],[48.25,9.85],[47.85,10.75],[47.55,11.05],[47.2692,11.4041]];
const stops=[
 {name:'Fastned Limburg Zuid',meta:'184 km · 2u 05m · 8 snelladers',desc:'Snelle laadstop vlak langs de route. Ideaal voor koffie, toilet en korte EV-pauze zonder grote omweg.',type:'ev',label:'Laadstation',ll:[50.93,6.08],provider:'Fastned',power:'tot 300 kW',status:'6 vrij'},
 {name:'EnBW Ladepark Heidelberg',meta:'356 km · 3u 55m · 12 snelladers',desc:'Ruime laadlocatie bij Heidelberg met horeca in de buurt. Goede keuze als eerste langere pauze richting Oostenrijk.',type:'ev',label:'Laadstation',ll:[49.42,8.68],provider:'EnBW',power:'tot 300 kW',status:'9 vrij'},
 {name:'IONITY Ulm Süd',meta:'610 km · 6u 20m · 6 snelladers',desc:'Premium snellaadpunt langs de zuidelijke route. Handig om de auto vol te laden voor het laatste deel richting Tirol.',type:'ev',label:'Laadstation',ll:[48.28,9.98],provider:'IONITY',power:'tot 350 kW',status:'4 vrij'},
 {name:'Allego Füssen / Fernpass',meta:'820 km · 8u 35m · 4 laders',desc:'Laatste praktische laadstop vóór Oostenrijk. Slim moment om te laden voordat je de Alpen in rijdt.',type:'ev',label:'Laadstation',ll:[47.57,10.70],provider:'Allego',power:'tot 150 kW',status:'2 vrij'},
 {name:'Stuttgart Mitte',meta:'320 km · 3u 15m',desc:'Goede tussenstop met restaurants, koffie en snelle doorreis naar Zuid-Duitsland.',type:'food',label:'Eten & drinken',ll:[48.77,9.18]},
 {name:'Hotel bij Ulm',meta:'640 km · dag 1',desc:'Rustige overnachtingsplek dichtbij de route, handig voor een tweedaagse rit naar Innsbruck.',type:'hotel',label:'Overnachten',ll:[48.40,10.00]},
 {name:'Alpen uitzicht',meta:'900 km · dag 2',desc:'Rustige scenic stop richting Oostenrijk, ideaal voor foto’s en een korte pauze.',type:'view',label:'Activiteit',ll:[47.42,11.12]}
];
const destinationSheet={name:'Innsbruck, Oostenrijk',meta:'Route wordt geladen…',desc:'Je route naar Innsbruck is gepland. Kies onderweg een categorie of stop om details in dit blok te bekijken.',type:'destination',label:'Eindbestemming',ll:[47.2692,11.4041]};
const svgs={fuel:'<svg viewBox="0 0 24 24"><path d="M7 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M8 9h8M17 8h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2M7 21h10"/></svg>',ev:'<svg viewBox="0 0 24 24"><path d="M13 2L5 13h6l-1 9 8-12h-6l1-8z"/></svg>',food:'<svg viewBox="0 0 24 24"><path d="M7 3v8M11 3v8M7 7h4M9 11v10M17 3v18M17 3c3 3 3 7 0 9"/></svg>',hotel:'<svg viewBox="0 0 24 24"><path d="M3 11h18v8M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M7 11V9h4v2"/></svg>',view:'<svg viewBox="0 0 24 24"><path d="M3 20l7-14 4 8 2-4 5 10H3z"/></svg>'};
const map=L.map('routeLeafletMap',{zoomControl:false,attributionControl:false,preferCanvas:true,scrollWheelZoom:true,tap:true}).setView([49.2,8.1],6);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:18,crossOrigin:true}).addTo(map);
const routeShadow=L.polyline(route,{color:'#3b2a1a',weight:7.2,opacity:.16,lineCap:'round',lineJoin:'round'}).addTo(map);
const routeMain=L.polyline(route,{color:'#c98f48',weight:3.8,opacity:.88,lineCap:'round',lineJoin:'round'}).addTo(map);
const routeHighlight=L.polyline(route,{color:'#fff4d8',weight:1.05,opacity:.52,lineCap:'round',lineJoin:'round'}).addTo(map);
function divIcon(html,size=[34,34],anchor){return L.divIcon({html,iconSize:size,iconAnchor:anchor||[size[0]/2,size[1]/2],className:''});}
function endpoint(label,sub){return `<div class="endpointWrap"><div class="endpoint"></div><div class="routeLabel">${label}<small>${sub}</small></div></div>`}
L.marker(route[0],{icon:divIcon(endpoint('Rotterdam','Start'),[125,42],[18,21])}).addTo(map);
L.marker(route[route.length-1],{icon:divIcon(endpoint('Innsbruck','Eindbestemming'),[160,42],[18,21])}).addTo(map);
route.slice(1,-1).forEach((p,i)=>{if(i%2===0)L.marker(p,{icon:divIcon('<div class="routeDot"></div>',[10,10])}).addTo(map)});
let activeFilters=new Set(['all','ev']);
let selectedMarker=null;
const markerLayer=L.layerGroup().addTo(map);
const markerRefs=[];
const liveGoogleFuelLayer=L.layerGroup().addTo(map);
let liveGoogleFuelStops=[];
let liveGoogleFuelLoaded=false;
let liveGoogleFuelLoading=false;
function makeStopIcon(s,selected=false,hidden=false){return divIcon(`<div class="stopPin ${selected?'selected':''} ${hidden?'hidden':''}">${svgs[s.type]}</div>`,[34,34]);}
function updateSheet(s){
  document.querySelector('.sheet').classList.add('is-open');
  document.querySelector('.overline').textContent=s.label || 'Volgende stop';
  document.getElementById('stopTitle').textContent=s.name;
  document.getElementById('stopMeta').textContent=s.meta;
  const descEl=document.getElementById('stopDesc');
  if(s.type==='ev'){
    descEl.innerHTML = `${s.desc}<div class="sheetList"><div class="sheetRow"><b>Aanbieder</b><span>${s.provider||'Laadnetwerk'}</span></div><div class="sheetRow"><b>Laadsnelheid</b><span>${s.power||'snellader'}</span></div><div class="sheetRow"><b>Beschikbaarheid</b><span>${s.status||'check live'}</span></div></div>`;
  }else{
    descEl.textContent=s.desc;
  }
  const primary=document.querySelector('.sheetActions .primary');
  const secondary=document.querySelector('.sheetActions .secondary');
  if(primary) primary.textContent=s.type==='destination'?'⌁ Navigeer naar bestemming':(s.type==='ev'?'⌁ Navigeer naar laadstation':'⌁ Navigeer naar stop');
  if(secondary) secondary.textContent=s.type==='destination'?'ⓘ Route info':(s.type==='ev'?'ⓘ Laadinfo':'ⓘ Meer informatie');
}
function selectStop(ref,fly=true){
  if(selectedMarker) selectedMarker.marker.setIcon(makeStopIcon(selectedMarker.stop,false,!isVisible(selectedMarker.stop)));
  selectedMarker=ref;
  ref.marker.setIcon(makeStopIcon(ref.stop,true,false));
  updateSheet(ref.stop);
  if(fly) map.flyTo(ref.stop.ll,7,{duration:.65});
}
function isVisible(s){return activeFilters.has('all') || activeFilters.has(s.type);}
function renderMarkers(){
  markerLayer.clearLayers();
  markerRefs.length=0;
  stops.forEach(s=>{
    if(!isVisible(s)) return;
    const marker=L.marker(s.ll,{icon:makeStopIcon(s,false,false)}).addTo(markerLayer);
    const ref={marker,stop:s};
    markerRefs.push(ref);
    marker.on('click',()=>selectStop(ref,true));
  });
  if(selectedMarker && !isVisible(selectedMarker.stop)){
    selectedMarker=null;
    updateSheet(destinationSheet);
  }

  if (typeof renderLiveGoogleFuelMarkers === 'function') {
    renderLiveGoogleFuelMarkers();
  }

  if ((activeFilters.has('all') || activeFilters.has('fuel')) && typeof loadLiveGoogleFuelStations === 'function') {
    loadLiveGoogleFuelStations();
  }
}

function renderLiveGoogleFuelMarkers(){
  liveGoogleFuelLayer.clearLayers();
  if(!(activeFilters.has('all') || activeFilters.has('fuel'))) return;

  liveGoogleFuelStops.forEach(s=>{
    const marker=L.marker(s.ll,{icon:makeStopIcon(s,false,false)}).addTo(liveGoogleFuelLayer);
    marker.on('click',()=>{
      updateSheet(s);
      map.flyTo(s.ll,9,{duration:.65});
    });
  });
}


function currentRouteSamplePoints(maxPoints=6){
  const latlngs = routeMain && routeMain.getLatLngs
    ? routeMain.getLatLngs()
    : [];

  const source = latlngs && latlngs.length
    ? latlngs
    : route.map(p=>L.latLng(p[0],p[1]));

  if(!source || source.length < 2) return [];

  const points=[];

  for(let i=1;i<=maxPoints;i++){
    const idx=Math.floor((source.length-1)*(i/(maxPoints+1)));
    const p=source[Math.max(0,Math.min(source.length-1,idx))];

    points.push({
      lat:p.lat,
      lng:p.lng
    });
  }

  return points;
}

async function loadLiveGoogleFuelStations(){
  if(liveGoogleFuelLoaded || liveGoogleFuelLoading) return;
  liveGoogleFuelLoading=true;

  try{
    showToast('Echte tankstations zoeken…');

    const points=currentRouteSamplePoints(6);
    const res=await fetch('/api/google-fuel', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({points, radiusMeters:30000})
    });

    const data=await res.json();
    if(!res.ok) throw new Error(data.error || 'Google Fuel API fout');

    liveGoogleFuelStops=(data.places || []).map(p=>({
      name:p.name || 'Tankstation',
      meta:[
        p.address || 'Langs je route',
        p.rating ? `${p.rating} ★` : '',
        p.openNow === true ? 'Nu open' : ''
      ].filter(Boolean).join(' · '),
      desc:'Echt tankstation gevonden via Google Places langs je route.',
      type:'fuel',
      label:'Google tankstation',
      ll:[p.lat,p.lng],
      provider:'Google Places',
      status:p.openNow === true ? 'nu open' : 'openingstijden checken',
      googlePlaceId:p.id || null
    }));

    liveGoogleFuelLoaded=true;
    liveGoogleFuelLoading=false;
    renderLiveGoogleFuelMarkers();
    showToast(liveGoogleFuelStops.length ? `${liveGoogleFuelStops.length} echte tankstations` : 'Geen echte tankstations gevonden');
  }catch(err){
    liveGoogleFuelLoading=false;
    console.warn('Live Google tankstations fout:', err);
    showToast('Google tankstations niet geladen');
  }
}

function fit(){map.fitBounds(routeMain.getBounds(),{paddingTopLeft:[74,180],paddingBottomRight:[58,195],maxZoom:7});}
function showToast(txt){const t=document.getElementById('mapToast');t.textContent=txt;t.classList.add('show');clearTimeout(showToast._t);showToast._t=setTimeout(()=>t.classList.remove('show'),1350);}
function syncCatUI(){
  document.querySelectorAll('.cat[data-filter]').forEach(btn=>{
    const f=btn.dataset.filter;
    btn.classList.toggle('active',activeFilters.has(f));
    btn.classList.toggle('is-muted',!activeFilters.has(f) && !activeFilters.has('all'));
  });
}
document.querySelectorAll('.cat[data-filter]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const f=btn.dataset.filter;
    if(f==='all'){
      activeFilters=new Set(['all']);
    }else{
      activeFilters.delete('all');
      activeFilters.has(f)?activeFilters.delete(f):activeFilters.add(f);
      if(activeFilters.size===0) activeFilters.add('all');
    }
    syncCatUI();
    renderMarkers();

    if (f === 'fuel' && (activeFilters.has('fuel') || activeFilters.has('all'))) {
      if (typeof loadLiveGoogleFuelStations === 'function') loadLiveGoogleFuelStations();
      showToast('Tankstations langs route zoeken…');
      return;
    }

    showToast(f==='ev' && activeFilters.has('ev') && !activeFilters.has('all') ? 'Laadstations langs route' : (activeFilters.has('all')?'Alle stops zichtbaar':'Filters bijgewerkt'));
  });
});
document.querySelectorAll('.vehicle').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.vehicle').forEach(b=>b.classList.remove('active'));btn.classList.add('active');showToast('Voertuig bijgewerkt');}));

async function loadOrsRoute(){
  try{
    showToast('Echte route laden…');
    const profile=document.querySelector('.vehicle.active')?.dataset?.profile || 'driving-car';
    const params=new URLSearchParams({
      start:'4.4777,51.9244',
      end:'11.4041,47.2692',
      profile
    });
    const res=await fetch('/api/route?'+params.toString(),{headers:{Accept:'application/json'}});
    if(!res.ok) throw new Error('ORS '+res.status);
    const data=await res.json();
    const feature=data.features && data.features[0];
    const coords=feature?.geometry?.coordinates;
    if(!Array.isArray(coords) || coords.length<2) throw new Error('Geen route geometry');
    const latlngs=coords.map(c=>[c[1],c[0]]);
    routeShadow.setLatLngs(latlngs);
    routeMain.setLatLngs(latlngs);
    routeHighlight.setLatLngs(latlngs);
    const summary=feature.properties?.summary || data.routes?.[0]?.summary || {};
    const km=summary.distance ? Math.round(summary.distance/1000).toLocaleString('nl-NL')+' km' : null;
    const min=summary.duration ? Math.round(summary.duration/60) : null;
    const time=min ? (Math.floor(min/60)+'u '+String(min%60).padStart(2,'0')+'m') : null;
    const statKm=document.querySelector('.routePanel .stat:nth-child(2) b');
    const routeSub=document.querySelector('.mapActive .routeSub, .routeSub');
    if(statKm && km) statKm.textContent=km;
    if(routeSub && km && time) routeSub.textContent=`Via Duitsland · ${time} · echte ORS route`;
    if(km || time){
      destinationSheet.meta=[km,time].filter(Boolean).join(' · ');
      destinationSheet.desc='Je echte ORS-route naar Innsbruck is geladen. Onderweg kun je hotels, laadstops en eten als context in dit blok openen.';
      if(!selectedMarker) updateSheet(destinationSheet);
    }
    map.fitBounds(routeMain.getBounds(),{paddingTopLeft:[74,180],paddingBottomRight:[58,195],maxZoom:7});
    if (typeof liveGoogleFuelLayer !== 'undefined') {
      liveGoogleFuelLoaded=false; liveGoogleFuelStops=[]; liveGoogleFuelLayer.clearLayers();
      if(activeFilters.has('all') || activeFilters.has('fuel')) loadLiveGoogleFuelStations();
    }
    showToast('Echte ORS route geladen');
  }catch(err){
    console.warn('ORS fallback route:',err);
    showToast('Fallback route actief');
  }
}

function bootMap(){
  map.invalidateSize(true);
  updateSheet(destinationSheet);
  renderMarkers();
  syncCatUI();

  if ((activeFilters.has('all') || activeFilters.has('fuel')) && typeof loadLiveGoogleFuelStations === 'function') {
    setTimeout(loadLiveGoogleFuelStations, 550);
  }

  fit();
  loadOrsRoute();
}
setTimeout(bootMap,180);
window.addEventListener('load',()=>setTimeout(bootMap,120),{once:true});
window.addEventListener('resize',()=>setTimeout(()=>{map.invalidateSize(true);fit();},120));
document.getElementById('zoomIn').onclick=()=>map.zoomIn();
document.getElementById('zoomOut').onclick=()=>map.zoomOut();
document.getElementById('fitRoute').onclick=()=>{fit();showToast('Volledige route in beeld');};
document.getElementById('north').onclick=()=>showToast('Noordgericht');

    window.roadoraLeafletMap = map;
    setTimeout(()=>{ map.invalidateSize(); map.fitBounds(routeMain.getBounds(),{padding:[34,150]}); },120);
  };
})();

/* ===== Roadora extracted scripts ===== */

(function(){
  'use strict';
  const RD = window.RoadoraApp = window.RoadoraApp || {};
  RD.state = RD.state || {screen:'home'};

  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  let lockUntil = 0;
  let lastTouch = 0;
  let current = RD.state.screen || 'home';

  function closeMenu(){
    const phone=qs('.phone');
    if(phone) phone.classList.remove('menuOpen','menuExpanded');
    qsa('#sideMenu,#menuScrim').forEach(el=>el.classList.remove('open','active','show'));
  }

  function setScreen(screen){
    const now=performance.now();
    if(now < lockUntil && screen === current) return false;
    lockUntil = now + 145;
    current = screen;
    RD.state.screen = screen;

    const phone=qs('.phone');
    const route=qs('#routeSetupScreen');
    const map=qs('#mapScreen');
    closeMenu();

    if(phone){
      phone.classList.add('isSwitching');
      clearTimeout(setScreen._t);
      setScreen._t=setTimeout(()=>phone.classList.remove('isSwitching'),160);
    }

    // Single atomic paint. No slide transforms, no heavy blur animation.
    requestAnimationFrame(()=>{
      if(screen==='home'){
        phone && phone.classList.remove('mapActive');
        route && route.classList.remove('active');
        map && map.classList.remove('active');
      }else if(screen==='route'){
        phone && phone.classList.remove('mapActive');
        map && map.classList.remove('active');
        route && route.classList.add('active');
      }else if(screen==='map'){
        phone && phone.classList.add('mapActive');
        route && route.classList.remove('active');
        map && map.classList.add('active');
        initMapSoon();
      }
    });
    return false;
  }

  function initMapSoon(){
    requestAnimationFrame(()=>{
      setTimeout(()=>{
        try{
          if(window.initRoadoraMapSubpage) window.initRoadoraMapSubpage();
          if(window.roadoraLeafletMap){
            window.roadoraLeafletMap.invalidateSize(false);
            setTimeout(()=>window.roadoraLeafletMap && window.roadoraLeafletMap.invalidateSize(false),120);
          }
        }catch(e){ console.warn('Roadora map init:', e); }
      },40);
    });
  }

  RD.showHome = ev => { if(ev){ev.preventDefault();ev.stopPropagation();} return setScreen('home'); };
  RD.showRoute = ev => { if(ev){ev.preventDefault();ev.stopPropagation();} return setScreen('route'); };
  RD.showMap = ev => { if(ev){ev.preventDefault();ev.stopPropagation();} return setScreen('map'); };

  function targetScreen(target){
    if(!target || !target.closest) return null;
    if(target.closest('#openMapBtn,.rPlan,[data-open-map]')) return 'map';
    if(target.closest('#mapBackToRoute,.backToRouteBtn,[data-back-route]')) return 'route';
    if(target.closest('[data-action="route"]')) return 'route';
    if(target.closest('#backHomeBtn,[data-action="home"]')) return 'home';
    return null;
  }

  function handleNav(ev){
    const screen=targetScreen(ev.target);
    if(!screen) return;
    if(ev.type==='touchend') lastTouch=Date.now();
    if(ev.type==='click' && Date.now()-lastTouch<500){
      ev.preventDefault();
      ev.stopImmediatePropagation();
      return false;
    }
    ev.preventDefault();
    ev.stopImmediatePropagation();
    return setScreen(screen);
  }

  document.addEventListener('touchend', handleNav, {capture:true, passive:false});
  document.addEventListener('click', handleNav, true);

  // Ensure route buttons are real buttons and don't submit/reflow.
  function prepare(){
    qsa('#openMapBtn,.rPlan,[data-open-map],#mapBackToRoute,.backToRouteBtn,[data-back-route],#backHomeBtn').forEach(b=>{
      if(b.tagName==='BUTTON') b.type='button';
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', prepare, {once:true});
  else prepare();
})();

/* ===== Roadora extracted scripts ===== */

(function(){
  'use strict';
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));

  function toast(txt){
    let t=qs('#mapToast');
    if(!t){
      t=document.createElement('div');
      t.id='mapToast';
      t.className='mapToast';
      (qs('#mapScreen .roadMapApp')||document.body).appendChild(t);
    }
    t.textContent=txt;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t=setTimeout(()=>t.classList.remove('show'),1350);
  }

  function setActiveNav(btn){
    qsa('#mapScreen .navItem').forEach(b=>b.classList.remove('is-active','active'));
    if(btn) btn.classList.add('is-active','active');
  }

  function selectedStopName(){
    return (qs('#stopTitle')?.textContent || 'Roadora stop').trim();
  }

  function setSheet(kind){
    const sheet=qs('#mapScreen .sheet');
    const over=qs('#mapScreen .overline');
    const title=qs('#stopTitle');
    const meta=qs('#stopMeta');
    const desc=qs('#stopDesc');
    if(!sheet||!over||!title||!meta||!desc) return;
    sheet.classList.add('is-open','is-panel');

    if(kind==='overview'){
      over.textContent='Route-overzicht';
      title.textContent='Rotterdam → Innsbruck';
      meta.textContent='± 920 km · ± 9u 40m · 4 slimme stops';
      desc.innerHTML='Je route loopt via Duitsland richting Oostenrijk. Ideaal voor laadstops, overnachten en korte scenic pauzes.<div class="sheetList"><div class="sheetRow"><b>Heidelberg</b><span>Laadstop</span></div><div class="sheetRow"><b>Stuttgart</b><span>Eten</span></div><div class="sheetRow"><b>Innsbruck</b><span>Eindbestemming</span></div></div>';
      toast('Route-overzicht geopend');
    }
    if(kind==='stops'){
      over.textContent='Slimme stops';
      title.textContent='Stops langs je route';
      meta.textContent='Hotels · laden · eten · activiteiten';
      desc.innerHTML='Alle zichtbare pins zijn slimme stops langs de route. Tik op een pin of filter links op categorie.<div class="sheetList"><div class="sheetRow"><b>Overnachten</b><span>4 opties</span></div><div class="sheetRow"><b>Laadstations</b><span>4 snellaadpunten</span></div><div class="sheetRow"><b>Eten & drinken</b><span>6 opties</span></div></div>';
      toast('Stops geopend');
    }
    if(kind==='guide'){
      over.textContent='Reisgids';
      title.textContent='Tips onderweg';
      meta.textContent='Scenic stops · steden · pauzes';
      desc.innerHTML='Roadora kan hier straks reisgids-content tonen: highlights, wandelingen, restaurants en verborgen plekken langs je route.<div class="miniHint">Later koppelbaar aan Places, Tripadvisor of eigen curated content.</div>';
      toast('Reisgids geopend');
    }
  }

  function openMapsRoute(){
    const url='https://www.google.com/maps/dir/?api=1&origin=Rotterdam&destination=Innsbruck&travelmode=driving';
    window.open(url,'_blank','noopener');
    toast('Google Maps route geopend');
  }

  function openMapsStop(){
    const q=encodeURIComponent(selectedStopName());
    window.open('https://www.google.com/maps/search/?api=1&query='+q,'_blank','noopener');
    toast('Stop geopend in Maps');
  }

  function openMoreInfo(){
    const q=encodeURIComponent(selectedStopName()+' laadstation EV charging info');
    window.open('https://www.google.com/search?q='+q,'_blank','noopener');
    toast('Meer info geopend');
  }

  function bindOnce(el,key,fn){
    if(!el || el.dataset[key]) return;
    el.dataset[key]='1';
    el.addEventListener('click',fn);
  }

  function wire(){
    // Map bottom navigation
    const navs=qsa('#mapScreen .bottomNav .navItem');
    navs.forEach(btn=>{
      const label=(btn.textContent||'').trim().toLowerCase();
      bindOnce(btn,'rdBound',ev=>{
        ev.preventDefault(); ev.stopPropagation();
        setActiveNav(btn);
        if(label.includes('route')) return window.RoadoraApp?.showRoute ? window.RoadoraApp.showRoute(ev) : toast('Route setup');
        if(label.includes('overzicht')) return setSheet('overview');
        if(label.includes('navigeer')) return openMapsRoute();
        if(label.includes('stops')) return setSheet('stops');
        if(label.includes('reisgids')) return setSheet('guide');
      });
    });

    // Map controls/actions
    qsa('#mapScreen .adjust').forEach(btn=>bindOnce(btn,'rdBound',ev=>{ev.preventDefault();ev.stopPropagation();window.RoadoraApp?.showRoute?.(ev);toast('Route aanpassen');}));
    qsa('#mapScreen .primary').forEach(btn=>bindOnce(btn,'rdBound',ev=>{ev.preventDefault();ev.stopPropagation();openMapsStop();}));
    qsa('#mapScreen .secondary').forEach(btn=>bindOnce(btn,'rdBound',ev=>{ev.preventDefault();ev.stopPropagation();openMoreInfo();}));
    qsa('#mapScreen .swap').forEach(btn=>bindOnce(btn,'rdBound',ev=>{ev.preventDefault();ev.stopPropagation();toast('Start en bestemming omwisselen');}));

    // Route setup buttons: safe mock actions until backend/features are connected.
    qsa('#routeSetupScreen .rVehicle').forEach(btn=>bindOnce(btn,'rdBound',ev=>{ev.preventDefault();qsa('#routeSetupScreen .rVehicle').forEach(b=>b.classList.remove('active'));btn.classList.add('active');toast('Voertuig gekozen');}));
    qsa('#routeSetupScreen .rCat').forEach(btn=>bindOnce(btn,'rdBound',ev=>{ev.preventDefault();btn.classList.toggle('active');toast('Interesse bijgewerkt');}));
    qsa('#routeSetupScreen .rSave').forEach(btn=>bindOnce(btn,'rdBound',ev=>{ev.preventDefault();toast('Route opgeslagen als concept');}));
    qsa('#routeSetupScreen .rSmall').forEach(btn=>bindOnce(btn,'rdBound',ev=>{ev.preventDefault();toast('Route-opties openen');}));
    qsa('#routeSetupScreen .rSwap').forEach(btn=>bindOnce(btn,'rdBound',ev=>{ev.preventDefault();toast('Vertrek en bestemming omgewisseld');}));
    qsa('#routeSetupScreen .rStops .rHead button').forEach(btn=>bindOnce(btn,'rdBound',ev=>{ev.preventDefault();toast('Slimme stops worden op de kaart getoond');}));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wire,{once:true}); else wire();
  window.addEventListener('load',wire,{once:true});
})();

/* ===== Roadora extracted scripts ===== */

(function(){
  'use strict';
  function qs(s,r=document){return r.querySelector(s)}
  function qsa(s,r=document){return Array.from(r.querySelectorAll(s))}
  function phone(){return qs('.phone')}
  let lastMenuTouch = 0;
  function openMenu(ev){
    if(ev){
      ev.preventDefault();
      ev.stopPropagation();
      if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      if(ev.type === 'touchend') lastMenuTouch = Date.now();
      if(ev.type === 'click' && Date.now() - lastMenuTouch < 450) return false;
    }
    const ph=phone();
    if(!ph || ph.classList.contains('mapActive')) return false;

    const isOpen = ph.classList.contains('menuOpen') || ph.classList.contains('menuExpanded');
    if(isOpen){
      ph.classList.remove('menuOpen','menuExpanded');
      qsa('#sideMenu,#menuScrim').forEach(el=>el.classList.remove('open','active','show'));
    }else{
      ph.classList.add('menuOpen','menuExpanded');
      qs('#sideMenu')?.classList.add('open','active','show');
      qs('#menuScrim')?.classList.add('open','active','show');
    }
    return false;
  }
  function closeMenu(ev){
    if(ev){ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();}
    const ph=phone();
    ph?.classList.remove('menuOpen','menuExpanded');
    qsa('#sideMenu,#menuScrim').forEach(el=>el.classList.remove('open','active','show'));
    return false;
  }
  function wire(){
    const btn=qs('#menuToggle');
    const scrim=qs('#menuScrim');
    if(btn && !btn.dataset.rdHamburgerV6){
      btn.dataset.rdHamburgerV6='1';
      btn.type='button';
      btn.addEventListener('click',openMenu,true);
      btn.addEventListener('touchend',openMenu,{capture:true,passive:false});
    }
    if(scrim && !scrim.dataset.rdHamburgerV6){
      scrim.dataset.rdHamburgerV6='1';
      scrim.addEventListener('click',closeMenu,true);
      scrim.addEventListener('touchend',closeMenu,{capture:true,passive:false});
    }
    qsa('#sideMenu .sideItem').forEach(item=>{
      if(item.dataset.rdMenuItemV6) return;
      item.dataset.rdMenuItemV6='1';
      item.addEventListener('click',()=>setTimeout(closeMenu,30),true);
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wire,{once:true}); else wire();
  window.addEventListener('load',wire,{once:true});
})();

/* ===== Roadora extracted scripts ===== */

(function(){
  'use strict';
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  let lastNav=0;
  function toast(txt){
    const t=qs('#mapToast'); if(!t) return;
    t.textContent=txt; t.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('show'),1100);
  }
  function bind(el,key,fn){ if(!el||el.dataset[key]) return; el.dataset[key]='1'; el.addEventListener('click',fn,{passive:false}); }
  function wire(){
    // Sheet grab: compact/expand, feels native but does not change the route logic.
    bind(qs('#mapScreen .grab'),'rdV9Grab',e=>{e.preventDefault();e.stopPropagation();qs('#mapScreen .sheet')?.classList.toggle('is-compact');});

    // Extra debounce on bottom navigation to avoid double opens in Chrome Android.
    qsa('#mapScreen .bottomNav .navItem').forEach(btn=>{
      bind(btn,'rdV9NavGuard',e=>{
        const now=Date.now();
        if(now-lastNav<220){e.preventDefault();e.stopImmediatePropagation();return false;}
        lastNav=now;
      });
    });

    // Close menu consistently when route setup is opened from the home cards/search.
    qsa('[data-action="route"],#backHomeBtn,#openMapBtn').forEach(btn=>{
      bind(btn,'rdV9CloseMenu',()=>{
        const ph=qs('.phone');
        ph?.classList.remove('menuOpen','menuExpanded');
        qsa('#sideMenu,#menuScrim').forEach(el=>el.classList.remove('open','active','show'));
      });
    });

    // Better feedback on route setup without changing layout.
    qsa('#routeSetupScreen .rCat').forEach(btn=>{
      bind(btn,'rdV9CatFeedback',()=>setTimeout(()=>toast('Voorkeur bijgewerkt'),20));
    });
    qsa('#routeSetupScreen .rVehicle').forEach(btn=>{
      bind(btn,'rdV9VehicleFeedback',()=>setTimeout(()=>toast('Voertuig gekozen'),20));
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wire,{once:true}); else wire();
  window.addEventListener('load',wire,{once:true});
})();

/* ===== Roadora extracted scripts ===== */

(function(){
  'use strict';
  function fixSheetHandle(){
    const sheet=document.querySelector('#mapScreen .sheet');
    const grab=document.querySelector('#mapScreen .grab');
    if(sheet) sheet.classList.remove('is-compact');
    if(!grab || grab.dataset.rdV101HandleFix) return;
    grab.dataset.rdV101HandleFix='1';
    const keepOpen=function(e){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      sheet?.classList.remove('is-compact');
      return false;
    };
    grab.addEventListener('click',keepOpen,true);
    grab.addEventListener('touchstart',keepOpen,{capture:true,passive:false});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',fixSheetHandle,{once:true}); else fixSheetHandle();
  window.addEventListener('load',fixSheetHandle,{once:true});
})();