/* Roadora Central Router v2.3 mapflow polish
   - Home v8.7 blijft intact
   - Veilige map boot, geen dubbele init
   - Voertuig sync tussen route setup en kaart
   - Google fuel pins selectable
   - Maps opent met exacte coordinaten / place id waar mogelijk
   - v2.3: betere kaartflow, selected state, focus-terugkeer en minder flicker
*/
(function(){
  'use strict';

  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));

  const RoadoraState={
    selectedStop:null,
    vehicle:'car',
    profile:'driving-car'
  };
  window.RoadoraState=RoadoraState;

  function setButtonType(){qsa('button').forEach(b=>{if(!b.hasAttribute('type')) b.type='button';});}
  function toast(message){
    let t=qs('#mapToast');
    if(!t){t=document.createElement('div');t.id='mapToast';t.className='mapToast';(qs('#mapScreen .roadMapApp')||document.body).appendChild(t);}
    t.textContent=message;t.classList.add('show');clearTimeout(toast._timer);toast._timer=setTimeout(()=>t.classList.remove('show'),1300);
  }
  window.RoadoraToast=toast;

  function closeMenu(){
    const phone=qs('.phone');
    phone?.classList.remove('menuOpen','menuExpanded');
    qsa('#sideMenu,#menuScrim').forEach(el=>el.classList.remove('open','active','show'));
  }

  let lastNavAt=0;
  function setScreen(screen){
    const now=Date.now();
    if(now-lastNavAt<120) return false;
    lastNavAt=now;
    const phone=qs('.phone');
    const route=qs('#routeSetupScreen');
    const map=qs('#mapScreen');
    closeMenu();
    qsa('.sideItem').forEach(b=>b.classList.toggle('active', b.dataset.action===screen || (screen==='home'&&b.dataset.action==='home')));

    if(screen==='home'){
      phone?.classList.remove('mapActive');
      route?.classList.remove('active');
      map?.classList.remove('active');
      return false;
    }
    if(screen==='route'){
      phone?.classList.remove('mapActive');
      map?.classList.remove('active');
      route?.classList.add('active');
      return false;
    }
    if(screen==='map'){
      phone?.classList.add('mapActive');
      route?.classList.remove('active');
      map?.classList.add('active');
      syncRouteSetupFiltersToMap();
      setTimeout(()=>{
        try{
          window.initRoadoraMapSubpage?.();
          window.roadoraLeafletMap?.invalidateSize(false);
          setTimeout(()=>window.roadoraLeafletMap?.invalidateSize(false),160);
        }catch(err){console.warn('Roadora map init:',err);}
      },80);
      return false;
    }
    return false;
  }

  function toggleMenu(event){
    event.preventDefault();
    const phone=qs('.phone');
    if(!phone || phone.classList.contains('mapActive')) return false;
    const open=phone.classList.contains('menuOpen')||phone.classList.contains('menuExpanded');
    if(open) closeMenu(); else {phone.classList.add('menuOpen','menuExpanded');qs('#sideMenu')?.classList.add('open','active','show');qs('#menuScrim')?.classList.add('open','active','show');}
    return false;
  }

  function setVehicle(vehicle,profile){
    RoadoraState.vehicle=vehicle||'car';
    RoadoraState.profile=profile||'driving-car';
    qsa('.rVehicle,.vehicle').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.vehicle===RoadoraState.vehicle);
    });
  }

  function syncRouteSetupFiltersToMap(){
    const activeSetup=qsa('#routeSetupScreen .rCat.active[data-filter]').map(b=>b.dataset.filter);
    if(!activeSetup.length || !window.RoadoraMapApi) return;
    window.RoadoraMapApi.setFilters(activeSetup);
  }

  function selectedStop(){return RoadoraState.selectedStop || window.RoadoraMapApi?.getSelectedStop?.() || null;}
  function selectedStopName(){return (selectedStop()?.name || qs('#stopTitle')?.textContent || 'Roadora stop').trim();}
  function selectedStopMapsUrl(){
    const s=selectedStop();
    if(s?.googlePlaceId){
      return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(s.name)+'&query_place_id='+encodeURIComponent(s.googlePlaceId);
    }
    if(Array.isArray(s?.ll)){
      return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(s.ll[0]+','+s.ll[1]);
    }
    return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(selectedStopName());
  }
  function selectedStopInfoUrl(){
    const s=selectedStop();
    if(s?.infoUrl) return s.infoUrl;
    if(s?.type==='hotel') return 'https://www.google.com/search?q='+encodeURIComponent(selectedStopName()+' hotel boeken');
    if(s?.type==='fuel') return 'https://www.google.com/search?q='+encodeURIComponent(selectedStopName()+' tankstation openingstijden');
    if(s?.type==='ev') return 'https://www.google.com/search?q='+encodeURIComponent(selectedStopName()+' laadstation');
    return 'https://www.google.com/search?q='+encodeURIComponent(selectedStopName()+' informatie');
  }
  function openMapsRoute(){
    const url='https://www.google.com/maps/dir/?api=1&origin=Rotterdam&destination=Innsbruck&travelmode=driving';
    window.open(url,'_blank','noopener');toast('Google Maps route geopend');
  }
  function openMapsStop(){
    window.open(selectedStopMapsUrl(),'_blank','noopener');
    const s=selectedStop();
    toast(s?.type==='fuel'?'Tankstation geopend in Maps':s?.type==='ev'?'Laadstation geopend in Maps':'Stop geopend in Maps');
  }
  function openMoreInfo(){
    window.open(selectedStopInfoUrl(),'_blank','noopener');
    const s=selectedStop();
    toast(s?.type==='hotel'?'Hotelinformatie geopend':s?.type==='fuel'?'Tankstation info geopend':s?.type==='ev'?'Laadinfo geopend':'Meer informatie geopend');
  }
  function setActiveBottomNav(btn){qsa('#mapScreen .bottomNav .navItem').forEach(b=>b.classList.remove('active','is-active'));btn?.classList.add('active','is-active');}
  function setSheet(kind){
    const api=window.RoadoraMapApi;
    if(kind==='overview'){
      api?.showPanel?.({name:'Rotterdam → Innsbruck',label:'Route-overzicht',meta:'Echte ORS route · slimme stops',desc:'Je route loopt via Duitsland richting Oostenrijk. Tankstations worden live via Google Places langs je route geladen.',type:'overview'});
      toast('Route-overzicht geopend');
    }
    if(kind==='stops'){
      api?.showPanel?.({name:'Stops langs je route',label:'Slimme stops',meta:'Tankstations · hotels · laden · eten',desc:'Tik op een categorie links op de kaart. Tankstations zijn live Google Places resultaten langs de ORS-route.',type:'stops'});
      toast('Stops geopend');
    }
    if(kind==='guide'){
      api?.showPanel?.({name:'Tips onderweg',label:'Reisgids',meta:'Scenic stops · steden · pauzes',desc:'Hier komt later de Roadora reisgids met highlights, uitjes en memories onderweg.',type:'guide'});
      toast('Reisgids geopend');
    }
  }

  function handleClick(event){
    const target=event.target;
    if(!target?.closest) return;
    const menuBtn=target.closest('#menuToggle'); if(menuBtn){event.preventDefault();return toggleMenu(event);}
    const langBtn=target.closest('#langBtn'); if(langBtn){event.preventDefault();qs('#langMenu')?.classList.toggle('open');return false;}
    const langOpt=target.closest('#langMenu button'); if(langOpt){event.preventDefault();qsa('#langMenu button').forEach(b=>b.classList.remove('active'));langOpt.classList.add('active');qs('#langBtn').textContent=langOpt.dataset.lang||'NL';qs('#langMenu')?.classList.remove('open');toast('Taal ingesteld');return false;}
    if(target.closest('#menuScrim')){event.preventDefault();closeMenu();return false;}
    if(target.closest('[data-action="home"], #backHomeBtn')){event.preventDefault();return setScreen('home');}
    if(target.closest('[data-action="route"], .adjust')){event.preventDefault();return setScreen('route');}
    if(target.closest('#openMapBtn, .rPlan, [data-open-map]')){event.preventDefault();return setScreen('map');}
    const vehicleBtn=target.closest('.rVehicle,.vehicle');
    if(vehicleBtn){event.preventDefault();setVehicle(vehicleBtn.dataset.vehicle,vehicleBtn.dataset.profile);window.RoadoraMapApi?.reloadRoute?.();toast('Voertuig bijgewerkt');return false;}
    const setupCat=target.closest('#routeSetupScreen .rCat[data-filter]');
    if(setupCat){event.preventDefault();setupCat.classList.toggle('active');toast('Categorie bijgewerkt');return false;}
    const bottomNav=target.closest('#mapScreen .bottomNav .navItem');
    if(bottomNav){event.preventDefault();setActiveBottomNav(bottomNav);const label=(bottomNav.textContent||'').trim().toLowerCase();if(label.includes('route')){window.RoadoraMapApi?.fitRoute?.('nav');toast('Volledige route in beeld');return false;}if(label.includes('overzicht')){setSheet('overview');return false;}if(label.includes('navigeer')){openMapsRoute();return false;}if(label.includes('stops')){setSheet('stops');return false;}if(label.includes('reisgids')){setSheet('guide');return false;}return false;}
    if(target.closest('#mapScreen .primary')){event.preventDefault();openMapsStop();return false;}
    if(target.closest('#mapScreen .secondary')){event.preventDefault();openMoreInfo();return false;}
  }

  window.RoadoraApp={showHome:()=>setScreen('home'),showRoute:()=>setScreen('route'),showMap:()=>setScreen('map'),closeMenu,setVehicle};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',setButtonType,{once:true}); else setButtonType();
  document.addEventListener('click',handleClick,false);
})();

(function(){
  'use strict';
  let roadoraMapInitialized=false;
  let mapBooted=false;
  let activeFilters=new Set(['all','ev']);
  let selectedMarker=null;
  let selectedStopData=null;

  window.initRoadoraMapSubpage=function(){
    if(roadoraMapInitialized){
      if(window.roadoraLeafletMap){setTimeout(()=>window.roadoraLeafletMap.invalidateSize(false),80);}
      return;
    }
    if(!window.L){console.warn('Leaflet is nog niet geladen');return;}
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
    const markerLayer=L.layerGroup().addTo(map);
    const liveGoogleFuelLayer=L.layerGroup().addTo(map);
    const markerRefs=[];
    let liveGoogleFuelStops=[];
    let liveGoogleFuelLoaded=false;
    let liveGoogleFuelLoading=false;
    let lastFocusKey='destination:Innsbruck, Oostenrijk';
    let mapProgrammaticMove=false;
    let userTouchedMap=false;
    let lastFitAt=0;

    function divIcon(html,size=[34,34],anchor){return L.divIcon({html,iconSize:size,iconAnchor:anchor||[size[0]/2,size[1]/2],className:''});}
    function endpoint(label,sub){return `<div class="endpointWrap"><div class="endpoint"></div><div class="routeLabel">${label}<small>${sub}</small></div></div>`;}
    L.marker(route[0],{icon:divIcon(endpoint('Rotterdam','Start'),[125,42],[18,21])}).addTo(map);
    L.marker(route[route.length-1],{icon:divIcon(endpoint('Innsbruck','Eindbestemming'),[160,42],[18,21])}).addTo(map);
    route.slice(1,-1).forEach((p,i)=>{if(i%2===0)L.marker(p,{icon:divIcon('<div class="routeDot"></div>',[10,10])}).addTo(map);});

    function showToast(txt){window.RoadoraToast?window.RoadoraToast(txt):console.log(txt);}
    function isVisible(s){return activeFilters.has('all')||activeFilters.has(s.type);}
    function stopKey(s){return (s?.googlePlaceId?('place:'+s.googlePlaceId):((s?.type||'stop')+':'+(s?.name||'unknown')));}
    function selectedZoomFor(s){return s?.type==='fuel'?9:s?.type==='hotel'?8:s?.type==='destination'?7:7;}
    function mapPaddingFor(kind='route'){
      const small=window.matchMedia?.('(max-width: 560px)')?.matches;
      if(kind==='stop') return small?{paddingTopLeft:[34,96],paddingBottomRight:[34,184]}:{paddingTopLeft:[74,160],paddingBottomRight:[58,210]};
      return small?{paddingTopLeft:[42,130],paddingBottomRight:[42,178],maxZoom:7}:{paddingTopLeft:[74,180],paddingBottomRight:[58,195],maxZoom:7};
    }
    function safeInvalidate(){try{map.invalidateSize(false);}catch(_){}}
    function withProgrammaticMove(fn){mapProgrammaticMove=true;try{fn();}finally{setTimeout(()=>{mapProgrammaticMove=false;},420);}}
    function makeStopIcon(s,selected=false,hidden=false){return divIcon(`<div class="stopPin ${selected?'selected':''} ${hidden?'hidden':''}" data-stop-type="${s?.type||'stop'}">${svgs[s.type]||svgs.view}</div>`,[34,34]);}
    function setSelectedStop(s){selectedStopData=s;lastFocusKey=stopKey(s);window.RoadoraState&&(window.RoadoraState.selectedStop=s);}
    function stopPhotoFallback(s){
      const type=s?.type||'destination';
      if(type==='fuel') return 'linear-gradient(135deg,#f2d6a6,#8f6a3d 52%,#2d261d)';
      if(type==='ev') return 'linear-gradient(135deg,#dff0dd,#8ea877 52%,#26402e)';
      if(type==='hotel') return 'linear-gradient(135deg,#efe0c5,#a98255 52%,#433125)';
      if(type==='food') return 'linear-gradient(135deg,#f3d7bd,#b07045 52%,#44251a)';
      if(type==='view') return 'linear-gradient(135deg,#dce9e0,#789273 52%,#1f3629)';
      return 'linear-gradient(135deg,#dfe4d8,#657866 52%,#1f2d27)';
    }
    function setSheetThumb(s){
      const thumb=document.querySelector('#mapScreen .thumb');
      if(!thumb) return;
      const type=s?.type||'destination';
      thumb.className='thumb thumb-'+type;
      thumb.style.removeProperty('background-image');
      thumb.style.removeProperty('background');
      const photo=s?.photoUrl||s?.photo||s?.imageUrl||s?.image||'';
      if(photo){
        thumb.classList.add('has-photo');
        thumb.style.backgroundImage=`linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.22)), url("${String(photo).replace(/"/g,'')}")`;
      }else{
        thumb.classList.remove('has-photo');
        thumb.style.background=stopPhotoFallback(s);
      }
      thumb.setAttribute('aria-label', photo?'Foto van '+(s?.name||'stop'):'Roadora preview '+type);
    }
    function actionText(s,secondary=false){
      const type=s?.type||'stop';
      if(secondary){
        if(type==='destination') return 'ⓘ Route info';
        if(type==='hotel') return 'ⓘ Hotel bekijken';
        if(type==='fuel') return 'ⓘ Openingstijden';
        if(type==='ev') return 'ⓘ Laadinfo';
        if(type==='food') return 'ⓘ Menu & reviews';
        if(type==='view') return 'ⓘ Bekijk plek';
        return 'ⓘ Meer informatie';
      }
      if(type==='destination') return '⌁ Navigeer naar bestemming';
      if(type==='hotel') return '⌁ Navigeer naar hotel';
      if(type==='fuel') return '⌁ Navigeer naar tankstation';
      if(type==='ev') return '⌁ Navigeer naar laadstation';
      if(type==='food') return '⌁ Navigeer naar restaurant';
      return '⌁ Navigeer naar stop';
    }
    function updateSheet(s){
      setSelectedStop(s);
      const sheet=document.querySelector('#mapScreen .sheet');
      sheet?.classList.add('is-open');
      if(sheet){sheet.dataset.type=s.type||'stop';}
      setSheetThumb(s);
      document.querySelector('.overline').textContent=s.label||'Volgende stop';
      document.getElementById('stopTitle').textContent=s.name;
      document.getElementById('stopMeta').textContent=s.meta||'';
      const descEl=document.getElementById('stopDesc');
      if(s.type==='ev'||s.type==='fuel'||s.type==='hotel'){
        const rows=[];
        rows.push(`<div class="sheetRow"><b>${s.type==='hotel'?'Platform':'Aanbieder'}</b><span>${s.provider||'Google Places'}</span></div>`);
        if(s.rating) rows.push(`<div class="sheetRow"><b>Beoordeling</b><span>${s.rating} ★</span></div>`);
        if(s.priceLevel) rows.push(`<div class="sheetRow"><b>Prijsniveau</b><span>${s.priceLevel}</span></div>`);
        rows.push(`<div class="sheetRow"><b>${s.type==='ev'?'Laadsnelheid':s.type==='hotel'?'Status':'Status'}</b><span>${s.power||s.status||'check live'}</span></div>`);
        if(s.openNow!==undefined) rows.push(`<div class="sheetRow"><b>Nu</b><span>${s.openNow?'open':'mogelijk gesloten'}</span></div>`);
        descEl.innerHTML=`${s.desc||''}<div class="sheetList">${rows.join('')}</div>`;
      }else{descEl.textContent=s.desc||'';}
      const primary=document.querySelector('.sheetActions .primary');
      const secondary=document.querySelector('.sheetActions .secondary');
      if(primary) primary.textContent=actionText(s,false);
      if(secondary) secondary.textContent=actionText(s,true);
    }
    function resetSelectedIcon(){if(selectedMarker?.marker && selectedMarker?.stop) selectedMarker.marker.setIcon(makeStopIcon(selectedMarker.stop,false,!isVisible(selectedMarker.stop)));}
    function focusStop(s,animated=true){
      if(!Array.isArray(s?.ll)) return;
      const zoom=selectedZoomFor(s);
      withProgrammaticMove(()=>{
        if(animated) map.flyTo(s.ll,zoom,{duration:.55});
        else map.setView(s.ll,zoom,{animate:false});
      });
    }
    function selectStop(ref,fly=true){
      if(!ref?.stop) return;
      resetSelectedIcon();
      selectedMarker=ref;
      ref.marker?.setIcon(makeStopIcon(ref.stop,true,false));
      updateSheet(ref.stop);
      if(fly) focusStop(ref.stop,true);
    }
    function selectedKey(){return selectedStopData?stopKey(selectedStopData):null;}
    function registerMarker(s,layer){
      const isSelected=selectedKey()===stopKey(s);
      const marker=L.marker(s.ll,{icon:makeStopIcon(s,isSelected,false)}).addTo(layer);
      const ref={marker,stop:s};
      markerRefs.push(ref);
      if(isSelected) selectedMarker=ref;
      marker.on('click',()=>selectStop(ref,true));
      return ref;
    }
    function renderMarkers(){
      const previous=selectedStopData;
      markerLayer.clearLayers();liveGoogleFuelLayer.clearLayers();markerRefs.length=0;selectedMarker=null;
      stops.forEach(s=>{if(isVisible(s)) registerMarker(s,markerLayer);});
      if(activeFilters.has('fuel')) liveGoogleFuelStops.forEach(s=>registerMarker(s,liveGoogleFuelLayer));
      if(previous && previous.type!=='destination' && !isVisible(previous)){
        selectedMarker=null;
        updateSheet(destinationSheet);
        fit('filter-reset');
      }else if(previous && selectedMarker){
        selectedMarker.marker.setIcon(makeStopIcon(selectedMarker.stop,true,false));
      }
      if(activeFilters.has('fuel')) loadLiveGoogleFuelStations();
    }
    function renderLiveGoogleFuelMarkers(){
      liveGoogleFuelLayer.clearLayers();
      if(!activeFilters.has('fuel')) return;
      liveGoogleFuelStops.forEach(s=>registerMarker(s,liveGoogleFuelLayer));
    }
    function currentRouteSamplePoints(maxPoints=9){
      const latlngs=routeMain.getLatLngs?.()||[];
      const source=latlngs.length?latlngs:route.map(p=>L.latLng(p[0],p[1]));
      if(!source||source.length<2) return [];
      const points=[];
      for(let i=1;i<=maxPoints;i++){const idx=Math.floor((source.length-1)*(i/(maxPoints+1)));const p=source[Math.max(0,Math.min(source.length-1,idx))];points.push({lat:p.lat,lng:p.lng});}
      return points;
    }
    async function loadLiveGoogleFuelStations(){
      if(liveGoogleFuelLoaded||liveGoogleFuelLoading) return;
      liveGoogleFuelLoading=true;
      try{
        showToast('Tankstations dicht langs route zoeken…');
        const points=currentRouteSamplePoints(9);
        if(!points.length){liveGoogleFuelLoading=false;showToast('Nog geen routepunten beschikbaar');return;}
        const res=await fetch('/api/google-fuel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({points,radiusMeters:8000})});
        const data=await res.json().catch(()=>({}));
        if(!res.ok) throw new Error(data.error||'Google Fuel API fout');
        liveGoogleFuelStops=(data.places||[]).map(p=>({
          name:p.name||'Tankstation',
          meta:[p.address||'Langs je route',p.rating?`${p.rating} ★`:'',p.openNow===true?'Nu open':''].filter(Boolean).join(' · '),
          desc:'Echt tankstation gevonden via Google Places langs je route. Open de stop voor navigatie of check openingstijden voordat je afslaat.',
          type:'fuel',label:'Google tankstation',ll:[p.lat,p.lng],provider:p.provider||'Google Places',
          status:p.openNow===true?'nu open':'openingstijden checken',openNow:p.openNow,rating:p.rating||null,
          googlePlaceId:p.id||p.place_id||null,photoUrl:p.photoUrl||p.photo||p.imageUrl||p.image||null,
          infoUrl:p.url||p.website||null
        })).filter(p=>Number.isFinite(p.ll[0])&&Number.isFinite(p.ll[1]));
        liveGoogleFuelLoaded=true;liveGoogleFuelLoading=false;renderLiveGoogleFuelMarkers();showToast(liveGoogleFuelStops.length?`${liveGoogleFuelStops.length} tankstations langs route`:'Geen tankstations langs route gevonden');
      }catch(err){liveGoogleFuelLoading=false;console.warn('Live Google tankstations fout:',err);showToast('Google tankstations niet geladen');}
    }
    function fit(reason='route'){
      const now=Date.now();
      if(now-lastFitAt<160 && reason!=='force') return;
      lastFitAt=now;
      withProgrammaticMove(()=>{
        safeInvalidate();
        map.fitBounds(routeMain.getBounds(),mapPaddingFor('route'));
      });
    }
    function syncCatUI(){document.querySelectorAll('.cat[data-filter]').forEach(btn=>{const f=btn.dataset.filter;btn.classList.toggle('active',activeFilters.has(f));btn.classList.toggle('is-muted',!activeFilters.has(f)&&!activeFilters.has('all'));});}
    function setFilters(filters){
      if(!Array.isArray(filters)||!filters.length){activeFilters=new Set(['all']);}
      else{activeFilters=new Set(filters);activeFilters.delete('all');if(activeFilters.size===0) activeFilters.add('all');}
      syncCatUI();renderMarkers();if(activeFilters.has('fuel')) loadLiveGoogleFuelStations();
    }
    document.querySelectorAll('.cat[data-filter]').forEach(btn=>{btn.addEventListener('click',()=>{const f=btn.dataset.filter;if(f==='all'){activeFilters=new Set(['all']);}else{activeFilters.delete('all');activeFilters.has(f)?activeFilters.delete(f):activeFilters.add(f);if(activeFilters.size===0) activeFilters.add('all');}syncCatUI();renderMarkers();if(f==='fuel'&&activeFilters.has('fuel')){showToast(liveGoogleFuelLoaded?'Tankstations zichtbaar':'Tankstations langs route zoeken…');loadLiveGoogleFuelStations();return;}showToast(activeFilters.has('all')?'Alle stops zichtbaar':'Filters bijgewerkt');});});

    async function loadOrsRoute(){
      try{
        showToast('Echte route laden…');
        const profile=window.RoadoraState?.profile||document.querySelector('.rVehicle.active')?.dataset.profile||document.querySelector('.vehicle.active')?.dataset.profile||'driving-car';
        const params=new URLSearchParams({start:'4.4777,51.9244',end:'11.4041,47.2692',profile});
        const res=await fetch('/api/route?'+params.toString(),{headers:{Accept:'application/json'}});
        if(!res.ok) throw new Error('ORS '+res.status);
        const data=await res.json();
        const feature=data.features&&data.features[0];
        const coords=feature?.geometry?.coordinates;
        if(!Array.isArray(coords)||coords.length<2) throw new Error('Geen route geometry');
        const latlngs=coords.map(c=>[c[1],c[0]]);
        routeShadow.setLatLngs(latlngs);routeMain.setLatLngs(latlngs);routeHighlight.setLatLngs(latlngs);
        liveGoogleFuelLoaded=false;liveGoogleFuelStops=[];liveGoogleFuelLayer.clearLayers();if(activeFilters.has('fuel')) setTimeout(loadLiveGoogleFuelStations,250);
        const summary=feature.properties?.summary||data.routes?.[0]?.summary||{};
        const km=summary.distance?Math.round(summary.distance/1000).toLocaleString('nl-NL')+' km':null;
        const min=summary.duration?Math.round(summary.duration/60):null;
        const time=min?(Math.floor(min/60)+'u '+String(min%60).padStart(2,'0')+'m'):null;
        const statKm=document.querySelector('.routePanel .stat:nth-child(2) b'); if(statKm&&km) statKm.textContent=km;
        if(km||time){destinationSheet.meta=[km,time].filter(Boolean).join(' · ');destinationSheet.desc='Je echte ORS-route naar Innsbruck is geladen. Onderweg kun je hotels, laadstops en eten als context in dit blok openen.';if(!selectedMarker) updateSheet(destinationSheet);}
        fit();showToast('Echte ORS route geladen');
      }catch(err){console.warn('ORS fallback route:',err);showToast('Fallback route actief');}
    }
    function bootMap(){
      safeInvalidate();
      if(mapBooted){fit('force');return;}
      mapBooted=true;
      updateSheet(destinationSheet);renderMarkers();syncCatUI();fit('force');loadOrsRoute();
    }

    window.RoadoraMapApi={
      setFilters,
      reloadRoute:()=>{loadOrsRoute();},
      fitRoute:fit,
      focusSelected:()=>selectedMarker?selectStop(selectedMarker,true):(selectedStopData?.ll?focusStop(selectedStopData,true):fit('force')),
      clearSelection:()=>{resetSelectedIcon();selectedMarker=null;updateSheet(destinationSheet);fit('force');},
      showPanel:(data)=>{resetSelectedIcon();selectedMarker=null;updateSheet(data);},
      getSelectedStop:()=>selectedStopData
    };

    window.roadoraLeafletMap=map;
    document.getElementById('zoomIn')?.addEventListener('click',()=>map.zoomIn());
    document.getElementById('zoomOut')?.addEventListener('click',()=>map.zoomOut());
    document.getElementById('fitRoute')?.addEventListener('click',()=>{fit('force');showToast('Volledige route in beeld');});
    document.getElementById('north')?.addEventListener('click',()=>showToast('Noordgericht'));
    map.on('movestart zoomstart',()=>{if(!mapProgrammaticMove) userTouchedMap=true;});
    let resizeTimer=null;
    setTimeout(bootMap,180);
    window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{safeInvalidate();if(!userTouchedMap) fit('force');},140);});
  };
})();
