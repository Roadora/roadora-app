/* Roadora v3.5 Compact Smart Sheet Pro
   - Home v8.7 blijft intact
   - Veilige map boot, geen dubbele init
   - Voertuig sync tussen route setup en kaart
   - Google fuel pins selectable
   - Maps opent met exacte coordinaten / place id waar mogelijk
   - v2.8: Smart Copilot Layer; cockpit reageert op route, voertuig en geselecteerde stop
*/
(function(){
  'use strict';

  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));

  const RoadoraState={
    selectedStop:null,
    vehicle:'car',
    profile:'driving-car',
    hotelDetailPhotos:[],
    hotelDetailPhotoIndex:0
  };
  window.RoadoraState=RoadoraState;

  function setButtonType(){qsa('button').forEach(b=>{if(!b.hasAttribute('type')) b.type='button';});}
  function toast(message){
    let t=qs('#mapToast');
    if(!t){t=document.createElement('div');t.id='mapToast';t.className='mapToast';(qs('#mapScreen .roadMapApp')||document.body).appendChild(t);}
    t.textContent=message;t.classList.add('show');clearTimeout(toast._timer);toast._timer=setTimeout(()=>t.classList.remove('show'),1300);
  }
  window.RoadoraToast=toast;

  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

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
    if(!phone) return false;
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
    window.RoadoraMapApi?.updateTopbar?.();
  }

  function syncRouteSetupFiltersToMap(){
    // v3.4: de kaart start bewust clean. Route setup keuzes worden later gebruikt voor suggesties,
    // maar tonen geen pins totdat de gebruiker op de kaart zelf een categorie opent.
    return;
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
    if(s?.type==='hotel') return s.googleMapsUri || ('https://www.google.com/search?q='+encodeURIComponent(selectedStopName()+' hotel'));
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
    toast(s?.type==='hotel'?'Hotel geopend':s?.type==='fuel'?'Tankstation geopend in Maps':s?.type==='ev'?'Laadstation geopend in Maps':'Stop geopend in Maps');
  }
  function openMoreInfo(){
    window.open(selectedStopInfoUrl(),'_blank','noopener');
    const s=selectedStop();
    toast(s?.type==='hotel'?'Hotelinformatie geopend':s?.type==='fuel'?'Tankstation info geopend':s?.type==='ev'?'Laadinfo geopend':'Meer informatie geopend');
  }
  function savedStopsKey(){return 'roadoraSavedStops';}
  function readSavedStops(){
    try{return JSON.parse(localStorage.getItem(savedStopsKey())||'[]').filter(Boolean);}
    catch(_){return [];}
  }
  function stopIdentity(s){return s?.googlePlaceId || `${s?.type||'stop'}:${s?.name||''}:${Array.isArray(s?.ll)?s.ll.join(','):''}`;}
  function normalizeSavedStop(s){
    return {
      id: stopIdentity(s),
      name:s.name,
      type:s.type,
      label:s.label||'Tussenstop',
      meta:s.meta||'',
      address:s.address||s.meta||'',
      ll:s.ll||null,
      rating:s.rating||null,
      userRatingCount:s.userRatingCount||null,
      detourLabel:s.detourLabel||null,
      priceLevel:s.priceLevel||null,
      amenities:Array.isArray(s.amenities)?s.amenities.slice(0,8):[],
      googlePlaceId:s.googlePlaceId||null,
      googleMapsUri:s.googleMapsUri||s.infoUrl||null,
      infoUrl:s.infoUrl||s.googleMapsUri||null,
      photoUrl:firstStopPhoto(s)||null,
      photoUrls:hotelPhotosFor(s),
      savedAt:new Date().toISOString()
    };
  }
  function savedHotelCount(){return readSavedStops().filter(x=>x.type==='hotel').length;}
  function updateHotelCompareButton(){
    const btn=qs('[data-hotel-action="compare"]');
    if(btn){
      const count=savedHotelCount();
      btn.hidden=count===0;
      btn.textContent=count?`Vergelijk opgeslagen hotels (${count})`:'Vergelijk opgeslagen hotels';
    }
  }
  function saveSelectedStop(){
    const s=selectedStop();
    if(!s || s.type==='destination' || s.type==='overview'){toast('Kies eerst een tussenstop');return false;}
    const item=normalizeSavedStop(s);
    try{
      const list=readSavedStops();
      const exists=list.some(x=>(x.id||x.googlePlaceId||`${x.type}:${x.name}`)===item.id);
      const next=exists?list.map(x=>(x.id||x.googlePlaceId||`${x.type}:${x.name}`)===item.id?{...x,...item,savedAt:x.savedAt||item.savedAt}:x):[item,...list];
      localStorage.setItem(savedStopsKey(),JSON.stringify(next.slice(0,60)));
      updateHotelCompareButton();
      toast(exists?'Stond al opgeslagen':'Opgeslagen voor vergelijking');
    }catch(err){console.warn('Opslaan tussenstop fout:',err);toast('Opslaan niet gelukt');}
    return false;
  }
  function ensureHotelCompareSheet(){
    let el=qs('#hotelCompareSheet');
    if(el) return el;
    el=document.createElement('section');
    el.id='hotelCompareSheet';
    el.className='hotelCompareSheet';
    el.innerHTML=`<div class="hotelCompareScrim" data-compare-action="close"></div><article class="hotelCompareCard"><button class="hotelCompareClose" data-compare-action="close">×</button><div class="hotelCompareHead"><span>Opgeslagen hotels</span><b>Vergelijk je shortlist</b></div><div class="hotelCompareList"></div></article>`;
    (qs('#mapScreen .roadMapApp')||document.body).appendChild(el);
    return el;
  }
  function openHotelCompare(){
    const hotels=readSavedStops().filter(x=>x.type==='hotel');
    const el=ensureHotelCompareSheet();
    const list=qs('.hotelCompareList',el);
    if(list){
      list.innerHTML=hotels.length?hotels.slice(0,10).map(h=>{
        const photo=firstStopPhoto(h);
        const id=escapeHtml(h.id||h.googlePlaceId||`${h.type}:${h.name}`);
        return `<div class="hotelCompareItem" data-save-id="${id}"><button class="hotelCompareOpen" data-compare-action="open" data-save-id="${id}"><span class="hotelCompareThumb ${photo?'has-photo':''}" style="${photo?`background-image:linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.22)),url('${String(photo).replace(/'/g,'')}')`:''}"></span><span><b>${escapeHtml(h.name||'Hotel')}</b><em>${escapeHtml([h.rating?`${h.rating} ★`:'',h.detourLabel||'',h.address||''].filter(Boolean).join(' · '))}</em></span></button><button class="hotelCompareDelete" data-compare-action="delete" data-save-id="${id}" aria-label="Hotel verwijderen">×</button></div>`;
      }).join(''):'<div class="hotelCompareEmpty">Sla eerst een hotel op. Daarna kun je ze hier rustig vergelijken.</div>';
    }
    el.classList.add('open');
    toast(hotels.length?'Hotel shortlist geopend':'Nog geen hotels opgeslagen');
    return false;
  }
  function closeHotelCompare(){qs('#hotelCompareSheet')?.classList.remove('open');return false;}
  function deleteSavedHotel(id){
    try{
      const before=readSavedStops();
      const next=before.filter(x=>String(x.id||x.googlePlaceId||`${x.type}:${x.name}`)!==String(id));
      localStorage.setItem(savedStopsKey(),JSON.stringify(next));
      updateHotelCompareButton();
      openHotelCompare();
      toast('Hotel verwijderd uit shortlist');
    }catch(err){console.warn('Hotel verwijderen fout:',err);toast('Verwijderen niet gelukt');}
    return false;
  }
  function openSavedHotel(id){
    const h=readSavedStops().find(x=>String(x.id||x.googlePlaceId||`${x.type}:${x.name}`)===String(id));
    if(!h){toast('Hotel niet gevonden');return false;}
    RoadoraState.selectedStop=h;
    closeHotelCompare();
    return openHotelDetail();
  }


  function ensureHotelDetailSheet(){
    let el=qs('#hotelDetailSheet');
    if(el) return el;
    el=document.createElement('section');
    el.id='hotelDetailSheet';
    el.className='hotelDetailSheet';
    el.setAttribute('aria-label','Hotel details');
    el.innerHTML=`
      <div class="hotelDetailScrim" data-hotel-action="close"></div>
      <article class="hotelDetailCard">
        <button class="hotelDetailGrab" data-hotel-action="expand" aria-label="Hotel detail groter maken"></button>
        <button class="hotelDetailClose" data-hotel-action="close" aria-label="Sluiten">×</button>
        <div class="hotelDetailHero"></div>
        <div class="hotelDetailBody"></div>
      </article>`;
    (qs('#mapScreen .roadMapApp')||document.body).appendChild(el);
    return el;
  }

  function hotelDetailAmenityIcon(label){
    const v=String(label||'').toLowerCase();
    if(v.includes('wifi')) return '⌁';
    if(v.includes('park')) return '🅿️';
    if(v.includes('ontbijt')||v.includes('breakfast')) return '☕';
    if(v.includes('familie')||v.includes('kind')) return '👨‍👩‍👧';
    if(v.includes('hond')||v.includes('huisdier')||v.includes('pet')) return '🐾';
    if(v.includes('ev')||v.includes('laad')) return '⚡';
    if(v.includes('wellness')||v.includes('spa')||v.includes('zwembad')) return '♨️';
    return '✓';
  }

  function hotelDetailAmenitiesHtml(s){
    const items=(Array.isArray(s?.amenities)&&s.amenities.length?s.amenities:['Wifi','Parkeren']).slice(0,6);
    return items.map(a=>`<span><b>${hotelDetailAmenityIcon(a)}</b><em>${escapeHtml(a)}</em></span>`).join('');
  }

  function hotelPhotosFor(s){
    const list=[];
    if(Array.isArray(s?.photoUrls)) list.push(...s.photoUrls);
    ['photoUrl','photo','imageUrl','image'].forEach(k=>{if(s?.[k]) list.push(s[k]);});
    return Array.from(new Set(list.filter(Boolean))).slice(0,6);
  }
  function firstStopPhoto(s){
    return hotelPhotosFor(s)[0] || s?.photoUrl || s?.photo || s?.imageUrl || s?.image || '';
  }
  function renderHotelHero(hero, photos, index=0){
    const photo=photos[index]||'';
    RoadoraState.hotelDetailPhotos=photos;
    RoadoraState.hotelDetailPhotoIndex=index;
    hero.classList.toggle('has-photo',!!photo);
    hero.style.backgroundImage=photo?`linear-gradient(180deg,rgba(20,12,6,.05),rgba(20,12,6,.36)), url("${String(photo).replace(/"/g,'')}")`:'';
    if(photo){
      const dots=photos.length>1?`<div class="hotelHeroDots">${photos.map((_,i)=>`<button class="${i===index?'active':''}" data-hotel-action="photo-dot" data-photo-index="${i}" aria-label="Foto ${i+1}"></button>`).join('')}</div>`:'';
      const arrows=photos.length>1?'<button class="hotelHeroArrow prev" data-hotel-action="photo-prev" aria-label="Vorige foto">‹</button><button class="hotelHeroArrow next" data-hotel-action="photo-next" aria-label="Volgende foto">›</button>':'';
      hero.innerHTML=`${arrows}<button class="hotelHeroExpand" data-hotel-action="expand" aria-label="Bekijk foto groter"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/><path d="M8 3 3 8M16 3l5 5M3 16l5 5M21 16l-5 5"/></svg></button><div class="hotelHeroShade"><span>Foto via Google Places</span></div>${dots}`;
    }else{
      hero.innerHTML='<div class="hotelDetailFallback">Hotel langs route</div>';
    }
  }

  function openHotelDetail(){
    const s=selectedStop();
    if(!s || s.type!=='hotel'){openMoreInfo();return false;}
    const el=ensureHotelDetailSheet();
    const hero=qs('.hotelDetailHero',el);
    const body=qs('.hotelDetailBody',el);
    const photos=hotelPhotosFor(s);
    if(hero) renderHotelHero(hero,photos,0);
    const rating=s.rating?`${escapeHtml(s.rating)} ★`: 'Google Places';
    const reviews=s.userRatingCount?`${escapeHtml(s.userRatingCount)} reviews`:'reviews bekijken';
    const detour=escapeHtml(s.detourLabel||'± 10 min van route');
    const address=escapeHtml(s.address||s.meta||'Langs je route');
    body.innerHTML=`
      <div class="hotelDetailOverline">Hotel langs route</div>
      <h3>${escapeHtml(s.name||'Hotel')}</h3>
      <div class="hotelDetailMeta"><span>${rating}</span><i></i><span>${reviews}</span><i></i><span>${detour}</span></div>
      <p>${address}</p>
      <div class="hotelDetailAmenities">${hotelDetailAmenitiesHtml(s)}</div>
      <div class="hotelDetailActions">
        <button class="hotelPrimary" data-hotel-action="maps">Bekijk op Google</button>
        <button class="hotelGhost" data-hotel-action="navigate">Navigeer</button>
        <button class="hotelGhost" data-hotel-action="save">Opslaan</button>
      </div>
      <button class="hotelCompareButton" data-hotel-action="compare" hidden>Vergelijk opgeslagen hotels</button>
      <div class="hotelDetailNote">Booking-link en prijzen voegen we later toe. Je blijft eerst in Roadora om hotels rustig te vergelijken.</div>`;
    updateHotelCompareButton();
    el.classList.add('open');
    toast('Hotel details geopend');
    return false;
  }

  function closeHotelDetail(){
    qs('#hotelDetailSheet')?.classList.remove('open');
    return false;
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
    const menuBtn=target.closest('#menuToggle, [data-menu-open]'); if(menuBtn){event.preventDefault();return toggleMenu(event);}
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
    if(bottomNav){event.preventDefault();setActiveBottomNav(bottomNav);const label=(bottomNav.textContent||'').trim().toLowerCase();if(label.includes('route')){window.RoadoraMapApi?.fitRoute?.('nav');toast('Volledige route in beeld');return false;}if(label.includes('overzicht')){setSheet('overview');return false;}if(label.includes('navigeer')){openMapsRoute();return false;}if(label.includes('stops')){window.RoadoraMapApi?.toggleCategories?.();return false;}if(label.includes('reisgids')){setSheet('guide');return false;}return false;}
    const hotelAction=target.closest('[data-hotel-action]');
    if(hotelAction){
      event.preventDefault();
      const action=hotelAction.dataset.hotelAction;
      if(action==='close') return closeHotelDetail();
      if(action==='expand') { qs('#hotelDetailSheet')?.classList.toggle('expanded'); return false; }
      if(action==='photo-next' || action==='photo-prev' || action==='photo-dot'){
        const photos=RoadoraState.hotelDetailPhotos||[];
        if(photos.length){
          let idx=RoadoraState.hotelDetailPhotoIndex||0;
          if(action==='photo-next') idx=(idx+1)%photos.length;
          if(action==='photo-prev') idx=(idx-1+photos.length)%photos.length;
          if(action==='photo-dot') idx=Number(hotelAction.dataset.photoIndex)||0;
          const hero=qs('#hotelDetailSheet .hotelDetailHero');
          if(hero) renderHotelHero(hero,photos,idx);
        }
        return false;
      }
      if(action==='maps') return openMoreInfo();
      if(action==='navigate') return openMapsStop();
      if(action==='save') return saveSelectedStop();
      if(action==='compare') return openHotelCompare();
      return false;
    }
    const compareAction=target.closest('[data-compare-action]');
    if(compareAction){
      event.preventDefault();
      const action=compareAction.dataset.compareAction;
      if(action==='close') return closeHotelCompare();
      if(action==='delete') return deleteSavedHotel(compareAction.dataset.saveId);
      if(action==='open') return openSavedHotel(compareAction.dataset.saveId);
      return false;
    }
    if(target.closest('#mapScreen .saveStop')){event.preventDefault();saveSelectedStop();return false;}
    if(target.closest('#mapScreen .primary')){event.preventDefault();const s=selectedStop(); if(s?.type==='hotel') return openHotelDetail(); openMapsStop(); return false;}
    if(target.closest('#mapScreen .secondary')){event.preventDefault();const s=selectedStop(); if(s?.type==='hotel') openMapsStop(); else openMoreInfo(); return false;}
  }

  window.RoadoraApp={showHome:()=>setScreen('home'),showRoute:()=>setScreen('route'),showMap:()=>setScreen('map'),closeMenu,setVehicle};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',setButtonType,{once:true}); else setButtonType();
  document.addEventListener('click',handleClick,false);
})();

(function(){
  'use strict';
  let roadoraMapInitialized=false;
  let mapBooted=false;
  let activeFilters=new Set();
  let selectedMarker=null;
  let selectedStopData=null;
  let routeDistanceLabel='— km';
  let routeTimeLabel='Route laden…';

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

    const map=L.map('routeLeafletMap',{zoomControl:false,attributionControl:false,preferCanvas:true,scrollWheelZoom:true,tap:true,zoomSnap:.25,zoomDelta:.5}).setView([49.2,8.1],6);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:18,crossOrigin:true}).addTo(map);
    const routeShadow=L.polyline(route,{color:'#3b2a1a',weight:7.2,opacity:.16,lineCap:'round',lineJoin:'round'}).addTo(map);
    const routeMain=L.polyline(route,{color:'#c98f48',weight:3.8,opacity:.88,lineCap:'round',lineJoin:'round'}).addTo(map);
    const routeHighlight=L.polyline(route,{color:'#fff4d8',weight:1.05,opacity:.52,lineCap:'round',lineJoin:'round'}).addTo(map);
    const markerLayer=L.layerGroup().addTo(map);
    const liveGoogleFuelLayer=L.layerGroup().addTo(map);
    const liveGoogleHotelLayer=L.layerGroup().addTo(map);
    const markerRefs=[];
    let liveGoogleFuelStops=[];
    let liveGoogleFuelLoaded=false;
    let liveGoogleFuelLoading=false;
    let liveGoogleFuelKey='';
    let liveGoogleFuelRequestId=0;
    let liveGoogleHotelStops=[];
    let liveGoogleHotelLoaded=false;
    let liveGoogleHotelLoading=false;
    let liveGoogleHotelKey='';
    let liveGoogleHotelRequestId=0;
    let routeRequestId=0;
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
    function setCategoriesOpen(open){
      const cats=document.getElementById('mapCats');
      const cta=document.getElementById('stopsCta');
      cats?.classList.toggle('is-collapsed',!open);
      cats?.classList.toggle('is-open',!!open);
      cta?.classList.toggle('active',!!open || activeFilters.size>0);
      cta?.setAttribute('aria-expanded',open?'true':'false');
    }
    function toggleCategories(){
      const cats=document.getElementById('mapCats');
      setCategoriesOpen(!(cats?.classList.contains('is-open')));
      showToast(cats?.classList.contains('is-open')?'Kies je stops':'Stops verborgen');
    }
    function isVisible(s){return activeFilters.has(s.type);}
    function stopKey(s){return (s?.googlePlaceId?('place:'+s.googlePlaceId):((s?.type||'stop')+':'+(s?.name||'unknown')));}
    function selectedZoomFor(s){return s?.type==='fuel'?9:s?.type==='hotel'?8:s?.type==='destination'?7:7;}
    function mapPaddingFor(kind='route'){
      const small=window.matchMedia?.('(max-width: 560px)')?.matches;
      if(kind==='stop') return small?{paddingTopLeft:[30,92],paddingBottomRight:[28,178]}:{paddingTopLeft:[64,150],paddingBottomRight:[52,205]};
      // v3.9.1: strakkere route-fit zodat de echte ORS-route groter in beeld komt zonder endpoints kwijt te raken.
      return small?{paddingTopLeft:[24,112],paddingBottomRight:[24,134],maxZoom:8}:{paddingTopLeft:[42,145],paddingBottomRight:[42,172],maxZoom:8};
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
    function vehicleInfo(){
      const v=window.RoadoraState?.vehicle||'car';
      if(v==='ev') return {short:'EV', mode:'EV route', assist:'laadstop gepland'};
      if(v==='camper') return {short:'Camper', mode:'Camper route', assist:'overnachting slim plannen'};
      if(v==='motor') return {short:'Motor', mode:'Scenic route', assist:'mooie wegen focus'};
      return {short:'Auto', mode:'Auto route', assist:'pauze slim plannen'};
    }
    function cleanMetaPart(s, fallback){
      const meta=String(s?.meta||'').split('·').map(x=>x.trim()).filter(Boolean);
      return meta[0]||fallback;
    }
    function escapeHtml(value){
      return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }
    function inferFuelBrand(name=''){
      const n=String(name).toLowerCase();
      if(n.includes('shell')) return 'Shell';
      if(n.includes('esso')||n.includes('exxon')) return 'Esso';
      if(n.includes('bp')) return 'BP';
      if(n.includes('total')) return 'TotalEnergies';
      if(n.includes('texaco')) return 'Texaco';
      if(n.includes('avia')) return 'AVIA';
      if(n.includes('aral')) return 'Aral';
      if(n.includes('q8')) return 'Q8';
      if(n.includes('tinq')) return 'Tinq';
      if(n.includes('fastned')) return 'Fastned';
      return 'Tankstation';
    }
    function fuelDetourLabel(s){
      return s?.detourLabel || s?.detour || s?.distanceFromRoute || '± 2 min van route';
    }
    function fuelPriceLabel(s){
      // Live brandstofprijzen blijven bewust uit de MVP. Roadora toont daarom geen harde prijsclaim.
      return s?.fuelPrice || s?.priceLabel || s?.price || 'geen live prijs';
    }
    function fuelOpenLabel(s){
      if(s?.openNow===true) return 'Nu open';
      if(s?.openNow===false) return 'Check openingstijden';
      return s?.status || 'Openingstijden checken';
    }
    function fuelAmenities(s){
      const source = Array.isArray(s?.amenities) && s.amenities.length ? s.amenities : null;
      const normalize = (item) => String(item || '').trim();
      const name=String(s?.name||'').toLowerCase();
      let base = source ? source.map(normalize).filter(Boolean) : ['WC','Shop'];
      if(!source && (name.includes('shell')||name.includes('bp')||name.includes('total')||name.includes('esso')||name.includes('aral'))) base.unshift('Koffie');
      if(!source && s?.rating && Number(s.rating)>=4.2) base.push('Goed beoordeeld');
      return base.slice(0,6);
    }
    function amenityIcon(label){
      const v=String(label||'').toLowerCase();
      if(v.includes('wc')||v.includes('toilet')) return '🚻';
      if(v.includes('koffie')||v.includes('coffee')||v.includes('cafe')||v.includes('café')) return '☕';
      if(v.includes('shop')||v.includes('winkel')) return '🛒';
      if(v.includes('wifi')||v.includes('wi-fi')) return '⌁';
      if(v.includes('ev')||v.includes('laad')||v.includes('charge')) return '⚡';
      if(v.includes('snack')||v.includes('eten')||v.includes('food')) return '🍔';
      if(v.includes('diesel')||v.includes('fuel')||v.includes('benzine')) return '⛽';
      if(v.includes('goed')||v.includes('rating')) return '★';
      return '•';
    }
    function premiumFuelHtml(s){
      const open=escapeHtml(fuelOpenLabel(s));
      const rating=s?.rating ? `${escapeHtml(s.rating)} ★` : 'Google Places';
      const amenitiesList=fuelAmenities(s);
      const visibleAmenities=amenitiesList.slice(0,4).map(a=>`<span title="${escapeHtml(a)}"><b>${amenityIcon(a)}</b><em>${escapeHtml(String(a).replace('Goed beoordeeld','Top'))}</em></span>`).join('');
      const more=amenitiesList.length>4?`<span class="moreAmenity"><b>+${amenitiesList.length-4}</b><em>Meer</em></span>`:'';
      return `
        <div class="fuelPremium fuelPremiumV35">
          <div class="fuelQuickLine">
            <span>${rating}</span>
            <i></i>
            <span>${open}</span>
          </div>
          <div class="fuelAmenitiesStrip" aria-label="Voorzieningen">${visibleAmenities}${more}</div>
        </div>`;
    }

    function hotelAmenities(s){
      const source = Array.isArray(s?.amenities) && s.amenities.length ? s.amenities : ['Wifi','Parkeren'];
      return source.map(x=>String(x||'').trim()).filter(Boolean).slice(0,6);
    }
    function hotelAmenityIcon(label){
      const v=String(label||'').toLowerCase();
      if(v.includes('wifi')) return '⌁';
      if(v.includes('park')) return '🅿️';
      if(v.includes('ontbijt')||v.includes('breakfast')) return '☕';
      if(v.includes('familie')||v.includes('kind')) return '👨‍👩‍👧';
      if(v.includes('hond')||v.includes('huisdier')||v.includes('pet')) return '🐾';
      if(v.includes('ev')||v.includes('laad')) return '⚡';
      if(v.includes('wellness')||v.includes('spa')||v.includes('zwembad')) return '♨️';
      return '✓';
    }
    function hotelPriceLabel(s){
      const raw=String(s?.priceLevel||'').replace('PRICE_LEVEL_','');
      if(raw==='INEXPENSIVE') return '€';
      if(raw==='MODERATE') return '€€';
      if(raw==='EXPENSIVE') return '€€€';
      if(raw==='VERY_EXPENSIVE') return '€€€€';
      return 'Prijs via hotel';
    }
    function premiumHotelHtml(s){
      const rating=s?.rating ? `${escapeHtml(s.rating)} ★` : 'Google Places';
      const reviews=s?.userRatingCount ? `${escapeHtml(s.userRatingCount)} reviews` : 'reviews';
      const price=escapeHtml(hotelPriceLabel(s));
      const amenitiesList=hotelAmenities(s);
      const visible=amenitiesList.slice(0,4).map(a=>`<span title="${escapeHtml(a)}"><b>${hotelAmenityIcon(a)}</b><em>${escapeHtml(a)}</em></span>`).join('');
      const more=amenitiesList.length>4?`<span class="moreAmenity"><b>+${amenitiesList.length-4}</b><em>Meer</em></span>`:'';
      return `
        <div class="hotelPremiumV2 hotelCompactV21">
          <div class="hotelQuickLine">
            <span>${rating}</span><i></i><span>${reviews}</span><i></i><span>${price}</span>
          </div>
          <div class="hotelAmenitiesStrip" aria-label="Hotelvoorzieningen">${visible}${more}</div>
        </div>`;
    }
    function routeArrivalLabel(){
      // Simpele lokale ETA-berekening op basis van routeTimeLabel. Wordt later vervangen door live route engine.
      const m=String(routeTimeLabel||'').match(/(\d+)u\s*(\d+)?/);
      if(!m) return 'Aankomst —';
      const mins=(parseInt(m[1],10)*60)+(parseInt(m[2]||'0',10));
      const d=new Date(Date.now()+mins*60000);
      return 'Aankomst '+d.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
    }
    function routeMood(){
      const v=vehicleInfo();
      if(v.short==='EV') return '⚡ Laadroute';
      if(v.short==='Camper') return '🏕 Camperproof';
      if(v.short==='Motor') return '🏍 Scenic';
      return '🟢 Rustige route';
    }
    function copilotStateFor(stop){
      const type=stop?.type||'destination';
      const v=vehicleInfo();
      const base={
        state:'route',
        title:'Rotterdam → Innsbruck',
        badge:routeMood(),
        sub:`${v.mode} · ${routeTimeLabel && routeTimeLabel!=='Route laden…' ? routeTimeLabel : 'route laden'} · ${routeDistanceLabel||'afstand berekenen'}`,
        eta:routeTimeLabel && routeTimeLabel!=='Route laden…' ? routeTimeLabel : 'ETA —',
        distance:routeDistanceLabel||'— km',
        next:v.short==='EV'?'Volgende: laadstop':'Pauze over 45 min'
      };

      if(type==='overview') return {...base,state:'overview',badge:'Trip overzicht',next:'Alle stops'};
      if(type==='stops') return {...base,state:'stops',badge:'Slimme stops',next:'Stops langs route'};
      if(type==='guide') return {...base,state:'guide',badge:'Reisgids',next:'Highlights'};

      if(type==='fuel') return {
        state:'fuel',
        title:'Volgende tankstop',
        badge:fuelOpenLabel(stop),
        sub:'Live cockpit · GPS-ready route-context',
        eta:stop?.etaToStop || stop?.timeToStop || fuelDetourLabel(stop),
        distance:stop?.distanceToStop || stop?.kmToStop || '± 3 km',
        next:(vehicleInfo().short || 'Auto') + ' · langs route'
      };

      if(type==='ev') return {
        state:'ev',
        title:stop?.name||'Laadstation',
        badge:stop?.status||'Laadstop',
        sub:`${stop?.provider||'Laadnetwerk'} · ${stop?.power||'snellader'} · ${cleanMetaPart(stop,'langs route')}`,
        eta:cleanMetaPart(stop,'Volgende stop'),
        distance:stop?.power||'snellader',
        next:stop?.status||'beschikbaarheid'
      };

      if(type==='hotel') return {
        state:'hotel',
        title:'Hotels langs route',
        badge:stop?.rating ? `${stop.rating} ★` : 'Hotel optie',
        sub:'Overnachting · foto’s · reviews',
        eta:stop?.detourLabel || '± 10 min van route',
        distance:'langs route',
        next:'Hotel bekijken'
      };

      if(type==='food') return {
        state:'food',
        title:stop?.name||'Eten & drinken',
        badge:'Pauzeplek',
        sub:`Eten & drinken · ${cleanMetaPart(stop,'langs route')}`,
        eta:'Korte pauze',
        distance:'Langs route',
        next:'Reviews bekijken'
      };

      if(type==='view') return {
        state:'view',
        title:stop?.name||'Mooie plek',
        badge:'Scenic',
        sub:`Uitkijkpunt · ${cleanMetaPart(stop,'route highlight')}`,
        eta:'Fotostop',
        distance:'Scenic route',
        next:'Bekijken'
      };

      return base;
    }
    function updateSmartTopbar(s){
      const stop=s||selectedStopData||destinationSheet;
      const title=document.getElementById('mapStatusTitle');
      const badge=document.getElementById('mapStatusBadge');
      const sub=document.getElementById('mapStatusSub');
      const eta=document.getElementById('mapStatusEta');
      const dist=document.getElementById('mapStatusDistance');
      const next=document.getElementById('mapStatusNext');
      const cockpit=document.querySelector('#mapScreen .mapCockpit');
      if(!title||!badge||!sub||!eta||!dist||!next) return;

      const state=copilotStateFor(stop);
      cockpit?.setAttribute('data-copilot-state',state.state);
      title.textContent=state.title;
      badge.textContent=state.badge;
      sub.textContent=state.sub;
      eta.textContent=state.eta;
      dist.textContent=state.distance;
      next.textContent=state.next;
    }

    function setSheetThumb(s){
      const thumb=document.querySelector('#mapScreen .thumb');
      if(!thumb) return;
      const type=s?.type||'destination';
      thumb.className='thumb thumb-'+type;
      thumb.style.removeProperty('background-image');
      thumb.style.removeProperty('background');
      const photo=firstStopPhoto(s);
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
        if(type==='hotel') return '⌁ Navigeer';
        if(type==='fuel') return 'ⓘ Reviews';
        if(type==='ev') return 'ⓘ Laadinfo';
        if(type==='food') return 'ⓘ Menu & reviews';
        if(type==='view') return 'ⓘ Bekijk plek';
        return 'ⓘ Meer informatie';
      }
      if(type==='destination') return '⌁ Navigeer naar bestemming';
      if(type==='hotel') return 'Bekijk hotel';
      if(type==='fuel') return '➤ Navigeer';
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
      document.getElementById('stopMeta').textContent=s.type==='fuel' ? cleanMetaPart(s,'Langs je route') : (s.meta||'');
      const descEl=document.getElementById('stopDesc');
      if(s.type==='fuel'){
        descEl.innerHTML=premiumFuelHtml(s);
      }else if(s.type==='hotel'){
        descEl.innerHTML=premiumHotelHtml(s);
      }else if(s.type==='ev'){
        const rows=[];
        rows.push(`<div class="sheetRow"><b>Aanbieder</b><span>${escapeHtml(s.provider||'Google Places')}</span></div>`);
        if(s.rating) rows.push(`<div class="sheetRow"><b>Beoordeling</b><span>${escapeHtml(s.rating)} ★</span></div>`);
        rows.push(`<div class="sheetRow"><b>Laadsnelheid</b><span>${escapeHtml(s.power||s.status||'check live')}</span></div>`);
        if(s.openNow!==undefined) rows.push(`<div class="sheetRow"><b>Nu</b><span>${s.openNow?'open':'mogelijk gesloten'}</span></div>`);
        descEl.innerHTML=`${escapeHtml(s.desc||'')}<div class="sheetList">${rows.join('')}</div>`;
      }else{descEl.textContent=s.desc||'';}
      const primary=document.querySelector('.sheetActions .primary');
      const secondary=document.querySelector('.sheetActions .secondary');
      const save=document.querySelector('.sheetActions .saveStop');
      if(primary) primary.textContent=actionText(s,false);
      if(secondary){
        secondary.textContent=actionText(s,true);
        secondary.hidden = s.type === 'fuel' || s.type === 'hotel';
        secondary.classList.toggle('is-hidden', s.type === 'fuel' || s.type === 'hotel');
      }
      if(save){const canSave=s.type&& !['destination','overview','stops','guide'].includes(s.type);save.textContent=canSave?'＋ Opslaan als stop':'＋ Tussenstop';save.disabled=!canSave;save.classList.toggle('is-disabled',!canSave);}
      updateSmartTopbar(s);
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
      markerLayer.clearLayers();liveGoogleFuelLayer.clearLayers();liveGoogleHotelLayer.clearLayers();markerRefs.length=0;selectedMarker=null;
      stops.forEach(s=>{if(isVisible(s)) registerMarker(s,markerLayer);});
      if(activeFilters.has('fuel')) liveGoogleFuelStops.forEach(s=>registerMarker(s,liveGoogleFuelLayer));
      if(activeFilters.has('hotel')) liveGoogleHotelStops.forEach(s=>registerMarker(s,liveGoogleHotelLayer));
      if(previous && previous.type!=='destination' && !isVisible(previous)){
        selectedMarker=null;
        updateSheet(destinationSheet);
        fit('filter-reset');
      }else if(previous && selectedMarker){
        selectedMarker.marker.setIcon(makeStopIcon(selectedMarker.stop,true,false));
      }
      if(activeFilters.has('fuel')) loadLiveGoogleFuelStations();
      if(activeFilters.has('hotel')) loadLiveGoogleHotels();
    }
    function renderLiveGoogleFuelMarkers(){
      liveGoogleFuelLayer.clearLayers();
      if(!activeFilters.has('fuel')) return;
      liveGoogleFuelStops.forEach(s=>registerMarker(s,liveGoogleFuelLayer));
    }

    function renderLiveGoogleHotelMarkers(){
      liveGoogleHotelLayer.clearLayers();
      if(!activeFilters.has('hotel')) return;
      liveGoogleHotelStops.forEach(s=>registerMarker(s,liveGoogleHotelLayer));
    }
    function currentRouteSamplePoints(maxPoints=14, options={}){
      const latlngs=routeMain.getLatLngs?.()||[];
      const source=latlngs.length?latlngs:route.map(p=>L.latLng(p[0],p[1]));
      const count=Math.max(3,Math.min(28,Number(maxPoints)||14));
      const includeEnds=options.includeEnds===true;
      if(!source||source.length<2) return [];

      const distances=[0];
      let total=0;
      for(let i=1;i<source.length;i++){
        const prev=source[i-1];
        const cur=source[i];
        total+=map.distance(prev,cur);
        distances.push(total);
      }
      if(!Number.isFinite(total)||total<=0) return [];

      function interpolateAt(target){
        let idx=1;
        while(idx<distances.length && distances[idx]<target) idx++;
        const before=Math.max(0,idx-1);
        const after=Math.min(source.length-1,idx);
        const d0=distances[before];
        const d1=distances[after];
        const ratio=d1>d0?(target-d0)/(d1-d0):0;
        const a=source[before];
        const b=source[after];
        return {
          lat:a.lat+(b.lat-a.lat)*ratio,
          lng:a.lng+(b.lng-a.lng)*ratio,
          progress:target/total,
          distanceFromStartMeters:Math.round(target)
        };
      }

      const points=[];
      const usable=count;
      for(let i=0;i<usable;i++){
        const fraction=includeEnds
          ? (usable===1?0.5:i/(usable-1))
          : ((i+1)/(usable+1));
        const p=interpolateAt(total*fraction);
        points.push({
          lat:Math.round(p.lat*1000000)/1000000,
          lng:Math.round(p.lng*1000000)/1000000,
          progress:Math.round(p.progress*1000)/1000,
          distanceFromStartMeters:p.distanceFromStartMeters
        });
      }
      return points;
    }
    function placesRequestKey(points, radiusMeters, mode){
      return [mode||'route', radiusMeters, ...points.map(p=>`${Math.round(p.lat*1000)/1000},${Math.round(p.lng*1000)/1000}`)].join('|');
    }
    function routeSpreadIndex(stop, buckets=10){
      const latlngs=routeMain.getLatLngs?.()||[];
      const source=latlngs.length?latlngs:route.map(p=>L.latLng(p[0],p[1]));
      if(!stop || !Array.isArray(stop.ll) || !source.length) return 0;
      const lat=Number(stop.ll[0]);
      const lng=Number(stop.ll[1]);
      let best=0;
      let bestD=Infinity;
      const step=Math.max(1,Math.floor(source.length/180));
      for(let i=0;i<source.length;i+=step){
        const p=source[i];
        const d=(p.lat-lat)*(p.lat-lat)+(p.lng-lng)*(p.lng-lng);
        if(d<bestD){bestD=d;best=i;}
      }
      return Math.max(0,Math.min(buckets-1,Math.floor((best/Math.max(1,source.length-1))*buckets)));
    }
    function spreadStopsAlongRoute(stopsList,{buckets=11,perBucket=2,maxTotal=18}={}){
      if(!Array.isArray(stopsList) || stopsList.length<=maxTotal) return stopsList;
      const bucketsMap=new Map();
      stopsList.forEach((stop,order)=>{
        const key=routeSpreadIndex(stop,buckets);
        if(!bucketsMap.has(key)) bucketsMap.set(key,[]);
        bucketsMap.get(key).push({...stop,__order:order});
      });
      for(const list of bucketsMap.values()){
        list.sort((a,b)=>(Number(b.rating||0)-Number(a.rating||0)) || (Number(b.userRatingCount||0)-Number(a.userRatingCount||0)) || (a.__order-b.__order));
      }
      const result=[];
      for(let round=0;round<perBucket;round++){
        for(let key=0;key<buckets;key++){
          const item=bucketsMap.get(key)?.[round];
          if(item){result.push(item);if(result.length>=maxTotal) break;}
        }
        if(result.length>=maxTotal) break;
      }
      return result.sort((a,b)=>routeSpreadIndex(a,buckets)-routeSpreadIndex(b,buckets)).map(({__order,...x})=>x);
    }
    function googleFuelMessage(data, count){
      if(data?.cached) return count ? `${count} tankstations uit cache` : 'Geen tankstations in cache';
      if(data?.status==='misconfigured') return 'Google key ontbreekt in backend';
      if(data?.status==='partial_error') return count ? `${count} tankstations geladen` : 'Google Places gaf geen resultaten';
      if(data?.status==='empty') return 'Geen tankstations langs route gevonden';
      if(data?.status==='live') return `${count} live tankstations langs route`;
      return count ? `${count} tankstations langs route` : 'Geen tankstations langs route gevonden';
    }


    function googleHotelMessage(data, count){
      if(data?.cached) return count ? `${count} hotels uit cache` : 'Geen hotels in cache';
      if(data?.status==='misconfigured') return 'Google key ontbreekt in backend';
      if(data?.status==='partial_error') return count ? `${count} hotels geladen` : 'Google Places gaf geen hotels';
      if(data?.status==='empty') return 'Geen hotels langs route gevonden';
      if(data?.status==='live') return `${count} live hotels langs route`;
      return count ? `${count} hotels langs route` : 'Geen hotels langs route gevonden';
    }

    async function loadLiveGoogleHotels(){
      if(liveGoogleHotelLoaded||liveGoogleHotelLoading) return;
      liveGoogleHotelLoading=true;
      try{
        showToast('Hotels langs route zoeken…');
        const points=currentRouteSamplePoints(18,{includeEnds:false});
        const requestKey=placesRequestKey(points,16000,'route_planning');
        if(liveGoogleHotelLoaded && liveGoogleHotelKey===requestKey){
          liveGoogleHotelLoading=false;
          renderLiveGoogleHotelMarkers();
          return;
        }
        if(!points.length){
          liveGoogleHotelLoading=false;
          showToast('Nog geen routepunten beschikbaar');
          return;
        }

        const requestId=++liveGoogleHotelRequestId;
        const controller = new AbortController();
        const timer = setTimeout(()=>controller.abort(), 12000);
        const res=await fetch('/api/google-hotels',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          signal: controller.signal,
          body:JSON.stringify({points,radiusMeters:16000,mode:'route_planning'})
        });
        clearTimeout(timer);

        const data=await res.json().catch(()=>({ok:false,status:'invalid_json',places:[]}));
        if(requestId!==liveGoogleHotelRequestId) return;
        if(!res.ok) throw new Error(data.error||data.message||'Google Hotels API fout');
        if(data.ok===false){
          console.warn('Google hotels backend status:', data.status, data.message || data.errors || '');
        }

        liveGoogleHotelStops=spreadStopsAlongRoute((data.places||[]).map(p=>({
          name:p.name||'Hotel langs route',
          meta:[p.address||'Langs je route',p.rating?`${p.rating} ★`:'',p.detourLabel||'± 5 min van route'].filter(Boolean).join(' · '),
          desc:'',
          type:'hotel',label:'Hotel langs route',ll:[Number(p.lat),Number(p.lng)],provider:p.provider||'Google Places',
          status:p.status||'beschikbaarheid checken',openNow:p.openNow,rating:p.rating||null,userRatingCount:p.userRatingCount||null,
          detourLabel:p.detourLabel||'± 5 min van route',priceLevel:p.priceLevel||null,
          amenities:Array.isArray(p.amenities)?p.amenities:[],
          googlePlaceId:p.id||p.place_id||p.googlePlaceId||null,
          googleMapsUri:p.googleMapsUri||null,
          photoName:p.photoName||null,
          photoNames:Array.isArray(p.photoNames)?p.photoNames:[],
          photoUrl:p.photoUrl||p.photo||p.imageUrl||p.image||null,
          photoUrls:Array.isArray(p.photoUrls)?p.photoUrls:[],
          infoUrl:p.googleMapsUri||p.url||p.website||p.websiteUri||null
        })).filter(p=>Number.isFinite(p.ll[0])&&Number.isFinite(p.ll[1])),{buckets:12,perBucket:2,maxTotal:18});

        liveGoogleHotelLoaded=true;
        liveGoogleHotelKey=requestKey;
        liveGoogleHotelLoading=false;
        renderLiveGoogleHotelMarkers();
        showToast(googleHotelMessage(data, liveGoogleHotelStops.length));
      }catch(err){
        liveGoogleHotelLoading=false;
        console.warn('Live Google hotels fout:',err);
        showToast(err?.name==='AbortError'?'Google hotels timeout':'Google hotels niet geladen');
      }
    }

    async function loadLiveGoogleFuelStations(){
      if(liveGoogleFuelLoaded||liveGoogleFuelLoading) return;
      liveGoogleFuelLoading=true;
      try{
        showToast('Tankstations dicht langs route zoeken…');
        const points=currentRouteSamplePoints(14,{includeEnds:false});
        const requestKey=placesRequestKey(points,7000,'route_quick');
        if(liveGoogleFuelLoaded && liveGoogleFuelKey===requestKey){
          liveGoogleFuelLoading=false;
          renderLiveGoogleFuelMarkers();
          return;
        }
        if(!points.length){
          liveGoogleFuelLoading=false;
          showToast('Nog geen routepunten beschikbaar');
          return;
        }

        const requestId=++liveGoogleFuelRequestId;
        const controller = new AbortController();
        const timer = setTimeout(()=>controller.abort(), 11000);
        const res=await fetch('/api/google-fuel',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          signal: controller.signal,
          body:JSON.stringify({points,radiusMeters:7000,mode:'route_quick'})
        });
        clearTimeout(timer);

        const data=await res.json().catch(()=>({ok:false,status:'invalid_json',places:[]}));
        if(requestId!==liveGoogleFuelRequestId) return;
        if(!res.ok) throw new Error(data.error||data.message||'Google Fuel API fout');

        if(data.ok===false){
          console.warn('Google fuel backend status:', data.status, data.message || data.errors || '');
        }

        liveGoogleFuelStops=(data.places||[]).map(p=>({
          name:p.name||'Tankstation',
          meta:[p.address||'Langs je route',p.rating?`${p.rating} ★`:'',p.openNow===true?'Nu open':''].filter(Boolean).join(' · '),
          desc:'',
          type:'fuel',label:'Premium tankstop',ll:[Number(p.lat),Number(p.lng)],provider:p.provider||'Google Places',
          brand:p.brand||inferFuelBrand(p.name),
          status:p.status||(p.openNow===true?'nu open':p.openNow===false?'mogelijk gesloten':'openingstijden checken'),openNow:p.openNow,rating:p.rating||null,
          detourLabel:p.detourLabel||p.detour||'± 2 min van route',
          fuelPrice:p.fuelPrice||p.priceLabel||p.price||null,
          amenities:Array.isArray(p.amenities)?p.amenities:[],
          googlePlaceId:p.id||p.place_id||p.googlePlaceId||null,
          googleMapsUri:p.googleMapsUri||null,
          photoName:p.photoName||null,
          photoUrl:p.photoUrl||p.photo||p.imageUrl||p.image||null,
          infoUrl:p.googleMapsUri||p.url||p.website||p.websiteUri||null
        })).filter(p=>Number.isFinite(p.ll[0])&&Number.isFinite(p.ll[1]));

        liveGoogleFuelLoaded=true;
        liveGoogleFuelKey=requestKey;
        liveGoogleFuelLoading=false;
        renderLiveGoogleFuelMarkers();
        showToast(googleFuelMessage(data, liveGoogleFuelStops.length));
      }catch(err){
        liveGoogleFuelLoading=false;
        console.warn('Live Google tankstations fout:',err);
        showToast(err?.name==='AbortError'?'Google tankstations timeout':'Google tankstations niet geladen');
      }
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
    function syncCatUI(){document.querySelectorAll('.cat[data-filter]').forEach(btn=>{const f=btn.dataset.filter;btn.classList.toggle('active',activeFilters.has(f));btn.classList.toggle('is-muted',!activeFilters.has(f));});document.getElementById('stopsCta')?.classList.toggle('has-active',activeFilters.size>0);}
    function setFilters(filters){
      if(!Array.isArray(filters)||!filters.length){activeFilters=new Set();}
      else{activeFilters=new Set(filters);activeFilters.delete('all');}
      syncCatUI();renderMarkers();if(activeFilters.has('fuel')) loadLiveGoogleFuelStations();if(activeFilters.has('hotel')) loadLiveGoogleHotels();
    }
    document.querySelectorAll('.cat[data-filter]').forEach(btn=>{btn.addEventListener('click',()=>{const f=btn.dataset.filter;activeFilters.has(f)?activeFilters.delete(f):activeFilters.add(f);syncCatUI();renderMarkers();if(f==='fuel'&&activeFilters.has('fuel')){showToast(liveGoogleFuelLoaded?'Tankstations zichtbaar':'Tankstations langs route zoeken…');loadLiveGoogleFuelStations();return;}if(f==='hotel'&&activeFilters.has('hotel')){showToast(liveGoogleHotelLoaded?'Hotels zichtbaar':'Hotels langs route zoeken…');loadLiveGoogleHotels();return;}showToast(activeFilters.size?'Categorie bijgewerkt':'Kaart weer clean');});});
    document.getElementById('stopsCta')?.addEventListener('click',toggleCategories);

    async function loadOrsRoute(){
      const requestId=++routeRequestId;
      try{
        showToast('Echte route laden…');
        const profile=window.RoadoraState?.profile||document.querySelector('.rVehicle.active')?.dataset.profile||document.querySelector('.vehicle.active')?.dataset.profile||'driving-car';
        const params=new URLSearchParams({start:'4.4777,51.9244',end:'11.4041,47.2692',profile});
        const res=await fetch('/api/route?'+params.toString(),{headers:{Accept:'application/json'}});
        if(!res.ok) throw new Error('ORS '+res.status);
        const data=await res.json();
        if(requestId!==routeRequestId) return;
        const feature=data.features&&data.features[0];
        const coords=feature?.geometry?.coordinates;
        if(!Array.isArray(coords)||coords.length<2) throw new Error('Geen route geometry');
        const latlngs=coords.map(c=>[c[1],c[0]]);
        routeShadow.setLatLngs(latlngs);routeMain.setLatLngs(latlngs);routeHighlight.setLatLngs(latlngs);
        liveGoogleFuelLoaded=false;liveGoogleFuelKey='';liveGoogleFuelStops=[];liveGoogleFuelLayer.clearLayers();
        liveGoogleHotelLoaded=false;liveGoogleHotelKey='';liveGoogleHotelStops=[];liveGoogleHotelLayer.clearLayers();
        if(activeFilters.has('fuel')) setTimeout(loadLiveGoogleFuelStations,250);
        if(activeFilters.has('hotel')) setTimeout(loadLiveGoogleHotels,300);
        const summary=feature.properties?.summary||data.routes?.[0]?.summary||{};
        const km=summary.distance?Math.round(summary.distance/1000).toLocaleString('nl-NL')+' km':null;
        const min=summary.duration?Math.round(summary.duration/60):null;
        const time=min?(Math.floor(min/60)+'u '+String(min%60).padStart(2,'0')+'m'):null;
        const statKm=document.querySelector('.routePanel .stat:nth-child(2) b'); if(statKm&&km) statKm.textContent=km;
        if(km) routeDistanceLabel=km;
        if(time) routeTimeLabel=time;
        if(km||time){destinationSheet.meta=[km,time].filter(Boolean).join(' · ');destinationSheet.desc='Je echte ORS-route naar Innsbruck is geladen. Onderweg kun je hotels, laadstops en eten als context in dit blok openen.';if(!selectedMarker) updateSheet(destinationSheet);else updateSmartTopbar(selectedStopData);}
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
      updateTopbar:()=>updateSmartTopbar(selectedStopData||destinationSheet),
      getSelectedStop:()=>selectedStopData,
      toggleCategories,
      closeCategories:()=>setCategoriesOpen(false)
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
