/* Roadora v7.3.0 Production Places Layer
   - Gebaseerd op v7.2.4 Data & State Cleanup
   - Geen visuele redesigns en geen Maps-export wijzigingen
   - Demo-hotels uit de hotelplanner verwijderd; hotels komen uit Places-op-kaart of opgeslagen shortlist

   Roadora v7.0.2 Stop Focus Context Fix
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

  function injectSavedHotelsMobilePolish(){
    if(document.getElementById('roadoraSavedHotelsMobilePolish')) return;
    const style=document.createElement('style');
    style.id='roadoraSavedHotelsMobilePolish';
    style.textContent=`
      .hotelCompareSheet .hotelCompareCard{max-height:min(72vh,620px);overflow:hidden;padding-bottom:18px}
      .hotelCompareSheet .hotelCompareList{display:grid;gap:10px;max-height:calc(72vh - 130px);overflow:auto;padding-right:2px}
      .hotelCompareSheet .hotelCompareItem{display:grid;grid-template-columns:minmax(0,1fr) 44px;align-items:center;gap:10px}
      .hotelCompareSheet .hotelCompareOpen{min-width:0;width:100%;display:grid;grid-template-columns:72px minmax(0,1fr);align-items:center;gap:12px;text-align:left}
      .hotelCompareSheet .hotelCompareText{min-width:0;display:block}
      .hotelCompareSheet .hotelCompareText b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.16}
      .hotelCompareSheet .hotelCompareText em{display:block;font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.22;opacity:.72}
      .hotelCompareSheet .hotelCompareText small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2;opacity:.62}
      .hotelCompareSheet .hotelCompareThumb{width:72px;height:72px;flex:0 0 72px;background-size:cover;background-position:center;border-radius:18px}
      .hotelCompareSheet .hotelCompareDelete{width:42px;height:42px;border-radius:999px;display:grid;place-items:center;font-size:24px;line-height:1}
      .hotelCompareSheet .hotelCompareHead b{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      @media (max-width:520px){
        .hotelCompareSheet .hotelCompareCard{width:calc(100vw - 32px);left:16px;right:16px;border-radius:28px}
        .hotelCompareSheet .hotelCompareOpen{grid-template-columns:64px minmax(0,1fr);gap:10px;padding:9px 10px}
        .hotelCompareSheet .hotelCompareThumb{width:64px;height:64px;border-radius:16px}
        .hotelCompareSheet .hotelCompareDelete{width:38px;height:38px;font-size:22px}
        .hotelCompareSheet .hotelCompareText b{font-size:15px}
        .hotelCompareSheet .hotelCompareText em,.hotelCompareSheet .hotelCompareText small{font-size:12px}
      }
    `;
    document.head.appendChild(style);
  }

  function compactHotelAddress(h){
    const raw=String(h?.address||h?.meta||'').replace(/\s+/g,' ').trim();
    if(!raw) return 'Adres beschikbaar in hotel details';
    return raw.split(' · ')[0].replace(/,\s*Germany$/i,', Duitsland');
  }

  function savedHotelMetaLine(h){
    return [h?.rating?`${h.rating} ★`:'Google rating',h?.detourLabel||'± 10 min van route'].filter(Boolean).join(' · ');
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
    // v7.0.6: alle route/navigatie-CTA's gebruiken dezelfde locked Roadora Maps-export.
    // Zo opent de bottom Navigeer-knop exact dezelfde volledige roadtrip-route als
    // "Start in Google Maps" vanuit Mijn Roadtrip, inclusief gekozen tussenstops.
    if(window.RoadoraMapsExport?.open){
      window.RoadoraMapsExport.open('nav');
      return false;
    }
    try{
      const trip=JSON.parse(localStorage.getItem('roadoraRoadtripV1')||'{}');
      const stops=Array.isArray(trip.stops)?trip.stops:[];
      const params=new URLSearchParams();
      params.set('api','1');
      params.set('destination',trip.destination||'Innsbruck, Oostenrijk');
      params.set('travelmode','driving');
      const waypoints=stops.map(s=>Array.isArray(s?.ll)?`${Number(s.ll[0]).toFixed(6)},${Number(s.ll[1]).toFixed(6)}`:s?.name).filter(Boolean).slice(0,9);
      if(waypoints.length) params.set('waypoints',waypoints.join('|'));
      window.open('https://www.google.com/maps/dir/?'+params.toString(),'_blank','noopener');
    }catch(_){
      window.open('https://www.google.com/maps/dir/?api=1&destination=Innsbruck%2C%20Oostenrijk&travelmode=driving','_blank','noopener');
    }
    toast('Google Maps route geopend');
    return false;
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
    injectSavedHotelsMobilePolish();
    const list=qs('.hotelCompareList',el);
    if(list){
      list.innerHTML=hotels.length?hotels.slice(0,10).map(h=>{
        const photo=firstStopPhoto(h);
        const id=escapeHtml(h.id||h.googlePlaceId||`${h.type}:${h.name}`);
        const meta=escapeHtml(savedHotelMetaLine(h));
        const address=escapeHtml(compactHotelAddress(h));
        return `<div class="hotelCompareItem" data-save-id="${id}">
          <button class="hotelCompareOpen" data-compare-action="open" data-save-id="${id}" aria-label="Open ${escapeHtml(h.name||'hotel')}">
            <span class="hotelCompareThumb ${photo?'has-photo':''}" style="${photo?`background-image:linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.22)),url('${String(photo).replace(/'/g,'')}')`:''}"></span>
            <span class="hotelCompareText">
              <b>${escapeHtml(h.name||'Hotel')}</b>
              <em>${meta}</em>
              <small>${address}</small>
            </span>
          </button>
          <button class="hotelCompareDelete" data-compare-action="delete" data-save-id="${id}" aria-label="Hotel verwijderen">×</button>
        </div>`;
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
    if(bottomNav){event.preventDefault();setActiveBottomNav(bottomNav);const label=(bottomNav.textContent||'').trim().toLowerCase();if(label.includes('route')){window.RoadoraMapApi?.clearSelection?.();window.RoadoraMapApi?.fitRoute?.('nav');toast('Volledige route in beeld');return false;}if(label.includes('overzicht')){setSheet('overview');return false;}if(label.includes('navigeer')){openMapsRoute();return false;}if(label.includes('stops')){window.RoadoraMapApi?.toggleCategories?.();return false;}if(label.includes('reisgids')){setSheet('guide');return false;}return false;}
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
    if(target.closest('#mapScreen .primary')){event.preventDefault();const s=selectedStop(); if(!s || ['destination','overview','stops','guide'].includes(s?.type)) return openMapsRoute(); if(s?.type==='hotel') return openHotelDetail(); openMapsStop(); return false;}
    if(target.closest('#mapScreen .secondary')){event.preventDefault();const s=selectedStop(); if(s?.type==='hotel') openMapsStop(); else openMoreInfo(); return false;}
  }

  window.RoadoraApp={showHome:()=>setScreen('home'),showRoute:()=>setScreen('route'),showMap:()=>setScreen('map'),closeMenu,setVehicle};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{setButtonType();injectSavedHotelsMobilePolish();},{once:true}); else {setButtonType();injectSavedHotelsMobilePolish();}
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
    // v7.3.3 Production Stops Cleanup:
    // Geen demo/fallback-pins meer in productie. Categorieën tonen alleen live/API-data.
    // Fuel/hotel hebben live Google Places lagen; EV/eten/uitjes/WC krijgen later eigen live endpoints.
    const stops=[];
    const liveCategorySupport=new Set(['fuel','hotel']);
    const destinationSheet={name:'Innsbruck, Oostenrijk',meta:'Route wordt geladen…',desc:'Je route naar Innsbruck is gepland. Kies onderweg een categorie of stop om details in dit blok te bekijken.',type:'destination',label:'Eindbestemming',ll:[47.2692,11.4041]};
    const svgs={fuel:'<svg viewBox="0 0 24 24"><path d="M7 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M8 9h8M17 8h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2M7 21h10"/></svg>',ev:'<svg viewBox="0 0 24 24"><path d="M13 2L5 13h6l-1 9 8-12h-6l1-8z"/></svg>',food:'<svg viewBox="0 0 24 24"><path d="M7 3v8M11 3v8M7 7h4M9 11v10M17 3v18M17 3c3 3 3 7 0 9"/></svg>',hotel:'<svg viewBox="0 0 24 24"><path d="M3 11h18v8M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M7 11V9h4v2"/></svg>',view:'<svg viewBox="0 0 24 24"><path d="M3 20l7-14 4 8 2-4 5 10H3z"/></svg>',wc:'<svg viewBox="0 0 24 24"><path d="M7 4h10M8 4v5a4 4 0 0 0 8 0V4M10 13v7M14 13v7M9 20h6"/></svg>'};

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
    function findMarkerRefForStop(stop){
      const key=stopKey(stop);
      return markerRefs.find(ref=>ref?.stop && stopKey(ref.stop)===key) || null;
    }
    function preserveStopContext(){
      // v7.0.2: stop-focus is a visual focus state, not a filter reset.
      // Keep all currently loaded category markers visible so users can switch stops directly.
      document.getElementById('mapScreen')?.classList.add('stopFocusContextV702');
    }
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

      if(type==='wc') return {
        state:'wc',
        title:stop?.name||'WC stop',
        badge:'WC dichtbij',
        sub:`Comfortstop · ${cleanMetaPart(stop,'langs route')}`,
        eta:'Korte stop',
        distance:'Langs route',
        next:'Toilet / pauze'
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
      const photo =
        s?.photoUrl ||
        s?.photo ||
        s?.imageUrl ||
        s?.image ||
        (Array.isArray(s?.photoUrls) ? s.photoUrls[0] : '') ||
        '';
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
        if(type==='wc') return 'ⓘ Details';
        if(type==='view') return 'ⓘ Bekijk plek';
        return 'ⓘ Meer informatie';
      }
      if(type==='destination') return '⌁ Navigeer naar bestemming';
      if(type==='hotel') return 'Bekijk hotel';
      if(type==='fuel') return '➤ Navigeer';
      if(type==='ev') return '⌁ Navigeer naar laadstation';
      if(type==='food') return '⌁ Navigeer naar restaurant';
      if(type==='wc') return '⌁ Navigeer naar WC';
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
      preserveStopContext();
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
      if(activeFilters.has('hotel')) sanitizeGoogleHotels(liveGoogleHotelStops).forEach(s=>registerMarker(s,liveGoogleHotelLayer));
      if(previous && previous.type!=='destination' && !isVisible(previous)){
        selectedMarker=null;
        // Keep category state intact. Only return the sheet to route context when the active category no longer contains the selected stop.
        updateSheet(destinationSheet);
      }else if(previous && selectedMarker){
        selectedMarker.marker.setIcon(makeStopIcon(selectedMarker.stop,true,false));
        preserveStopContext();
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
      liveGoogleHotelStops=sanitizeGoogleHotels(liveGoogleHotelStops);
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


    // v7.3.4 Production Places Layer: één contract voor Places-resultaten.
    // Hotels/tankstations gebruiken dezelfde loading/error/cache-flow. Maps-export blijft los en locked.
    const PLACES_CACHE_KEY='roadoraPlacesCacheV3';
    const PLACES_CACHE_TTL_MINUTES={hotel:180,fuel:120};
    const PLACES_CACHE_MAX_ENTRIES=28;
    const placesUiState={hotel:'idle',fuel:'idle'};
    function safePlacesCacheRead(){
      try{return JSON.parse(localStorage.getItem(PLACES_CACHE_KEY)||'{}')||{};}
      catch(_){return {};}
    }
    function safePlacesCacheWrite(cache){
      try{localStorage.setItem(PLACES_CACHE_KEY,JSON.stringify(cache||{}));return true;}
      catch(_){return false;}
    }
    function placesCacheId(category,key){return `${category}:${key}`;}
    function compactPlacesCache(cache){
      const entries=Object.entries(cache||{}).sort((a,b)=>Number(b[1]?.savedAt||0)-Number(a[1]?.savedAt||0));
      return Object.fromEntries(entries.slice(0,PLACES_CACHE_MAX_ENTRIES));
    }
    function readPlacesCacheEntry(category,key,maxAgeMinutes=90,allowStale=false){
      const cache=safePlacesCacheRead();
      const entry=cache[placesCacheId(category,key)];
      if(!entry || !Array.isArray(entry.items)) return null;
      const age=Date.now()-Number(entry.savedAt||0);
      if(!Number.isFinite(age) || age<0) return null;
      const isFresh=age<=maxAgeMinutes*60*1000;
      if(!isFresh && !allowStale) return null;
      return {...entry,isFresh,ageMinutes:Math.round(age/60000)};
    }
    function readPlacesCache(category,key,maxAgeMinutes=90,allowStale=false){
      return readPlacesCacheEntry(category,key,maxAgeMinutes,allowStale)?.items || null;
    }
    function writePlacesCache(category,key,items,status='ok'){
      const cache=safePlacesCacheRead();
      cache[placesCacheId(category,key)]={items:Array.isArray(items)?items:[],savedAt:Date.now(),version:3,status};
      safePlacesCacheWrite(compactPlacesCache(cache));
    }
    function setPlaceCategoryState(category,state,message){
      placesUiState[category]=state;
      const btn=document.querySelector(`.cat[data-filter="${category}"]`);
      if(btn){
        btn.dataset.placeState=state;
        btn.classList.toggle('is-loading',state==='loading');
        btn.classList.toggle('is-error',state==='error');
        btn.classList.toggle('is-empty',state==='empty');
        if(message) btn.title=message;
      }
      const cta=document.getElementById('stopsCta');
      if(cta && activeFilters.has(category)) cta.dataset.placeState=state;
    }
    function placesEmptyMessage(category){
      return category==='hotel'?'Geen hotels langs deze route gevonden':'Geen tankstations langs deze route gevonden';
    }
    function placesErrorMessage(category,err){
      if(err?.name==='AbortError') return category==='hotel'?'Hotels laden duurde te lang':'Tankstations laden duurde te lang';
      return category==='hotel'?'Hotels niet geladen':'Tankstations niet geladen';
    }
    function normalizePlacesResult(p,type){
      const lat=Number(p?.lat), lng=Number(p?.lng);
      const base={
        name:p?.name || (type==='hotel'?'Hotel langs route':'Tankstation'),
        meta:[p?.address||'Langs je route',p?.rating?`${p.rating} ★`:'',type==='hotel'?(p?.detourLabel||'± 5 min van route'):(p?.openNow===true?'Nu open':'')].filter(Boolean).join(' · '),
        desc:'',
        type,
        label:type==='hotel'?'Hotel langs route':'Premium tankstop',
        ll:[lat,lng],
        provider:p?.provider||'Google Places',
        status:p?.status||(p?.openNow===true?'nu open':p?.openNow===false?'mogelijk gesloten':'openingstijden checken'),
        openNow:p?.openNow,
        rating:p?.rating||null,
        amenities:Array.isArray(p?.amenities)?p.amenities:[],
        googlePlaceId:p?.id||p?.place_id||p?.googlePlaceId||null,
        googleMapsUri:p?.googleMapsUri||null,
        photoName:p?.photoName||null,
        photoUrl:p?.photoUrl||p?.photo||p?.imageUrl||p?.image||null,
        infoUrl:p?.googleMapsUri||p?.url||p?.website||p?.websiteUri||null,
        source:'google-places'
      };
      if(type==='hotel'){
        base.userRatingCount=p?.userRatingCount||null;
        base.detourLabel=p?.detourLabel||'± 5 min van route';
        base.priceLevel=p?.priceLevel||null;
        base.photoNames=Array.isArray(p?.photoNames)?p.photoNames:[];
        base.photoUrls=Array.isArray(p?.photoUrls)?p.photoUrls:[];
      }else{
        base.brand=p?.brand||inferFuelBrand(p?.name);
        base.detourLabel=p?.detourLabel||p?.detour||'± 2 min van route';
        base.fuelPrice=p?.fuelPrice||p?.priceLabel||p?.price||null;
      }
      return base;
    }
    function normalizePlacesList(list,type){
      return (Array.isArray(list)?list:[]).map(p=>normalizePlacesResult(p,type)).filter(p=>Number.isFinite(p.ll[0])&&Number.isFinite(p.ll[1]));
    }

    function isRealGoogleHotel(stop){
      if(!stop || stop.type!=='hotel') return false;
      const name=String(stop.name||'').toLowerCase();
      const blocked=[
        'hotel bij ulm',
        'roadora hotel',
        'alpenstop',
        'heidelberg route hotel',
        'stuttgart family stay'
      ];
      if(blocked.some(x=>name.includes(x))) return false;
      // Productie-regel: hotelpins mogen alleen uit echte Places-data/cache komen.
      return stop.source==='google-places' || !!stop.googlePlaceId || !!stop.googleMapsUri;
    }
    function sanitizeGoogleHotels(list){
      return (Array.isArray(list)?list:[]).filter(isRealGoogleHotel);
    }

    async function loadLiveGoogleHotels(){
      if(liveGoogleHotelLoaded||liveGoogleHotelLoading) return;
      const points=currentRouteSamplePoints(18,{includeEnds:false});
      const requestKey=placesRequestKey(points,16000,'route_planning');
      if(liveGoogleHotelLoaded && liveGoogleHotelKey===requestKey){renderLiveGoogleHotelMarkers();return;}
      if(!points.length){showToast('Nog geen routepunten beschikbaar');setPlaceCategoryState('hotel','empty','Routepunten ontbreken');return;}

      liveGoogleHotelKey=requestKey;
      const ttl=PLACES_CACHE_TTL_MINUTES.hotel;
      const freshCached=sanitizeGoogleHotels(readPlacesCache('hotel',requestKey,ttl,false)||[]);
      if(freshCached.length){
        liveGoogleHotelStops=freshCached;
        liveGoogleHotelLoaded=true;
        renderLiveGoogleHotelMarkers();
        setPlaceCategoryState('hotel','ready',`${freshCached.length} hotels uit cache`);
        showToast(`${freshCached.length} hotels uit cache`);
        return;
      }

      liveGoogleHotelLoading=true;
      setPlaceCategoryState('hotel','loading','Hotels langs route laden…');
      try{
        showToast('Hotels langs route zoeken…');
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
        if(data.ok===false) console.warn('Google hotels backend status:', data.status, data.message || data.errors || '');

        liveGoogleHotelStops=sanitizeGoogleHotels(spreadStopsAlongRoute(normalizePlacesList(data.places,'hotel'),{buckets:12,perBucket:2,maxTotal:18}));
        writePlacesCache('hotel',requestKey,liveGoogleHotelStops,data.status||'live');
        liveGoogleHotelLoaded=true;
        liveGoogleHotelLoading=false;
        renderLiveGoogleHotelMarkers();
        setPlaceCategoryState('hotel',liveGoogleHotelStops.length?'ready':'empty',googleHotelMessage(data, liveGoogleHotelStops.length));
        showToast(googleHotelMessage(data, liveGoogleHotelStops.length));
      }catch(err){
        liveGoogleHotelLoading=false;
        const stale=sanitizeGoogleHotels(readPlacesCache('hotel',requestKey,24*60,true)||[]);
        if(stale.length){
          liveGoogleHotelStops=stale;
          liveGoogleHotelLoaded=true;
          renderLiveGoogleHotelMarkers();
          setPlaceCategoryState('hotel','cached',`${stale.length} hotels uit oudere cache`);
          showToast(`${stale.length} hotels uit oudere cache`);
          return;
        }
        liveGoogleHotelStops=[];
        renderLiveGoogleHotelMarkers();
        setPlaceCategoryState('hotel','error',placesErrorMessage('hotel',err));
        console.warn('Live Google hotels fout:',err);
        showToast(placesErrorMessage('hotel',err));
      }
    }

    async function loadLiveGoogleFuelStations(){
      if(liveGoogleFuelLoaded||liveGoogleFuelLoading) return;
      const points=currentRouteSamplePoints(14,{includeEnds:false});
      const requestKey=placesRequestKey(points,7000,'route_quick');
      if(liveGoogleFuelLoaded && liveGoogleFuelKey===requestKey){renderLiveGoogleFuelMarkers();return;}
      if(!points.length){showToast('Nog geen routepunten beschikbaar');setPlaceCategoryState('fuel','empty','Routepunten ontbreken');return;}

      liveGoogleFuelKey=requestKey;
      const ttl=PLACES_CACHE_TTL_MINUTES.fuel;
      const freshCached=readPlacesCache('fuel',requestKey,ttl,false)||[];
      if(freshCached.length){
        liveGoogleFuelStops=freshCached;
        liveGoogleFuelLoaded=true;
        renderLiveGoogleFuelMarkers();
        setPlaceCategoryState('fuel','ready',`${freshCached.length} tankstations uit cache`);
        showToast(`${freshCached.length} tankstations uit cache`);
        return;
      }

      liveGoogleFuelLoading=true;
      setPlaceCategoryState('fuel','loading','Tankstations langs route laden…');
      try{
        showToast('Tankstations dicht langs route zoeken…');
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
        if(data.ok===false) console.warn('Google fuel backend status:', data.status, data.message || data.errors || '');

        liveGoogleFuelStops=normalizePlacesList(data.places,'fuel');
        writePlacesCache('fuel',requestKey,liveGoogleFuelStops,data.status||'live');
        liveGoogleFuelLoaded=true;
        liveGoogleFuelLoading=false;
        renderLiveGoogleFuelMarkers();
        setPlaceCategoryState('fuel',liveGoogleFuelStops.length?'ready':'empty',googleFuelMessage(data, liveGoogleFuelStops.length));
        showToast(googleFuelMessage(data, liveGoogleFuelStops.length));
      }catch(err){
        liveGoogleFuelLoading=false;
        const stale=readPlacesCache('fuel',requestKey,24*60,true)||[];
        if(stale.length){
          liveGoogleFuelStops=stale;
          liveGoogleFuelLoaded=true;
          renderLiveGoogleFuelMarkers();
          setPlaceCategoryState('fuel','cached',`${stale.length} tankstations uit oudere cache`);
          showToast(`${stale.length} tankstations uit oudere cache`);
          return;
        }
        liveGoogleFuelStops=[];
        renderLiveGoogleFuelMarkers();
        setPlaceCategoryState('fuel','error',placesErrorMessage('fuel',err));
        console.warn('Live Google tankstations fout:',err);
        showToast(placesErrorMessage('fuel',err));
      }
    }
    function fit(reason='route'){
      const now=Date.now();
      if(now-lastFitAt<160 && reason!=='force') return;
      lastFitAt=now;
      if(['route','force','nav','bottom-nav'].includes(String(reason))) document.getElementById('mapScreen')?.classList.remove('stopFocusContextV702');
      withProgrammaticMove(()=>{
        safeInvalidate();
        map.fitBounds(routeMain.getBounds(),mapPaddingFor('route'));
      });
    }
    function syncCatUI(){document.querySelectorAll('.cat[data-filter]').forEach(btn=>{const f=btn.dataset.filter;const active=activeFilters.has(f);btn.classList.toggle('active',active);btn.classList.toggle('is-muted',!active);if(!active){btn.classList.remove('is-loading','is-error','is-empty');delete btn.dataset.placeState;}});const cta=document.getElementById('stopsCta');if(cta){cta.classList.toggle('has-active',activeFilters.size>0);if(!activeFilters.size) delete cta.dataset.placeState;}}
    function setFilters(filters){
      if(!Array.isArray(filters)||!filters.length){activeFilters=new Set();}
      else{activeFilters=new Set(filters);activeFilters.delete('all');}
      syncCatUI();
      renderMarkers();
      const unsupported=[...activeFilters].filter(f=>!liveCategorySupport.has(f));
      if(unsupported.length){
        showToast('Alleen live locaties: '+unsupported.map(f=>({ev:'laadpunten',food:'eten',view:'uitjes',wc:'WC’s'}[f]||f)).join(', ')+' nog niet gekoppeld');
      }
      if(activeFilters.has('fuel')) loadLiveGoogleFuelStations();
      if(activeFilters.has('hotel')) loadLiveGoogleHotels();
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
        // v7.0.9: bewaar de echte ORS-samenvatting centraal. UI-lagen lezen hieruit,
        // zodat de topbar niet terugvalt op placeholders zoals "Aankomst —" of "Maps-ready".
        try{
          localStorage.setItem('roadoraRouteSummaryV1', JSON.stringify({
            distanceMeters: Number(summary.distance)||0,
            durationSeconds: Number(summary.duration)||0,
            distanceLabel: km || '',
            timeLabel: time || '',
            stopCount: (JSON.parse(localStorage.getItem('roadoraRoadtripV1')||'{}').stops||[]).length || 0,
            provisional: false,
            updatedAt: new Date().toISOString()
          }));
          window.dispatchEvent(new CustomEvent('roadora:route:update',{detail:{distanceLabel:km,timeLabel:time}}));
        }catch(_){ }
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
      clearSelection:()=>{document.getElementById('mapScreen')?.classList.remove('stopFocusContextV702');resetSelectedIcon();selectedMarker=null;updateSheet(destinationSheet);fit('force');},
      showPanel:(data)=>{
        if(data && Array.isArray(data.ll)){
          const ref=findMarkerRefForStop(data);
          if(ref){ selectStop(ref,false); return; }
          preserveStopContext();
        }
        resetSelectedIcon();selectedMarker=null;updateSheet(data);
      },
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

/* Roadora v5.3 — Hotel Tab Overnachtingsplanner
   - Hotels blijven in hamburger/menu en Home-card
   - Plaats + tijd + km input
   - Roadtrip-filters: huisdier, kindvriendelijk, laadpaal, parkeren, ontbijt, late check-in
   - Koppeling met kaartfilter Overnachten
*/
(function(){
  'use strict';
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));

  // v7.3.1: geen demo-hotels meer in de planner.
  // Echte hoteldata loopt via Google Places op de kaart of via opgeslagen shortlist.

  const filterLabels={
    charger:'⚡ Laadpaal', pet:'🐾 Huisdier', family:'👨‍👩‍👧 Kindvriendelijk', parking:'🅿️ Parkeren', breakfast:'🍳 Ontbijt', late:'🌙 Late check-in'
  };

  function toast(msg){ window.RoadoraToast ? window.RoadoraToast(msg) : console.log(msg); }

  function ensureMenuItems(){
    const menu=qs('#sideMenu');
    if(menu && !qs('[data-action="hotels"]',menu)){
      const btn=document.createElement('button');
      btn.className='sideItem';
      btn.dataset.action='hotels';
      btn.type='button';
      btn.innerHTML='<svg fill="none" viewBox="0 0 24 24"><path d="M4 11h16v9M4 20V7M20 20v-5H4M7 11V8h5v3" stroke="currentColor"></path></svg><span>Hotels</span>';
      const route=qs('[data-action="route"]',menu);
      route?.insertAdjacentElement('afterend',btn) || menu.appendChild(btn);
    }
  }

  function ensureHotelScreen(){
    let screen=qs('#hotelPlannerScreen');
    if(screen) return screen;
    const phone=qs('.phone');
    if(!phone) return null;
    screen=document.createElement('section');
    screen.id='hotelPlannerScreen';
    screen.className='appScreen hotelPlannerScreen';
    screen.setAttribute('aria-label','Hotels plannen');
    screen.innerHTML=`
      <div class="hotelPlannerInner">
        <header class="hotelPlannerTop">
          <button class="hotelPlannerIcon" data-menu-open type="button" aria-label="Menu openen">☰</button>
          <button class="hotelPlannerIcon" data-hotel-planner-action="back" type="button" aria-label="Terug">‹</button>
          <div class="hotelPlannerBrand"><span>🏨</span><b>Hotels</b><small>Overnachtingen plannen</small></div>
        </header>

        <section class="hotelPlannerHero">
          <small>Roadora hotelplanner</small>
          <h1>Vind een hotel dat logisch ligt voor je rit.</h1>
          <p>Zoek op plaats, rijtijd of afstand en filter op wat onderweg echt belangrijk is.</p>
        </section>

        <section class="hotelPlannerCard">
          <label class="hotelPlannerLabel">Plaats of regio</label>
          <div class="hotelPlannerSearch">
            <input id="hotelPlaceInput" placeholder="Bijv. Ulm, München, Innsbruck" autocomplete="off" />
            <button data-hotel-planner-action="search" type="button">Zoek</button>
          </div>

          <div class="hotelPlannerModes" role="group" aria-label="Zoekmodus">
            <button class="active" data-hotel-mode="route" type="button">Langs route</button>
            <button data-hotel-mode="time" type="button">Na tijd</button>
            <button data-hotel-mode="km" type="button">Na km</button>
          </div>

          <div class="hotelPlannerRows">
            <div>
              <span class="hotelPlannerMiniLabel">Tijd rijden</span>
              <div class="hotelPlannerChips" data-chip-group="time">
                <button data-time="3" type="button">3u</button>
                <button data-time="5" class="active" type="button">5u</button>
                <button data-time="7" type="button">7u</button>
              </div>
            </div>
            <div>
              <span class="hotelPlannerMiniLabel">Afstand</span>
              <div class="hotelPlannerChips" data-chip-group="km">
                <button data-km="400" type="button">400 km</button>
                <button data-km="600" class="active" type="button">600 km</button>
                <button data-km="800" type="button">800 km</button>
              </div>
            </div>
          </div>

          <div class="hotelPlannerFilters" aria-label="Hotelfilters">
            ${Object.entries(filterLabels).map(([key,label])=>`<button data-hotel-filter="${key}" type="button">${label}</button>`).join('')}
          </div>
        </section>

        <section class="hotelPlannerSuggestion">
          <span>Suggestie</span>
          <b id="hotelPlannerSuggestionTitle">Rond 600 km is Ulm een logische overnachtingszone.</b>
          <small id="hotelPlannerSuggestionText">Gebruik de kaart voor hotels langs je route, of vergelijk hieronder rustig opties.</small>
        </section>

        <div class="hotelPlannerActions">
          <button class="hotelPlannerPrimary" data-hotel-planner-action="map-hotels" type="button">Bekijk hotels op de kaart</button>
          <button class="hotelPlannerGhost" data-hotel-planner-action="shortlist" type="button">Shortlist</button>
        </div>

        <section class="hotelPlannerResults" id="hotelPlannerResults"></section>
      </div>`;
    phone.appendChild(screen);
    renderHotelCards();
    return screen;
  }

  function activeFilters(){
    return qsa('#hotelPlannerScreen [data-hotel-filter].active').map(b=>b.dataset.hotelFilter);
  }

  function currentPlanningText(){
    const place=(qs('#hotelPlaceInput')?.value||'').trim();
    const time=qs('#hotelPlannerScreen [data-chip-group="time"] .active')?.dataset.time || '5';
    const km=qs('#hotelPlannerScreen [data-chip-group="km"] .active')?.dataset.km || '600';
    const mode=qs('#hotelPlannerScreen [data-hotel-mode].active')?.dataset.hotelMode || 'route';
    if(place) return {title:`Hotels rond ${place}`, text:`Gefilterd op plaats/regio. Combineer dit later met route-afstand en Booking/Google data.`};
    if(mode==='time') return {title:`Hotels na ongeveer ${time} uur rijden`, text:'Roadora toont opties die logisch liggen als overnachting of lange pauze.'};
    if(mode==='km') return {title:`Hotels rond ${km} km vanaf vertrek`, text:'Handig als je vooraf weet hoeveel kilometer je maximaal wilt rijden.'};
    return {title:`Rond ${km} km is Ulm een logische overnachtingszone.`, text:'Gebruik de kaart voor hotels langs je route, of vergelijk hieronder rustig opties.'};
  }

  function renderHotelCards(){
    const wrap=qs('#hotelPlannerResults');
    if(!wrap) return;
    const copy=currentPlanningText();
    wrap.innerHTML=`
      <article class="hotelPlannerResultCard hotelPlannerEmptyState" data-real-data="places-required">
        <div class="hotelPlannerPhoto"><span>Places</span></div>
        <div class="hotelPlannerInfo">
          <div class="hotelPlannerResultTop"><b>Geen demo-hotels meer</b><em>Live data</em></div>
          <p>Hotels worden nu via Google Places op de kaart geladen. Zo voorkom je nepresultaten in de planner.</p>
          <div class="hotelPlannerMeta"><span>Langs route</span><span>Google Places</span><span>Fallback alleen bij API-fout</span></div>
        </div>
        <div class="hotelPlannerCardActions">
          <button data-hotel-planner-action="map-hotels" type="button">Open kaart</button>
        </div>
      </article>`;
    const title=qs('#hotelPlannerSuggestionTitle');
    const text=qs('#hotelPlannerSuggestionText');
    if(title) title.textContent=copy.title;
    if(text) text.textContent='Open de kaart om echte hotels langs je actuele ORS-route te laden.';
  }

  function showHotelPlanner(){
    ensureMenuItems();
    const screen=ensureHotelScreen();
    if(!screen) return false;
    qs('.phone')?.classList.remove('mapActive','menuOpen','menuExpanded');
    qsa('.appScreen').forEach(s=>s.classList.remove('active'));
    screen.classList.add('active');
    qsa('.sideItem').forEach(b=>b.classList.toggle('active',b.dataset.action==='hotels'));
    return false;
  }

  function openHotelsOnMap(){
    window.RoadoraApp?.showMap?.();
    setTimeout(()=>{
      try{
        window.RoadoraMapApi?.setFilters?.(['hotel']);
        window.RoadoraMapApi?.closeCategories?.();
        toast('Hotels langs route geopend');
      }catch(err){console.warn('Hotels op kaart:',err);}
    },360);
    return false;
  }

  function handleHotelPlannerClick(event){
    const target=event.target;
    if(!target?.closest) return;
    if(target.closest('[data-action="hotels"], .card[data-action="hotels"]')){
      event.preventDefault();
      return showHotelPlanner();
    }
    const mode=target.closest('#hotelPlannerScreen [data-hotel-mode]');
    if(mode){
      event.preventDefault();
      qsa('#hotelPlannerScreen [data-hotel-mode]').forEach(b=>b.classList.remove('active'));
      mode.classList.add('active');
      renderHotelCards();
      return false;
    }
    const chip=target.closest('#hotelPlannerScreen [data-chip-group] button');
    if(chip){
      event.preventDefault();
      qsa('button',chip.parentElement).forEach(b=>b.classList.remove('active'));
      chip.classList.add('active');
      renderHotelCards();
      return false;
    }
    const filter=target.closest('#hotelPlannerScreen [data-hotel-filter]');
    if(filter){
      event.preventDefault();
      filter.classList.toggle('active');
      renderHotelCards();
      return false;
    }
    const action=target.closest('#hotelPlannerScreen [data-hotel-planner-action]');
    if(action){
      event.preventDefault();
      const a=action.dataset.hotelPlannerAction;
      if(a==='back') return window.RoadoraApp?.showHome?.();
      if(a==='search'){renderHotelCards();toast('Hotelzoeker bijgewerkt');return false;}
      if(a==='map-hotels') return openHotelsOnMap();
      if(a==='shortlist'){toast('Shortlist komt uit opgeslagen hotels');return false;}
    }
  }

  function handleInput(event){
    if(event.target?.id==='hotelPlaceInput') renderHotelCards();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{ensureMenuItems();ensureHotelScreen();},{once:true});
  }else{
    ensureMenuItems();ensureHotelScreen();
  }
  document.addEventListener('click',handleHotelPlannerClick,true);
  document.addEventListener('input',handleInput,false);
  window.RoadoraHotelPlanner={show:showHotelPlanner,openHotelsOnMap};
})();

/* Roadora v5.3.1 — Planner Navigation + Calm Stops Fix
   - Back buttons on planner screens work again
   - Dynamic planner screens are hidden when going Home/Route/Map
   - Floating Stops CTA stays removed; bottom nav remains the only trigger
*/
(function(){
  'use strict';
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));

  function hidePlannerScreens(){
    qsa('#hotelPlannerScreen,#explorePlannerScreen,.hotelPlannerScreen,.explorePlannerScreen').forEach(s=>s.classList.remove('active'));
  }

  function showHomeSafe(){
    hidePlannerScreens();
    const phone=qs('.phone');
    phone?.classList.remove('mapActive','menuOpen','menuExpanded');
    qsa('#routeSetupScreen,#mapScreen').forEach(s=>s.classList.remove('active'));
    qsa('.sideItem').forEach(b=>b.classList.toggle('active',b.dataset.action==='home'));
    return false;
  }

  function showRouteSafe(){
    hidePlannerScreens();
    window.RoadoraApp?.showRoute?.();
    return false;
  }

  function showMapSafe(){
    hidePlannerScreens();
    window.RoadoraApp?.showMap?.();
    return false;
  }

  function hideFloatingStopsCta(){
    const cta=qs('#stopsCta');
    if(cta){
      cta.hidden=true;
      cta.setAttribute('aria-hidden','true');
      cta.style.display='none';
    }
  }

  function patchRoadoraApp(){
    if(!window.RoadoraApp || window.RoadoraApp.__plannerNavPatched) return;
    const original={...window.RoadoraApp};
    window.RoadoraApp.showHome=function(){ hidePlannerScreens(); return original.showHome?.(); };
    window.RoadoraApp.showRoute=function(){ hidePlannerScreens(); return original.showRoute?.(); };
    window.RoadoraApp.showMap=function(){ hidePlannerScreens(); return original.showMap?.(); };
    window.RoadoraApp.__plannerNavPatched=true;
  }

  function handlePlannerNav(event){
    const target=event.target;
    if(!target?.closest) return;

    const plannerBack=target.closest('#hotelPlannerScreen [data-hotel-planner-action="back"], #explorePlannerScreen [data-explore-planner-action="back"], .hotelPlannerIcon[data-hotel-planner-action="back"], .explorePlannerIcon[data-explore-planner-action="back"]');
    if(plannerBack){
      event.preventDefault();
      event.stopPropagation();
      return showHomeSafe();
    }

    const item=target.closest('.sideItem[data-action]');
    if(item){
      const action=item.dataset.action;
      if(action==='home'){
        event.preventDefault();
        event.stopPropagation();
        return showHomeSafe();
      }
      if(action==='route'){
        event.preventDefault();
        event.stopPropagation();
        return showRouteSafe();
      }
    }

    const backHome=target.closest('#backHomeBtn,[data-action="home"]');
    if(backHome && !target.closest('#hotelPlannerScreen,#explorePlannerScreen')){
      hidePlannerScreens();
    }
  }

  function initFixes(){
    patchRoadoraApp();
    hideFloatingStopsCta();
    setTimeout(hideFloatingStopsCta,400);
    setTimeout(patchRoadoraApp,400);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initFixes,{once:true});
  else initFixes();
  document.addEventListener('click',handlePlannerNav,true);
})();

/* Roadora v5.3.2 — Hotel ↔ Kaart Switch
   - Hotels-planner naar kaart onthoudt context
   - Kaart toont compacte knop: Terug naar Hotels
   - Geen extra bottom-nav tab nodig
*/
(function(){
  'use strict';
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const KEY='roadoraReturnToHotels';

  function toast(msg){window.RoadoraToast?window.RoadoraToast(msg):console.log(msg);}

  function ensureReturnButton(){
    let btn=qs('#hotelMapBackBtn');
    if(btn) return btn;
    const ui=qs('#mapScreen .ui') || qs('#mapScreen .roadMapApp') || qs('#mapScreen');
    if(!ui) return null;
    btn=document.createElement('button');
    btn.id='hotelMapBackBtn';
    btn.className='hotelMapBackBtn';
    btn.type='button';
    btn.setAttribute('aria-label','Terug naar Hotels');
    btn.innerHTML='<span>‹</span><b>Terug naar Hotels</b>';
    ui.appendChild(btn);
    return btn;
  }

  function setHotelMapMode(active){
    const map=qs('#mapScreen');
    if(active){
      sessionStorage.setItem(KEY,'1');
      map?.classList.add('fromHotelsMap');
      ensureReturnButton();
    }else{
      sessionStorage.removeItem(KEY);
      map?.classList.remove('fromHotelsMap');
    }
  }

  function activateHotelMapMode(){
    setHotelMapMode(true);
    setTimeout(()=>{
      ensureReturnButton();
      qs('#mapScreen')?.classList.add('fromHotelsMap');
      try{
        window.RoadoraMapApi?.setFilters?.(['hotel']);
        window.RoadoraMapApi?.closeCategories?.();
      }catch(err){console.warn('Hotel map mode:',err);}
    },420);
  }

  function backToHotels(){
    setHotelMapMode(false);
    if(window.RoadoraHotelPlanner?.show){
      window.RoadoraHotelPlanner.show();
    }else{
      qsa('.appScreen').forEach(s=>s.classList.remove('active'));
      qs('.phone')?.classList.remove('mapActive');
      qs('#hotelPlannerScreen')?.classList.add('active');
    }
    toast('Terug naar Hotels');
    return false;
  }

  function patchHotelPlannerApi(){
    const api=window.RoadoraHotelPlanner;
    if(!api || api.__hotelMapSwitchPatched) return;
    const originalOpen=api.openHotelsOnMap;
    api.openHotelsOnMap=function(){
      setHotelMapMode(true);
      const result=originalOpen ? originalOpen.apply(this,arguments) : window.RoadoraApp?.showMap?.();
      activateHotelMapMode();
      return result;
    };
    api.__hotelMapSwitchPatched=true;
  }

  function patchRoadoraApp(){
    const api=window.RoadoraApp;
    if(!api || api.__hotelMapSwitchPatched) return;
    const original={...api};
    api.showHome=function(){setHotelMapMode(false);return original.showHome?.apply(this,arguments);};
    api.showRoute=function(){setHotelMapMode(false);return original.showRoute?.apply(this,arguments);};
    api.showMap=function(){const r=original.showMap?.apply(this,arguments);setTimeout(()=>{if(sessionStorage.getItem(KEY)==='1') qs('#mapScreen')?.classList.add('fromHotelsMap');},180);return r;};
    api.__hotelMapSwitchPatched=true;
  }

  function handleClick(event){
    const target=event.target;
    if(!target?.closest) return;

    if(target.closest('#hotelMapBackBtn')){
      event.preventDefault();
      event.stopPropagation();
      return backToHotels();
    }

    if(target.closest('#hotelPlannerScreen [data-hotel-planner-action="map-hotels"]')){
      setHotelMapMode(true);
      setTimeout(activateHotelMapMode,40);
      return;
    }

    const nav=itemFromBottomNav(target);
    if(nav && !nav.includes('stops')){
      // Houd de terugknop alleen zichtbaar tijdens de hotel-kaartcontext.
      if(nav.includes('route')||nav.includes('overzicht')||nav.includes('reisgids')||nav.includes('navigeer')) setHotelMapMode(false);
    }
  }

  function itemFromBottomNav(target){
    const btn=target.closest?.('#mapScreen .bottomNav .navItem');
    return btn ? (btn.textContent||'').trim().toLowerCase() : '';
  }

  function init(){
    ensureReturnButton();
    patchHotelPlannerApi();
    patchRoadoraApp();
    if(sessionStorage.getItem(KEY)==='1') qs('#mapScreen')?.classList.add('fromHotelsMap');
    setTimeout(patchHotelPlannerApi,500);
    setTimeout(patchRoadoraApp,500);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
  document.addEventListener('click',handleClick,true);
})();

/* Roadora v5.4.1 — Hotel Ecosystem Polish
   - Hotelplanner bewaart zoekmodus/filters tijdelijk
   - Overnachten-kaartmodus gebruikt dezelfde context
   - Categorieën blijven compact; alleen bottom-nav Stops triggert ze
*/
(function(){
  'use strict';
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const KEY='roadoraHotelPlanningContext';

  function toast(msg){window.RoadoraToast?window.RoadoraToast(msg):console.log(msg);}

  function readContext(){
    try{return JSON.parse(sessionStorage.getItem(KEY)||'{}')||{};}catch(_){return {};}
  }
  function writeContext(){
    const screen=qs('#hotelPlannerScreen');
    if(!screen) return;
    const context={
      place:(qs('#hotelPlaceInput')?.value||'').trim(),
      mode:qs('#hotelPlannerScreen [data-hotel-mode].active')?.dataset.hotelMode||'route',
      time:qs('#hotelPlannerScreen [data-chip-group="time"] .active')?.dataset.time||'5',
      km:qs('#hotelPlannerScreen [data-chip-group="km"] .active')?.dataset.km||'600',
      filters:qsa('#hotelPlannerScreen [data-hotel-filter].active').map(b=>b.dataset.hotelFilter),
      updatedAt:Date.now()
    };
    sessionStorage.setItem(KEY,JSON.stringify(context));
  }
  function contextLabel(){
    const c=readContext();
    if(c.place) return `Hotels rond ${c.place}`;
    if(c.mode==='time') return `Hotels na ±${c.time||5}u rijden`;
    if(c.mode==='km') return `Hotels rond ${c.km||600} km`;
    return 'Hotels langs je route';
  }

  function syncPlannerFromContext(){
    const c=readContext();
    if(!qs('#hotelPlannerScreen') || !c.updatedAt) return;
    const input=qs('#hotelPlaceInput');
    if(input && c.place!==undefined) input.value=c.place;
    if(c.mode){
      qsa('#hotelPlannerScreen [data-hotel-mode]').forEach(b=>b.classList.toggle('active',b.dataset.hotelMode===c.mode));
    }
    if(c.time){
      qsa('#hotelPlannerScreen [data-chip-group="time"] button').forEach(b=>b.classList.toggle('active',b.dataset.time===String(c.time)));
    }
    if(c.km){
      qsa('#hotelPlannerScreen [data-chip-group="km"] button').forEach(b=>b.classList.toggle('active',b.dataset.km===String(c.km)));
    }
    if(Array.isArray(c.filters)){
      qsa('#hotelPlannerScreen [data-hotel-filter]').forEach(b=>b.classList.toggle('active',c.filters.includes(b.dataset.hotelFilter)));
    }
  }

  function improveHotelMapCockpit(){
    const map=qs('#mapScreen');
    if(!map?.classList.contains('fromHotelsMap')) return;
    const title=qs('#mapStatusTitle');
    const badge=qs('#mapStatusBadge');
    const sub=qs('#mapStatusSub');
    const next=qs('#mapStatusNext');
    if(title) title.textContent=contextLabel();
    if(badge) badge.textContent='Hotelmodus';
    if(sub) sub.textContent='Overnachten · zelf kiezen langs je route';
    if(next) next.textContent='Vergelijk in Hotels';
  }

  function openHotelsMapPolished(){
    writeContext();
    sessionStorage.setItem('roadoraReturnToHotels','1');
    window.RoadoraApp?.showMap?.();
    setTimeout(()=>{
      qs('#mapScreen')?.classList.add('fromHotelsMap');
      try{
        window.RoadoraMapApi?.setFilters?.(['hotel']);
        window.RoadoraMapApi?.closeCategories?.();
        window.RoadoraMapApi?.updateTopbar?.();
      }catch(err){console.warn('Hotel ecosystem map:',err);}
      improveHotelMapCockpit();
      toast('Overnachten op de kaart');
    },360);
    setTimeout(improveHotelMapCockpit,700);
    return false;
  }

  function backToPlannerPolished(){
    qs('#mapScreen')?.classList.remove('fromHotelsMap');
    sessionStorage.removeItem('roadoraReturnToHotels');
    if(window.RoadoraHotelPlanner?.show){
      window.RoadoraHotelPlanner.show();
      setTimeout(()=>{syncPlannerFromContext();},80);
    }
    return false;
  }

  function patchPlanner(){
    const api=window.RoadoraHotelPlanner;
    if(!api || api.__ecosystemPolished) return;
    const originalShow=api.show;
    api.show=function(){
      const r=originalShow.apply(this,arguments);
      setTimeout(()=>{syncPlannerFromContext();},80);
      return r;
    };
    api.openHotelsOnMap=openHotelsMapPolished;
    api.__ecosystemPolished=true;
  }

  function handleClick(event){
    const target=event.target;
    if(!target?.closest) return;

    if(target.closest('#hotelMapBackBtn')){
      event.preventDefault();
      event.stopPropagation();
      return backToPlannerPolished();
    }

    if(target.closest('#hotelPlannerScreen [data-hotel-mode], #hotelPlannerScreen [data-chip-group] button, #hotelPlannerScreen [data-hotel-filter], #hotelPlannerScreen [data-hotel-planner-action="search"]')){
      setTimeout(writeContext,30);
    }

    if(target.closest('#hotelPlannerScreen [data-hotel-planner-action="map-hotels"]')){
      event.preventDefault();
      event.stopPropagation();
      return openHotelsMapPolished();
    }

    const nav=target.closest('#mapScreen .bottomNav .navItem');
    if(nav){
      const label=(nav.textContent||'').trim().toLowerCase();
      if(!label.includes('stops')){
        qs('#mapScreen')?.classList.remove('fromHotelsMap');
      }
    }

    const cat=target.closest('#mapScreen .cat[data-filter]');
    if(cat){
      const f=cat.dataset.filter;
      if(f==='hotel'){
        sessionStorage.setItem('roadoraReturnToHotels','1');
        qs('#mapScreen')?.classList.add('fromHotelsMap');
        setTimeout(improveHotelMapCockpit,120);
      }else{
        qs('#mapScreen')?.classList.remove('fromHotelsMap');
        sessionStorage.removeItem('roadoraReturnToHotels');
      }
    }
  }

  function init(){
    patchPlanner();
    syncPlannerFromContext();
    setTimeout(patchPlanner,600);
    setTimeout(()=>{ if(sessionStorage.getItem('roadoraReturnToHotels')==='1') improveHotelMapCockpit(); },700);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
  document.addEventListener('click',handleClick,true);
  document.addEventListener('input',e=>{if(e.target?.id==='hotelPlaceInput') setTimeout(writeContext,80);},false);
})();

/* Roadora v5.5 — Hotel Planner Dashboard v1
   - Hotels-tab krijgt echte meerwaarde als rustige overnachtingsplanner
   - Reisvoorkeuren in instellingenknop i.p.v. losse filterchaos
   - Desktop-friendly dashboard + mobile-friendly compact layout
   - Overnachten op kaart blijft gewone kaartfiltermodus, tenzij je vanuit Hotels komt
*/
(function(){
  'use strict';
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const PREF_KEY='roadoraHotelPreferencesV1';
  const MAP_KEY='roadoraReturnToHotels';
  const PLANNER_MAP_KEY='roadoraHotelPlannerOpenedMap';

  // v7.3.1: dashboard toont geen hardcoded hotelvoorbeelden meer.
  // Echte hotels komen uit Places op de kaart of opgeslagen shortlist.
  const hotels=[];

  const prefLabels={
    charger:['⚡','Laadpaal'], parking:['🅿️','Parkeren'], pet:['🐾','Huisdieren'], family:['👨‍👩‍👧','Familie'], breakfast:['☕','Ontbijt'], late:['🌙','Late check-in']
  };

  function toast(msg){window.RoadoraToast?window.RoadoraToast(msg):console.log(msg);}
  function readPrefs(){try{return JSON.parse(localStorage.getItem(PREF_KEY)||'{}')||{};}catch(_){return {};}}
  function writePrefs(p){localStorage.setItem(PREF_KEY,JSON.stringify(p||{}));}
  function activePrefs(){const p=readPrefs();return Object.keys(prefLabels).filter(k=>p[k]);}

  function ensureHotelScreen(){
    let screen=qs('#hotelPlannerScreen');
    if(!screen){
      window.RoadoraHotelPlanner?.show?.();
      screen=qs('#hotelPlannerScreen');
    }
    if(!screen || screen.dataset.v55==='1') return screen;
    screen.dataset.v55='1';
    screen.classList.add('hotelDashboardV55');
    screen.innerHTML=`
      <div class="hotelDashShell">
        <header class="hotelDashTop">
          <button class="hotelDashIcon" data-menu-open type="button" aria-label="Menu openen">☰</button>
          <button class="hotelDashIcon" data-hotel-planner-action="back" type="button" aria-label="Terug">‹</button>
          <div class="hotelDashTitle"><span>🏨</span><div><b>Hotels</b><small>Plan je overnachtingen</small></div></div>
          <button class="hotelDashSmall" data-hotel-planner-action="preferences" type="button">⚙️ Wensen</button>
        </header>

        <section class="hotelRouteCardV55">
          <div><b>Rotterdam → Innsbruck</b><small>1.005 km · ± 9u 03m</small></div>
          <button data-action="route" type="button">Wijzig route</button>
        </section>

        <section class="hotelControlsV55">
          <div class="hotelControlBox"><small>Reis opdelen</small><div><button data-night-minus type="button">−</button><b id="hotelNightCount">2 nachten</b><button data-night-plus type="button">+</button></div></div>
          <button class="hotelControlBox active" data-drive="6" type="button"><small>Max. rijtijd</small><b>6u 00m</b></button>
          <button class="hotelControlBox" data-arrival="18" type="button"><small>Aankomst</small><b>Voor 18:00</b></button>
          <button class="hotelPrefButton" data-hotel-planner-action="preferences" type="button">Instellingen</button>
        </section>

        <main class="hotelDashGrid">
          <aside class="hotelNightsPanel">
            <article class="nightCard active" data-night="1">
              <header><b>Dag 1</b><button type="button">✎</button></header>
              <p>Rotterdam → Zuid-Duitsland</p><strong>± 540 km · ± 5u 10m</strong>
              <button data-night-search="1" type="button">Zoek hotels voor dag 1</button>
              <div class="zoneLine"><span></span><em>Aanbevolen zone</em><b>Stuttgart → Ulm</b><small>± 540 km van start</small></div>
            </article>
            <article class="nightCard" data-night="2">
              <header><b>Dag 2</b><button type="button">✎</button></header>
              <p>Zuid-Duitsland → Innsbruck</p><strong>± 465 km · ± 3u 50m</strong>
              <button data-night-search="2" type="button">Zoek hotels voor dag 2</button>
              <div class="zoneLine"><span></span><em>Aanbevolen zone</em><b>München → Kufstein</b><small>± 465 km van dag 1</small></div>
            </article>
            <button class="addNight" type="button">＋ Nacht toevoegen</button>
          </aside>

          <section class="hotelListPanel">
            <nav class="hotelTabsV55"><button class="active" data-hotel-tab="recommended" type="button">Aanbevolen</button><button data-hotel-tab="map" type="button">Zoek op kaart</button><button data-hotel-tab="shortlist" type="button">Mijn shortlist</button></nav>
            <div class="hotelRecommendNote"><b>🌙 Aanbevolen voor dag 1</b><a href="#" data-hotel-planner-action="why">Waarom deze?</a><small>Live hotels worden via Google Places op de kaart geladen.</small></div>
            <div class="hotelCardsV55" id="hotelCardsV55"></div>
            <button class="hotelLoadMore" type="button">Toon meer hotels</button>
          </section>

          <aside class="hotelMapPanelV55">
            <div class="hotelMiniMap">
              <span class="startPin">Rotterdam</span><i class="routeStroke"></i><span class="hotelPin p1">1</span><span class="hotelPin p2">2</span><span class="endPin">Innsbruck</span>
            </div>
            <button data-hotel-planner-action="map-hotels" type="button">Bekijk alles op kaart</button>
          </aside>
        </main>

        <section class="hotelShortlistV55">
          <header><b>Jouw shortlist</b><span id="hotelShortlistCount">3 hotels</span><button data-hotel-planner-action="compare" type="button">Vergelijk</button><button data-hotel-planner-action="save-trip" type="button">Opslaan als reis</button></header>
          <div class="shortRows" id="hotelShortRows"></div>
        </section>
      </div>

      <section class="hotelPrefsSheet" id="hotelPrefsSheet" aria-label="Hotel wensen">
        <div class="hotelPrefsScrim" data-hotel-planner-action="close-preferences"></div>
        <article class="hotelPrefsCard">
          <header><div><small>Reisprofiel</small><b>Jouw hotelwensen</b></div><button data-hotel-planner-action="close-preferences" type="button">×</button></header>
          <p>Stel dit één keer in. Roadora gebruikt deze wensen voor hotels, kaart-highlights en aanbevelingen.</p>
          <div class="hotelPrefsGrid">
            ${Object.entries(prefLabels).map(([key,[icon,label]])=>`<button data-pref-key="${key}" type="button"><span>${icon}</span><b>${label}</b><small>${prefHelp(key)}</small></button>`).join('')}
          </div>
          <footer><button class="hotelPrefsGhost" data-hotel-planner-action="reset-preferences" type="button">Reset</button><button class="hotelPrefsPrimary" data-hotel-planner-action="save-preferences" type="button">Voorkeuren opslaan</button></footer>
        </article>
      </section>`;
    renderCards();
    syncPrefButtons();
    return screen;
  }

  function prefHelp(key){
    return ({charger:'hotel of parking met laadpunt',parking:'makkelijk parkeren bij aankomst',pet:'geschikt met hond/huisdier',family:'handig met kinderen',breakfast:'ontbijt bij vertrek',late:'veilig later aankomen'}[key]||'');
  }

  function renderCards(){
    const prefs=activePrefs();
    const sorted=hotels.slice().sort((a,b)=>scoreHotel(b,prefs)-scoreHotel(a,prefs));
    const wrap=qs('#hotelCardsV55');
    if(wrap){
      wrap.innerHTML=sorted.length
        ? sorted.slice(0,4).map(h=>cardHtml(h,prefs)).join('')
        : `<article class="hotelCardV55 hotelEmptyV731">
            <div class="hotelPhotoV55"><span>Live</span></div>
            <div class="hotelInfoV55"><header><b>Geen demo-hotels</b></header><small>Gebruik de kaart om echte Google Places-hotels langs je route te laden.</small><p>Fallback-data verschijnt alleen nog als de API faalt.</p></div>
            <button class="hotelMapBtnV55" data-hotel-planner-action="map-hotels" type="button">Open hotels op kaart</button>
          </article>`;
    }
    const rows=qs('#hotelShortRows');
    if(rows){
      rows.innerHTML=sorted.length
        ? sorted.slice(0,3).map(h=>`<div><span style="background:${h.photo}"></span><b>${h.name}</b><em>${h.loc}</em><strong>${h.price}</strong><button type="button">♡</button></div>`).join('')
        : '<div><span></span><b>Nog geen opgeslagen hotels</b><em>Open echte hotels op de kaart</em><strong>—</strong><button type="button">♡</button></div>';
    }
    const count=qs('#hotelShortlistCount');
    if(count) count.textContent=sorted.length ? `${Math.min(3,sorted.length)} hotels` : '0 hotels';
  }

  function scoreHotel(h,prefs){return 10 + prefs.filter(p=>h.features.includes(p)).length*4 + (h.tag.includes('match')?3:0) + Number(String(h.rating).replace(',','.'));}
  function cardHtml(h,prefs){
    const match=prefs.length?prefs.filter(p=>h.features.includes(p)).length:prefs.length;
    const pct=Math.min(98,76+match*7);
    return `<article class="hotelCardV55">
      <div class="hotelPhotoV55" style="background:${h.photo}"><span>${match?pct+'% match':'Top match'}</span></div>
      <div class="hotelInfoV55"><header><b>${h.name}</b><button type="button">♡</button></header><small>${h.loc} · ${h.km}</small><p>${h.rating} ★ · ${h.price} per nacht</p><div>${h.features.slice(0,4).map(f=>`<span title="${prefLabels[f]?.[1]||f}">${prefLabels[f]?.[0]||'✓'}</span>`).join('')}</div></div>
      <button class="hotelMapBtnV55" data-hotel-planner-action="map-hotels" type="button">Bekijk op kaart</button>
    </article>`;
  }

  function syncPrefButtons(){
    const p=readPrefs();
    qsa('#hotelPrefsSheet [data-pref-key]').forEach(btn=>btn.classList.toggle('active',!!p[btn.dataset.prefKey]));
  }

  function show(){
    const screen=ensureHotelScreen();
    if(!screen) return false;
    qs('.phone')?.classList.add('hotelPlannerWide');
    qs('.phone')?.classList.remove('mapActive','menuOpen','menuExpanded');
    qsa('.appScreen').forEach(s=>s.classList.remove('active'));
    screen.classList.add('active');
    qsa('.sideItem').forEach(b=>b.classList.toggle('active',b.dataset.action==='hotels'));
    renderCards();
    return false;
  }

  function leavePlanner(){qs('.phone')?.classList.remove('hotelPlannerWide');}
  function openMapFromPlanner(){
    sessionStorage.setItem(MAP_KEY,'1');
    sessionStorage.setItem(PLANNER_MAP_KEY,'1');
    leavePlanner();
    window.RoadoraApp?.showMap?.();
    setTimeout(()=>{try{window.RoadoraMapApi?.setFilters?.(['hotel']);window.RoadoraMapApi?.closeCategories?.();}catch(_){ } qs('#mapScreen')?.classList.add('fromHotelsMap');},350);
    return false;
  }
  function openPrefs(){qs('#hotelPrefsSheet')?.classList.add('open');syncPrefButtons();return false;}
  function closePrefs(){qs('#hotelPrefsSheet')?.classList.remove('open');return false;}

  function handleClick(e){
    const t=e.target;
    if(!t?.closest) return;

    if(t.closest('[data-action="hotels"], .card[data-action="hotels"]')){e.preventDefault();e.stopPropagation();return show();}

    const action=t.closest('#hotelPlannerScreen [data-hotel-planner-action]');
    if(action){
      const a=action.dataset.hotelPlannerAction;
      if(['preferences','close-preferences','save-preferences','reset-preferences','map-hotels','back','compare','save-trip','why'].includes(a)){
        e.preventDefault();e.stopPropagation();
        if(a==='back'){leavePlanner();return window.RoadoraApp?.showHome?.();}
        if(a==='map-hotels') return openMapFromPlanner();
        if(a==='preferences') return openPrefs();
        if(a==='close-preferences') return closePrefs();
        if(a==='reset-preferences'){writePrefs({});syncPrefButtons();renderCards();toast('Hotelwensen gereset');return false;}
        if(a==='save-preferences'){closePrefs();renderCards();toast('Hotelwensen opgeslagen');return false;}
        if(a==='compare'){toast('Vergelijkmodus voorbereid');return false;}
        if(a==='save-trip'){toast('Reis opslaan vraagt later om account/sync');return false;}
        if(a==='why'){toast('Aanbevelingen gebruiken route + wensen');return false;}
      }
    }

    const pref=t.closest('#hotelPrefsSheet [data-pref-key]');
    if(pref){
      e.preventDefault();e.stopPropagation();
      const p=readPrefs();p[pref.dataset.prefKey]=!p[pref.dataset.prefKey];writePrefs(p);syncPrefButtons();renderCards();return false;
    }

    if(t.closest('#mapScreen .cat[data-filter="hotel"]')){
      // Gewoon op Overnachten in de kaart drukken = normale kaartfilter, geen terug naar Hotels.
      if(sessionStorage.getItem(PLANNER_MAP_KEY)!=='1'){
        setTimeout(()=>{qs('#mapScreen')?.classList.remove('fromHotelsMap');sessionStorage.removeItem(MAP_KEY);},30);
      }
    }
    const nav=t.closest('#mapScreen .bottomNav .navItem');
    if(nav && !(nav.textContent||'').toLowerCase().includes('stops')){
      sessionStorage.removeItem(PLANNER_MAP_KEY);
    }
  }

  function patch(){
    ensureHotelScreen();
    const old=window.RoadoraHotelPlanner||{};
    window.RoadoraHotelPlanner={...old,show,openHotelsOnMap:openMapFromPlanner};
    const app=window.RoadoraApp;
    if(app && !app.__v55WidePatched){
      ['showHome','showRoute','showMap'].forEach(k=>{const orig=app[k];app[k]=function(){leavePlanner();return orig?.apply(this,arguments);};});
      app.__v55WidePatched=true;
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',patch,{once:true}); else patch();
  document.addEventListener('click',handleClick,true);
})();

/* Roadora v5.6 — Hotel Flow + GPS Overnachten
   - Grote Instellingen-knop in Hotels-tab vervangen door subtiel icon
   - Overnachten op kaart = gewone kaartmodus, geen Terug naar Hotels
   - Vanuit Hotels-tab naar kaart = planner-context met Terug naar Hotels
   - GPS-knop voor hotels dichtbij huidige locatie
*/
(function(){
  'use strict';
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const PLANNER_KEY='roadoraHotelPlannerOpenedMap';
  const RETURN_KEY='roadoraReturnToHotels';

  function toast(msg){window.RoadoraToast?window.RoadoraToast(msg):console.log(msg);}

  function ensureHotelMapActions(){
    const ui=qs('#mapScreen .ui') || qs('#mapScreen .roadMapApp') || qs('#mapScreen');
    if(!ui) return null;
    let dock=qs('#hotelMapMiniActions');
    if(!dock){
      dock=document.createElement('div');
      dock.id='hotelMapMiniActions';
      dock.className='hotelMapMiniActions';
      dock.innerHTML=`
        <button class="hotelNearMeBtn" data-hotel-map-action="nearby" type="button">📍 Dichtbij mij</button>
        <button class="hotelPlannerMiniBtn" data-hotel-map-action="planner" type="button">Hotels plannen</button>`;
      ui.appendChild(dock);
    }
    return dock;
  }

  function setHotelMapContext(fromPlanner){
    const map=qs('#mapScreen');
    ensureHotelMapActions();
    map?.classList.add('hotelMapActive');
    if(fromPlanner){
      sessionStorage.setItem(PLANNER_KEY,'1');
      sessionStorage.setItem(RETURN_KEY,'1');
      map?.classList.add('fromHotelsMap');
    }else{
      sessionStorage.removeItem(PLANNER_KEY);
      sessionStorage.removeItem(RETURN_KEY);
      map?.classList.remove('fromHotelsMap');
    }
    updateHotelCockpit(fromPlanner);
  }

  function clearHotelMapContext(){
    qs('#mapScreen')?.classList.remove('hotelMapActive','fromHotelsMap');
    sessionStorage.removeItem(PLANNER_KEY);
    sessionStorage.removeItem(RETURN_KEY);
  }

  function updateHotelCockpit(fromPlanner){
    const title=qs('#mapStatusTitle');
    const badge=qs('#mapStatusBadge');
    const sub=qs('#mapStatusSub');
    const next=qs('#mapStatusNext');
    if(title) title.textContent=fromPlanner?'Hotels uit je planner':'Hotels langs je route';
    if(badge) badge.textContent=fromPlanner?'Planner':'Overnachten';
    if(sub) sub.textContent=fromPlanner?'Planner gekoppeld aan kaart · zelf kiezen':'Routefilter · hotels langs de route';
    if(next) next.textContent=fromPlanner?'Terug naar Hotels mogelijk':'GPS dichtbij mogelijk';
  }

  function requestNearbyHotels(){
    if(!navigator.geolocation){toast('GPS is niet beschikbaar');return false;}
    toast('Huidige locatie zoeken…');
    navigator.geolocation.getCurrentPosition(pos=>{
      const lat=pos.coords.latitude;
      const lng=pos.coords.longitude;
      try{
        const map=window.roadoraLeafletMap;
        if(map && window.L){
          map.setView([lat,lng],13,{animate:true});
          if(window.__roadoraGpsMarker){map.removeLayer(window.__roadoraGpsMarker);}
          window.__roadoraGpsMarker=window.L.marker([lat,lng],{
            icon:window.L.divIcon({className:'',iconSize:[34,34],iconAnchor:[17,17],html:'<div class="gpsPulsePin">⌖</div>'})
          }).addTo(map);
        }
        window.RoadoraMapApi?.showPanel?.({
          name:'Hotels dichtbij jou',
          label:'GPS overnachten',
          meta:'Rond je huidige locatie',
          desc:'Roadora zoekt hier later live hotels rond jouw GPS-locatie met je opgeslagen hotelwensen. Voor nu kun je direct zoeken in Google Maps.',
          type:'hotel',
          ll:[lat,lng],
          infoUrl:'https://www.google.com/maps/search/hotels/@'+lat+','+lng+',14z'
        });
        qs('#mapScreen')?.classList.add('hotelMapActive');
        updateHotelCockpit(false);
        toast('GPS hotelmodus actief');
      }catch(err){console.warn('GPS hotel mode:',err);toast('GPS gevonden, kaart kon niet focussen');}
    },err=>{
      console.warn('GPS permission:',err);
      toast('Geef locatie-toegang voor hotels dichtbij');
    },{enableHighAccuracy:true,timeout:9000,maximumAge:60000});
    return false;
  }

  function openHotelPlanner(){
    clearHotelMapContext();
    window.RoadoraHotelPlanner?.show?.();
    return false;
  }

  function patchPlannerMapOpen(){
    const api=window.RoadoraHotelPlanner;
    if(!api || api.__v56HotelFlowPatched) return;
    const original=api.openHotelsOnMap;
    api.openHotelsOnMap=function(){
      sessionStorage.setItem(PLANNER_KEY,'1');
      sessionStorage.setItem(RETURN_KEY,'1');
      const result=original?original.apply(this,arguments):window.RoadoraApp?.showMap?.();
      setTimeout(()=>setHotelMapContext(true),420);
      return result;
    };
    api.__v56HotelFlowPatched=true;
  }

  function patchHotelSettingsButton(){
    const screen=qs('#hotelPlannerScreen');
    if(!screen) return;
    const big=qs('.hotelPrefButton',screen);
    if(big){
      big.classList.add('hotelPrefButtonHiddenV56');
      big.setAttribute('aria-hidden','true');
      big.tabIndex=-1;
    }
    const small=qs('.hotelDashSmall',screen);
    if(small){
      small.classList.add('hotelSettingsIconV56');
      small.textContent='⚙️';
      small.setAttribute('aria-label','Hotelwensen openen');
      small.title='Hotelwensen';
    }
  }

  function handleClick(event){
    const target=event.target;
    if(!target?.closest) return;

    if(target.closest('#hotelPlannerScreen [data-hotel-planner-action="map-hotels"], #hotelPlannerScreen .hotelMapBtnV55')){
      sessionStorage.setItem(PLANNER_KEY,'1');
      sessionStorage.setItem(RETURN_KEY,'1');
      setTimeout(()=>setHotelMapContext(true),520);
      return;
    }

    const hotelCat=target.closest('#mapScreen .cat[data-filter="hotel"]');
    if(hotelCat){
      const fromPlanner=sessionStorage.getItem(PLANNER_KEY)==='1';
      setTimeout(()=>setHotelMapContext(fromPlanner),120);
      return;
    }

    const otherCat=target.closest('#mapScreen .cat[data-filter]');
    if(otherCat && otherCat.dataset.filter!=='hotel'){
      setTimeout(()=>{qs('#mapScreen')?.classList.remove('hotelMapActive','fromHotelsMap');sessionStorage.removeItem(PLANNER_KEY);sessionStorage.removeItem(RETURN_KEY);},80);
    }

    const nav=target.closest('#mapScreen .bottomNav .navItem');
    if(nav){
      const label=(nav.textContent||'').trim().toLowerCase();
      if(!label.includes('stops')) clearHotelMapContext();
    }

    const act=target.closest('[data-hotel-map-action]');
    if(act){
      event.preventDefault();
      event.stopPropagation();
      const a=act.dataset.hotelMapAction;
      if(a==='nearby') return requestNearbyHotels();
      if(a==='planner') return openHotelPlanner();
    }
  }

  function init(){
    ensureHotelMapActions();
    patchPlannerMapOpen();
    patchHotelSettingsButton();
    setTimeout(patchPlannerMapOpen,700);
    setTimeout(patchHotelSettingsButton,700);
    if(sessionStorage.getItem(PLANNER_KEY)==='1') setHotelMapContext(true);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
  document.addEventListener('click',handleClick,true);
  document.addEventListener('click',()=>setTimeout(patchHotelSettingsButton,120),true);
})();

/* Roadora v5.6.1 — Navigation & State Cleanup
   - Hotelplanner back gebruikt echte vorige context: map -> hotels -> terug naar map, menu -> hotels -> terug home
   - Hotelkaart context alleen wanneer je vanuit Hotels-tab naar kaart gaat
   - Overnachten-filter op kaart toont géén terug/extra CTA's
   - Dichtbij/route CTA's worden niet meer als blijvende floating laag getoond
*/
(function(){
  'use strict';
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const SOURCE_KEY='roadoraHotelPlannerSourceV561';
  const RETURN_KEY='roadoraReturnToHotels';
  const PLANNER_MAP_KEY='roadoraHotelPlannerOpenedMap';

  function toast(msg){window.RoadoraToast?window.RoadoraToast(msg):console.log(msg);}
  function activeScreen(){
    if(qs('#mapScreen.active')) return 'map';
    if(qs('#routeSetupScreen.active')) return 'route';
    if(qs('#hotelPlannerScreen.active')) return sessionStorage.getItem(SOURCE_KEY)||'home';
    return 'home';
  }
  function markPlannerSource(source){sessionStorage.setItem(SOURCE_KEY,source||activeScreen()||'home');}
  function clearHotelMapState(){
    const map=qs('#mapScreen');
    map?.classList.remove('hotelMapActive','fromHotelsMap','hotelNearbyActive','hotelRouteActive');
    sessionStorage.removeItem(RETURN_KEY);
    sessionStorage.removeItem(PLANNER_MAP_KEY);
    sessionStorage.removeItem('roadoraHotelPlannerOpenedMap');
    qsa('#hotelMapMiniActions,.hotelMapMiniActions,#hotelMapRouteToggle,.hotelMapRouteToggle').forEach(el=>{
      el.classList.remove('open','show','active');
      el.setAttribute('aria-hidden','true');
    });
  }
  function setPlannerMapState(){
    const map=qs('#mapScreen');
    sessionStorage.setItem(RETURN_KEY,'1');
    sessionStorage.setItem(PLANNER_MAP_KEY,'1');
    map?.classList.add('fromHotelsMap');
    map?.classList.remove('hotelMapActive','hotelNearbyActive','hotelRouteActive');
    ensureBackChip();
  }
  function ensureBackChip(){
    let btn=qs('#hotelMapBackBtn');
    if(btn) return btn;
    const ui=qs('#mapScreen .ui')||qs('#mapScreen .roadMapApp')||qs('#mapScreen');
    if(!ui) return null;
    btn=document.createElement('button');
    btn.id='hotelMapBackBtn';
    btn.className='hotelMapBackBtn';
    btn.type='button';
    btn.innerHTML='<span>‹</span><b>Terug naar Hotels</b>';
    btn.setAttribute('aria-label','Terug naar Hotels');
    ui.appendChild(btn);
    return btn;
  }
  function showPlannerFromMap(){
    markPlannerSource('map');
    clearHotelMapState();
    if(window.RoadoraHotelPlanner?.show){ window.RoadoraHotelPlanner.show(); }
    else{
      qsa('.appScreen').forEach(s=>s.classList.remove('active'));
      qs('#hotelPlannerScreen')?.classList.add('active');
      qs('.phone')?.classList.remove('mapActive');
    }
    return false;
  }
  function backFromPlanner(){
    const source=sessionStorage.getItem(SOURCE_KEY)||'home';
    const screen=qs('#hotelPlannerScreen');
    screen?.classList.remove('active');
    qs('.phone')?.classList.remove('hotelPlannerWide');
    if(source==='map'){
      window.RoadoraApp?.showMap?.();
      setTimeout(()=>{
        if(sessionStorage.getItem(RETURN_KEY)==='1') setPlannerMapState();
        else clearHotelMapState();
      },220);
      return false;
    }
    if(source==='route') return window.RoadoraApp?.showRoute?.();
    return window.RoadoraApp?.showHome?.();
  }
  function openHotelsOnMapClean(){
    markPlannerSource('map');
    window.RoadoraApp?.showMap?.();
    setTimeout(()=>{
      setPlannerMapState();
      try{
        window.RoadoraMapApi?.setFilters?.(['hotel']);
        window.RoadoraMapApi?.closeCategories?.();
      }catch(err){console.warn('Hotel map clean open:',err);}
      toast('Hotels op de kaart');
    },360);
    return false;
  }
  function patchPublicApis(){
    const app=window.RoadoraApp;
    if(app && !app.__v561StateCleanup){
      const oldHome=app.showHome, oldRoute=app.showRoute, oldMap=app.showMap;
      app.showHome=function(){clearHotelMapState();sessionStorage.removeItem(SOURCE_KEY);return oldHome?.apply(this,arguments);};
      app.showRoute=function(){clearHotelMapState();markPlannerSource('route');return oldRoute?.apply(this,arguments);};
      app.showMap=function(){return oldMap?.apply(this,arguments);};
      app.__v561StateCleanup=true;
    }
    const hp=window.RoadoraHotelPlanner;
    if(hp && !hp.__v561StateCleanup){
      const oldShow=hp.show;
      hp.show=function(source){
        if(source) markPlannerSource(source);
        else if(!qs('#hotelPlannerScreen.active')) markPlannerSource(activeScreen());
        clearHotelMapState();
        return oldShow?.apply(this,arguments);
      };
      hp.openHotelsOnMap=openHotelsOnMapClean;
      hp.__v561StateCleanup=true;
    }
  }

  function handleClick(e){
    const t=e.target;
    if(!t?.closest) return;

    // Vanuit kaart naar hotelplanner via compacte kaartknop: terug moet naar kaart gaan.
    const plannerMini=t.closest('[data-hotel-map-action="planner"]');
    if(plannerMini){
      e.preventDefault();e.stopPropagation();
      return showPlannerFromMap();
    }

    // Terugchip op kaart is alleen voor plannercontext.
    if(t.closest('#hotelMapBackBtn')){
      e.preventDefault();e.stopPropagation();
      return showPlannerFromMap();
    }

    // Back in Hotels-tab: niet altijd naar home, maar naar waar je vandaan kwam.
    if(t.closest('#hotelPlannerScreen [data-hotel-planner-action="back"], #hotelPlannerScreen .hotelDashIcon[aria-label="Terug"]')){
      e.preventDefault();e.stopPropagation();
      return backFromPlanner();
    }

    // Menu/Home-card Hotels openen: bron vastleggen.
    if(t.closest('[data-action="hotels"], .sideItem[data-action="hotels"]')){
      markPlannerSource(activeScreen());
    }

    // Bekijk op kaart vanuit Hotels: plannercontext aan.
    if(t.closest('#hotelPlannerScreen [data-hotel-planner-action="map-hotels"], #hotelPlannerScreen .hotelMapBtnV55')){
      e.preventDefault();e.stopPropagation();
      return openHotelsOnMapClean();
    }

    // Overnachten in normale kaart: gewone filtermodus, geen terug naar Hotels en geen blijvende CTA's.
    const cat=t.closest('#mapScreen .cat[data-filter]');
    if(cat){
      const filter=cat.dataset.filter;
      if(filter==='hotel'){
        setTimeout(()=>{
          if(sessionStorage.getItem(PLANNER_MAP_KEY)!=='1') clearHotelMapState();
        },80);
      }else{
        setTimeout(clearHotelMapState,80);
      }
    }

    const nav=t.closest('#mapScreen .bottomNav .navItem');
    if(nav){
      const label=(nav.textContent||'').trim().toLowerCase();
      if(!label.includes('stops')) setTimeout(clearHotelMapState,40);
    }

    // Als gebruiker terug naar route/home gaat, reset de hotelstaat.
    if(t.closest('[data-action="home"], [data-action="route"], #backHomeBtn, .adjust')){
      setTimeout(clearHotelMapState,40);
    }
  }
  function init(){
    patchPublicApis();
    clearHotelMapState();
    setTimeout(patchPublicApis,500);
    setTimeout(clearHotelMapState,650);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
  document.addEventListener('click',handleClick,true);
})();

/* Roadora v5.6.2 — Hard Mobile Hotel Planner + Back Fix
   - Mobiel nooit desktop/split hotelplanner
   - Hotelplanner terugknop gebruikt echte vorige schermcontext
   - Terug uit Hotels vanaf kaart gaat terug naar kaart, niet Home
*/
(function(){
  'use strict';
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const SOURCE_KEY='roadoraHotelPlannerSourceV562';

  function currentScreen(){
    if(qs('#mapScreen.active')) return 'map';
    if(qs('#routeSetupScreen.active')) return 'route';
    if(qs('#hotelPlannerScreen.active')) return sessionStorage.getItem(SOURCE_KEY)||'home';
    return 'home';
  }
  function rememberSource(src){ sessionStorage.setItem(SOURCE_KEY, src || currentScreen() || 'home'); }
  function forceMobilePlanner(){
    const phone=qs('.phone');
    const screen=qs('#hotelPlannerScreen');
    if(!phone||!screen) return;
    const mobile = (window.matchMedia && (matchMedia('(max-width: 1100px)').matches || matchMedia('(pointer: coarse)').matches));
    phone.classList.toggle('hotelPlannerMobileHard', !!mobile && screen.classList.contains('active'));
    if(mobile) phone.classList.remove('hotelPlannerWide');
  }
  function showMapFromPlanner(){
    qsa('.appScreen').forEach(s=>s.classList.remove('active'));
    qs('#mapScreen')?.classList.add('active');
    qs('.phone')?.classList.add('mapActive');
    qs('.phone')?.classList.remove('hotelPlannerWide','hotelPlannerMobileHard');
    setTimeout(()=>{
      try{ window.initRoadoraMapSubpage?.(); window.roadoraLeafletMap?.invalidateSize(false); }catch(_){ }
    },80);
  }
  function showRouteFromPlanner(){
    qs('#hotelPlannerScreen')?.classList.remove('active');
    qs('.phone')?.classList.remove('hotelPlannerWide','hotelPlannerMobileHard','mapActive');
    window.RoadoraApp?.showRoute?.();
  }
  function showHomeFromPlanner(){
    qs('#hotelPlannerScreen')?.classList.remove('active');
    qs('.phone')?.classList.remove('hotelPlannerWide','hotelPlannerMobileHard','mapActive');
    window.RoadoraApp?.showHome?.();
  }
  function backFromHotelPlanner(){
    const src=sessionStorage.getItem(SOURCE_KEY)||'home';
    if(src==='map') return showMapFromPlanner();
    if(src==='route') return showRouteFromPlanner();
    return showHomeFromPlanner();
  }
  function patchPlannerApi(){
    const hp=window.RoadoraHotelPlanner;
    if(!hp || hp.__v562HardPatch) return;
    const oldShow=hp.show;
    hp.show=function(source){
      rememberSource(source || currentScreen());
      const result=oldShow ? oldShow.apply(this,arguments) : false;
      setTimeout(forceMobilePlanner,30);
      return result;
    };
    hp.__v562HardPatch=true;
  }

  document.addEventListener('pointerdown',function(e){
    const t=e.target;
    if(!t?.closest) return;
    if(t.closest('[data-action="hotels"], .card[data-action="hotels"], .sideItem[data-action="hotels"]')){
      rememberSource(currentScreen());
    }
    if(t.closest('[data-hotel-map-action="planner"], #hotelMapBackBtn')){
      rememberSource('map');
    }
  },true);

  document.addEventListener('click',function(e){
    const t=e.target;
    if(!t?.closest) return;
    if(t.closest('#hotelPlannerScreen [data-hotel-planner-action="back"], #hotelPlannerScreen .hotelDashIcon[aria-label="Terug"]')){
      e.preventDefault();
      e.stopImmediatePropagation();
      return backFromHotelPlanner();
    }
    setTimeout(forceMobilePlanner,60);
  },true);

  function init(){
    patchPlannerApi();
    forceMobilePlanner();
    setTimeout(patchPlannerApi,400);
    setTimeout(forceMobilePlanner,500);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
  window.addEventListener('resize',forceMobilePlanner,{passive:true});
})();

/* Roadora v5.7 Interactielaag v1
   - Nieuwe compacte Stops-overlay boven de bottom nav
   - Eén actieve kaartmodus tegelijk
   - Oude zwevende stops/categorie-states opgeschoond
   - Voorbereid op Mijn Roadtrip v2
*/
(function(){
  'use strict';
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));

  const MODES={
    fuel:{label:'Tankstations',hint:'Tankstations langs je route',toast:'Tankstations langs route'},
    hotel:{label:'Overnachten',hint:'Hotels langs je route',toast:'Hotels langs route'},
    ev:{label:'Laadstations',hint:'Laadstations langs je route',toast:'Laadstations langs route'},
    food:{label:'Eten & drinken',hint:'Eten en pauzeplekken langs je route',toast:'Eten & drinken langs route'},
    view:{label:'Activiteiten',hint:'Uitjes en mooie plekken langs je route',toast:'Activiteiten langs route'},
    wc:{label:'WC-stops',hint:'Toiletten en comfortstops langs je route',toast:'WC-stops langs route'}
  };

  function toast(msg){ window.RoadoraToast ? window.RoadoraToast(msg) : console.log(msg); }
  function phone(){ return qs('.phone'); }
  function mapScreen(){ return qs('#mapScreen'); }

  function ensureStopOverlay(){
    let el=qs('#roadoraStopOverlayV57');
    if(el) return el;
    el=document.createElement('section');
    el.id='roadoraStopOverlayV57';
    el.className='roadoraStopOverlayV57';
    el.setAttribute('aria-label','Stop toevoegen');
    el.innerHTML=`
      <div class="stopOverlayScrimV57" data-stop-overlay-action="close"></div>
      <article class="stopOverlayCardV57">
        <div class="stopOverlayGrabV57"></div>
        <header class="stopOverlayHeadV57">
          <div><span>Stop toevoegen</span><b>Waar ben je naar op zoek?</b></div>
          <button data-stop-overlay-action="close" aria-label="Sluiten" type="button">×</button>
        </header>
        <div class="stopOverlayGridV57">
          <button data-stop-filter="fuel" type="button"><span>⛽</span><b>Tankstation</b><small>Langs route</small></button>
          <button data-stop-filter="hotel" type="button"><span>🛏️</span><b>Overnachten</b><small>Hotels</small></button>
          <button data-stop-filter="ev" type="button"><span>⚡</span><b>Laadpunt</b><small>EV laden</small></button>
          <button data-stop-filter="food" type="button"><span>🍽️</span><b>Eten</b><small>Restaurants</small></button>
          <button data-stop-filter="view" type="button"><span>⛰️</span><b>Uitjes</b><small>Highlights</small></button>
          <button data-stop-filter="wc" type="button"><span>🚻</span><b>WC’s</b><small>Comfortstop</small></button>
        </div>
      </article>`;
    (qs('#mapScreen .roadMapApp')||document.body).appendChild(el);
    return el;
  }

  function closeOverlay(){
    qs('#roadoraStopOverlayV57')?.classList.remove('open');
    mapScreen()?.classList.remove('stopOverlayOpenV57');
    qsa('#mapScreen .bottomNav .navItem').forEach(btn=>{
      if((btn.textContent||'').toLowerCase().includes('stops')) btn.classList.remove('active','is-active');
    });
  }

  function openOverlay(){
    // v6.1: één actieve layer tegelijk. Stops-overlay opent schoon.
    qs('#hotelDetailSheet')?.classList.remove('open','expanded');
    qs('#hotelCompareSheet')?.classList.remove('open');
    qs('#roadtripMiniPanelV584')?.classList.remove('open');
    qsa('#hotelMapBackBtn,#hotelMapMiniActions,#hotelMapRouteToggle,.hotelMapMiniActions,.hotelMapRouteToggle').forEach(el=>el.remove());
    ensureStopOverlay().classList.add('open');
    mapScreen()?.classList.add('stopOverlayOpenV57');
    qsa('#mapScreen .bottomNav .navItem').forEach(btn=>{
      const isStops=(btn.textContent||'').toLowerCase().includes('stops');
      btn.classList.toggle('active',isStops);
      btn.classList.toggle('is-active',isStops);
    });
  }

  function toggleOverlay(){
    const open=qs('#roadoraStopOverlayV57')?.classList.contains('open');
    open ? closeOverlay() : openOverlay();
  }

  function setMapMode(filter){
    qs('#roadtripMiniPanelV584')?.classList.remove('open');
    qs('#hotelDetailSheet')?.classList.remove('open','expanded');
    qs('#hotelCompareSheet')?.classList.remove('open');
    const api=window.RoadoraMapApi;
    const meta=MODES[filter];
    if(!meta || !api) return false;

    closeOverlay();
    qsa('#mapCats .cat').forEach(btn=>btn.classList.toggle('active',btn.dataset.filter===filter));
    qsa('#roadoraStopOverlayV57 [data-stop-filter]').forEach(btn=>btn.classList.toggle('active',btn.dataset.stopFilter===filter));

    mapScreen()?.setAttribute('data-roadora-mode',filter);
    mapScreen()?.classList.remove('hotelMapActive','hotelNearbyActive','hotelRouteActive','fromHotelsMap');
    qsa('#hotelMapBackBtn,#hotelMapMiniActions,#hotelMapRouteToggle,.hotelMapMiniActions,.hotelMapRouteToggle').forEach(el=>el.remove());

    try{ api.setFilters?.([filter]); }catch(_){ }
    if(!['fuel','hotel'].includes(filter)){
      toast(meta.label+' krijgt later live resultaten. Geen demo-pins getoond.');
    }
    try{
      const title=qs('#mapStatusTitle');
      const sub=qs('#mapStatusSub');
      const next=qs('#mapStatusNext');
      if(title) title.textContent=meta.label;
      if(sub) sub.textContent=meta.hint;
      if(next) next.textContent='Kies een stop op de kaart';
    }catch(_){ }
    toast(meta.toast);
    return false;
  }

  function clearMapMode(){
    closeOverlay();
    mapScreen()?.removeAttribute('data-roadora-mode');
    qsa('#roadoraStopOverlayV57 [data-stop-filter], #mapCats .cat').forEach(btn=>btn.classList.remove('active'));
    try{ window.RoadoraMapApi?.setFilters?.([]); window.RoadoraMapApi?.clearSelection?.(); }catch(_){ }
    qsa('#hotelMapBackBtn,#hotelMapMiniActions,#hotelMapRouteToggle,.hotelMapMiniActions,.hotelMapRouteToggle').forEach(el=>el.remove());
    toast('Routekaart opgeschoond');
    return false;
  }

  // Intercept bottom-nav Stops before older handlers toggle the old vertical category list.
  document.addEventListener('click',function(e){
    const t=e.target;
    if(!t?.closest) return;

    const bottomNav=t.closest('#mapScreen .bottomNav .navItem');
    if(bottomNav && (bottomNav.textContent||'').trim().toLowerCase().includes('stops')){
      e.preventDefault();
      e.stopImmediatePropagation();
      toggleOverlay();
      return false;
    }

    const action=t.closest('[data-stop-overlay-action]');
    if(action){
      e.preventDefault();
      e.stopImmediatePropagation();
      if(action.dataset.stopOverlayAction==='close') return closeOverlay();
      if(action.dataset.stopOverlayAction==='clear') return closeOverlay();
    }

    const filter=t.closest('[data-stop-filter]');
    if(filter){
      e.preventDefault();
      e.stopImmediatePropagation();
      return setMapMode(filter.dataset.stopFilter);
    }

    // Keep direct clicks on the legacy category buttons compact and single-mode.
    const legacy=t.closest('#mapCats .cat[data-filter]');
    if(legacy){
      e.preventDefault();
      e.stopImmediatePropagation();
      return setMapMode(legacy.dataset.filter);
    }

    // Any major screen navigation should clean temporary map UI.
    if(t.closest('[data-action="home"], [data-action="route"], [data-action="hotels"], .adjust')){
      closeOverlay();
      qsa('#hotelMapMiniActions,#hotelMapRouteToggle,.hotelMapMiniActions,.hotelMapRouteToggle').forEach(el=>el.remove());
    }
  },true);

  function init(){
    ensureStopOverlay();
    phone()?.classList.add('interactionLayerV57');
    qs('#stopsCta')?.setAttribute('hidden','hidden');
    qsa('#mapCats .cat').forEach(btn=>btn.setAttribute('aria-label',btn.textContent.trim()));
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();

/* Roadora v5.8.4.1 Roadtrip Foundation Stop Select Fix
   - Kleine, future-proof basis voor Mijn Roadtrip
   - Geen map-init wijzigingen
   - Geen timeline/reorder/export complexiteit
   - Alleen: geselecteerde stop opslaan + compacte teller
*/
(function(){
  'use strict';
  const KEY='roadoraRoadtripV1';
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));

  function toast(msg){ window.RoadoraToast ? window.RoadoraToast(msg) : console.log(msg); }
  function read(){
    try{
      const data=JSON.parse(localStorage.getItem(KEY)||'null');
      if(data && Array.isArray(data.stops)) return data;
    }catch(_){ }
    return {version:1,origin:'Rotterdam, Nederland',destination:'Innsbruck, Oostenrijk',stops:[],updatedAt:null};
  }
  function write(data){
    const clean={
      version:1,
      origin:data?.origin||'Rotterdam, Nederland',
      destination:data?.destination||'Innsbruck, Oostenrijk',
      stops:Array.isArray(data?.stops)?data.stops.slice(0,23):[],
      updatedAt:new Date().toISOString()
    };
    localStorage.setItem(KEY,JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent('roadora:roadtrip:update',{detail:clean}));
    renderDock(clean);
    return clean;
  }
  function selectedStop(){
    return window.RoadoraMapApi?.getSelectedStop?.() || window.RoadoraState?.selectedStop || null;
  }
  function stopId(stop){
    return stop?.googlePlaceId || [stop?.type||'stop', stop?.name||'', Array.isArray(stop?.ll)?stop.ll.join(','):''].join(':');
  }
  function normalize(stop){
    return {
      id:stopId(stop),
      name:stop?.name||'Roadora stop',
      type:stop?.type||'stop',
      label:stop?.label||'Tussenstop',
      meta:stop?.meta||'',
      ll:Array.isArray(stop?.ll)?stop.ll:null,
      googlePlaceId:stop?.googlePlaceId||null,
      googleMapsUri:stop?.googleMapsUri||stop?.infoUrl||null,
      photoUrl:stop?.photoUrl||stop?.photo||stop?.imageUrl||stop?.image||'',
      addedAt:new Date().toISOString()
    };
  }
  function canAdd(stop){
    return !!(stop && stop.name && !['destination','overview','stops','guide'].includes(stop.type));
  }
  function focusFullRouteAfterAdd(){
    // v7.2.1: na toevoegen van een stop nooit in stop-focus blijven hangen.
    // Roadtrip-state blijft bewaard; alleen tijdelijke ontdek/detail-lagen sluiten.
    clearTimeout(focusFullRouteAfterAdd._timer);
    focusFullRouteAfterAdd._timer=setTimeout(()=>{
      try{ window.RoadoraMapApi?.setFilters?.([]); }catch(_){}
      try{ window.RoadoraMapApi?.closeCategories?.(); }catch(_){}
      try{ window.RoadoraMapApi?.clearSelection?.(); }catch(_){}
      try{ window.RoadoraTripMap?.render?.(); }catch(_){}
      try{ window.RoadoraMapApi?.reloadRoute?.(); }catch(_){}
      setTimeout(()=>{
        try{ window.RoadoraMapApi?.fitRoute?.('add-stop-full-route'); }catch(_){}
        try{ window.RoadoraTripMap?.fit?.('add-stop-full-route'); }catch(_){}
      },850);
    },80);
  }
  function add(stop){
    if(!canAdd(stop)){ toast('Kies eerst een echte tussenstop'); return false; }
    const data=read();
    const item=normalize(stop);
    const exists=data.stops.some(s=>s.id===item.id);
    if(!exists) data.stops.push(item);
    write(data);
    toast(exists?'Staat al in je roadtrip':'Toegevoegd aan je roadtrip');
    updateSaveButton();
    focusFullRouteAfterAdd();
    return true;
  }
  function remove(id){
    const data=read();
    data.stops=data.stops.filter(s=>String(s.id)!==String(id));
    write(data);
    if(qs('#roadtripMiniPanelV584')?.classList.contains('open')) renderPanel();
    toast('Stop verwijderd');
  }
  function clear(){
    const data=read();
    data.stops=[];
    write(data);
    if(qs('#roadtripMiniPanelV584')?.classList.contains('open')) renderPanel();
    toast('Roadtrip geleegd');
  }
  function ensureDock(){
    let dock=qs('#roadtripMiniDockV584');
    if(dock) return dock;
    dock=document.createElement('button');
    dock.id='roadtripMiniDockV584';
    dock.className='roadtripMiniDockV584';
    dock.type='button';
    dock.innerHTML='<span>⌁</span><b>Mijn Roadtrip</b><em>0 stops</em>';
    (qs('#mapScreen .roadMapApp')||document.body).appendChild(dock);
    return dock;
  }
  function ensurePanel(){
    let panel=qs('#roadtripMiniPanelV584');
    if(panel) return panel;
    panel=document.createElement('section');
    panel.id='roadtripMiniPanelV584';
    panel.className='roadtripMiniPanelV584';
    panel.innerHTML=`
      <div class="roadtripPanelScrimV584" data-roadtrip-action="close"></div>
      <article class="roadtripPanelCardV584">
        <header><div><span>Mijn Roadtrip</span><b>Je gekozen tussenstops</b></div><button type="button" data-roadtrip-action="close">×</button></header>
        <div class="roadtripPanelListV584"></div>
        <footer><button type="button" data-roadtrip-action="clear">Leegmaken</button><button type="button" data-roadtrip-action="close">Klaar</button></footer>
      </article>`;
    (qs('#mapScreen .roadMapApp')||document.body).appendChild(panel);
    return panel;
  }
  function renderDock(data=read()){
    const dock=ensureDock();
    const count=data.stops.length;
    dock.hidden=count===0;
    dock.innerHTML=`<span>⌁</span><b>Mijn Roadtrip</b><em>${count} stop${count===1?'':'s'}</em>`;
  }
  function renderPanel(){
    // v6.1: Mijn Roadtrip krijgt focus; andere layers dicht.
    qs('#roadoraStopOverlayV57')?.classList.remove('open');
    qs('#mapScreen')?.classList.remove('stopOverlayOpenV57');
    qs('#hotelDetailSheet')?.classList.remove('open','expanded');
    qs('#hotelCompareSheet')?.classList.remove('open');
    const data=read();
    const panel=ensurePanel();
    const list=qs('.roadtripPanelListV584',panel);
    if(list){
      list.innerHTML=data.stops.length?data.stops.map((s,i)=>`
        <div class="roadtripPanelItemV584" data-roadtrip-id="${escapeAttr(s.id)}">
          <i>${i+1}</i><div><b>${escapeHtml(s.name)}</b><small>${escapeHtml(s.label||s.type||'Stop')} · ${escapeHtml(s.meta||'Langs je route')}</small></div>
          <button type="button" data-roadtrip-action="remove" data-roadtrip-id="${escapeAttr(s.id)}">×</button>
        </div>`).join(''):'<p class="roadtripPanelEmptyV584">Kies een stop op de kaart en tik op “Voeg toe aan roadtrip”.</p>';
    }
    qs('#mapScreen')?.classList.add('roadtripPanelOpenV621');
    panel.classList.add('open');
  }
  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function escapeAttr(value){return escapeHtml(value).replace(/`/g,'');}
  function closePanel(){ qs('#roadtripMiniPanelV584')?.classList.remove('open'); qs('#mapScreen')?.classList.remove('roadtripPanelOpenV621'); }
  function updateSaveButton(){
    const btn=qs('#mapScreen .sheetActions .saveStop');
    if(!btn) return;
    const stop=selectedStop();
    if(canAdd(stop)){
      const wanted='＋ Voeg toe aan roadtrip';
      if(btn.disabled) btn.disabled=false;
      if(btn.classList.contains('is-disabled')) btn.classList.remove('is-disabled');
      if((btn.textContent||'').trim()!==wanted) btn.textContent=wanted;
    }
  }

  document.addEventListener('click',function(e){
    const t=e.target;
    if(!t?.closest) return;

    if(t.closest('#mapScreen .sheetActions .saveStop')){
      const stop=selectedStop();
      if(canAdd(stop)){
        e.preventDefault();
        e.stopImmediatePropagation();
        add(stop);
        return false;
      }
    }
    if(t.closest('#roadtripMiniDockV584')){
      e.preventDefault();
      e.stopImmediatePropagation();
      renderPanel();
      return false;
    }
    const action=t.closest('[data-roadtrip-action]');
    if(action){
      e.preventDefault();
      e.stopImmediatePropagation();
      const a=action.dataset.roadtripAction;
      if(a==='close') return closePanel();
      if(a==='clear') return clear();
      if(a==='remove') return remove(action.dataset.roadtripId);
    }
  },true);

  let updateQueued=false;
  const observer=new MutationObserver(()=>{
    if(updateQueued) return;
    updateQueued=true;
    requestAnimationFrame(()=>{ updateQueued=false; updateSaveButton(); });
  });
  function init(){
    ensureDock();
    ensurePanel();
    renderDock();
    updateSaveButton();
    const sheet=qs('#mapScreen .sheet');
    // Alleen tekst/inhoud observeren, geen attributes. Dit voorkomt een mutation-loop
    // zodra de save-knop zelf wordt aangepast na het kiezen van een stop.
    if(sheet) observer.observe(sheet,{childList:true,subtree:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();

  window.RoadoraRoadtrip={read,write,addSelected:()=>add(selectedStop()),add,remove,clear};
})();


/* Roadora v5.9 Flow Polish
   - Bottom nav: Route / Stops / Navigeer / Mijn Roadtrip / Meer
   - Overzicht/Reisgids uit primaire flow
   - Mijn Roadtrip opent bestaand compact paneel
   - Profile hint op home blijft subtiel
*/
(function(){
  'use strict';
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const KEY='roadoraRoadtripV1';
  function toast(msg){ window.RoadoraToast ? window.RoadoraToast(msg) : console.log(msg); }
  function readTrip(){
    try{return JSON.parse(localStorage.getItem(KEY)||'{"stops":[]}')||{stops:[]};}
    catch(_){return {stops:[]};}
  }
  function setBottomActive(nav){
    qsa('#mapScreen .bottomNav .navItem').forEach(b=>{
      const is=(b.dataset.nav||'').toLowerCase()===nav;
      b.classList.toggle('active',is);
      b.classList.toggle('is-active',is);
    });
  }
  function openRoadtripPanel(){
    const dock=qs('#roadtripMiniDockV584');
    if(dock){ dock.click(); return true; }
    const panel=qs('#roadtripMiniPanelV584');
    if(panel){ panel.classList.add('open'); return true; }
    toast('Voeg eerst een stop toe aan je roadtrip');
    return false;
  }
  function updateRoadtripCount(){
    const data=readTrip();
    const count=Array.isArray(data.stops)?data.stops.length:0;
    qsa('#mapScreen .bottomNav .navItem[data-nav="roadtrip"]').forEach(btn=>{
      btn.dataset.roadtripCount=String(count);
      btn.classList.toggle('roadtripHasStops',count>0);
    });
  }
  function closeTransientPanels(){
    qs('#roadoraStopOverlayV57')?.classList.remove('open');
    qs('#mapScreen')?.classList.remove('stopOverlayOpenV57');
    qs('#roadtripMiniPanelV584')?.classList.remove('open');
    qs('#mapScreen')?.classList.remove('roadtripPanelOpenV621');
    qs('#hotelDetailSheet')?.classList.remove('open');
    qs('#hotelCompareSheet')?.classList.remove('open');
  }
  document.addEventListener('click',function(e){
    const t=e.target;
    if(!t?.closest) return;

    const profile=t.closest('.profileHintV59');
    if(profile){
      e.preventDefault();
      toast('Profiel komt later: voorkeuren worden straks opgeslagen voor betere matches');
      return false;
    }

    const item=t.closest('#mapScreen .bottomNav .navItem[data-nav]');
    if(!item) return;
    const nav=(item.dataset.nav||'').toLowerCase();
    if(!nav) return;

    if(nav==='route'){
      e.preventDefault();
      setBottomActive('route');
      closeTransientPanels();
      window.RoadoraMapApi?.fitRoute?.('nav');
      toast('Route in beeld');
      return false;
    }

    if(nav==='roadtrip'){
      e.preventDefault();
      e.stopImmediatePropagation();
      setBottomActive('roadtrip');
      openRoadtripPanel();
      return false;
    }

    if(nav==='more'){
      e.preventDefault();
      e.stopImmediatePropagation();
      setBottomActive('more');
      closeTransientPanels();
      const btn=qs('#mapScreen [data-menu-open], #menuToggle');
      if(btn) btn.click();
      else document.querySelector('.phone')?.classList.add('menuOpen','menuExpanded');
      toast('Menu geopend');
      return false;
    }

    if(nav==='navigate'){
      setBottomActive('navigate');
      return;
    }
    if(nav==='stops'){
      setBottomActive('stops');
      return;
    }
  },true);

  window.addEventListener('storage',updateRoadtripCount);
  window.addEventListener('roadora:roadtrip:update',updateRoadtripCount);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',updateRoadtripCount,{once:true});
  else updateRoadtripCount();
})();


/* Roadora v6.0 UX Polish v2 final
   - Profielhint op Home zichtbaar en subtiel
   - WC categorie werkt als simpele comfortstop
   - Geen grote nieuwe systemen; alleen polish/state hardening
*/
(function(){
  'use strict';
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  function toast(msg){ window.RoadoraToast ? window.RoadoraToast(msg) : console.log(msg); }
  function closeMapOverlays(){
    qs('#hotelDetailSheet')?.classList.remove('open','expanded');
    qs('#hotelCompareSheet')?.classList.remove('open');
  }
  document.addEventListener('click',function(e){
    const t=e.target;
    if(!t?.closest) return;
    const hint=t.closest('.profileHintV60,[data-action="profile-hint"]');
    if(hint){
      e.preventDefault();
      toast('Profiel komt later: minder filters, betere hotels en stops');
      return false;
    }
    const cat=t.closest('#mapScreen .cat[data-filter="wc"]');
    if(cat){
      // Laat de bestaande categorie-handler zijn werk doen, maar geef een duidelijke context-toast.
      setTimeout(()=>toast('WC-stops langs je route'),80);
    }
    const nav=t.closest('#mapScreen .bottomNav .navItem[data-nav]');
    if(nav && nav.dataset.nav!=='roadtrip'){
      closeMapOverlays();
    }
  },true);
  function init(){
    qsa('#mapScreen .cat[data-filter="wc"]').forEach(btn=>{
      if(!btn.getAttribute('aria-label')) btn.setAttribute('aria-label','WC-stops tonen');
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();


/* Roadora v6.1 Layer Focus Polish Goed
   - Home terug naar cinematic: geen profielkaart op Home
   - Eén actieve kaartlaag tegelijk: Stops / Hotel detail / Mijn Roadtrip
   - WC blijft onderdeel van Stops-overlay
*/
(function(){
  'use strict';
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  function closeStopOverlay(){
    qs('#roadoraStopOverlayV57')?.classList.remove('open');
    qs('#mapScreen')?.classList.remove('stopOverlayOpenV57');
  }
  function closeRoadtrip(){ qs('#roadtripMiniPanelV584')?.classList.remove('open'); qs('#mapScreen')?.classList.remove('roadtripPanelOpenV621'); }
  function closeHotelSheets(){
    qs('#hotelDetailSheet')?.classList.remove('open','expanded');
    qs('#hotelCompareSheet')?.classList.remove('open');
  }
  document.addEventListener('click',function(e){
    const t=e.target;
    if(!t?.closest) return;
    if(t.closest('#mapScreen .bottomNav .navItem[data-nav="stops"]')){
      closeRoadtrip();
      closeHotelSheets();
      return;
    }
    if(t.closest('#roadtripMiniDockV584, #mapScreen .bottomNav .navItem[data-nav="roadtrip"]')){
      closeStopOverlay();
      closeHotelSheets();
      return;
    }
    if(t.closest('[data-stop-filter], #mapCats .cat[data-filter]')){
      closeRoadtrip();
      closeHotelSheets();
      return;
    }
    if(t.closest('#mapScreen .sheetActions .primary, #mapScreen .sheetActions .secondary')){
      closeStopOverlay();
      closeRoadtrip();
    }
    if(t.closest('[data-action="home"], [data-action="route"], [data-action="hotels"], .adjust, #backHomeBtn')){
      closeStopOverlay();
      closeRoadtrip();
      closeHotelSheets();
      qsa('#hotelMapBackBtn,#hotelMapMiniActions,#hotelMapRouteToggle,.hotelMapMiniActions,.hotelMapRouteToggle').forEach(el=>el.remove());
    }
  },true);
  function init(){
    qsa('.profileHintV59,.profileHintV60').forEach(el=>el.remove());
    document.body.classList.add('roadoraV61LayerFocusGoed');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();

/* Roadora v6.2 Focus & Calm marker */
(function(){
  'use strict';
  function mark(){document.body.classList.add('roadoraV62FocusCalm','roadoraV621BottomSheetHide');}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mark,{once:true});
  else mark();
})();

/* Roadora v7.0.4 Roadtrip Timeline State — Future Proof
   - Bottom bar is de enige ingang voor Mijn Roadtrip (geen extra zwevende dock)
   - Stabiel paneel met start, gekozen stops en bestemming
   - Direct verwijderen met live refresh
   - Open stop op kaart
   - Google Maps export met tussenstops
   - Geen map-init wijzigingen, dus veilige laag bovenop de stabiele basis
*/
(function(){
  'use strict';
  const KEY='roadoraRoadtripV1';
  const ROUTE_SUMMARY_KEY='roadoraRouteSummaryV1';
  const ORIGIN='Rotterdam, Nederland';
  const DESTINATION='Innsbruck, Oostenrijk';
  const ORIGIN_LL=[51.9244,4.4777];
  const DEST_LL=[47.2692,11.4041];
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));

  function toast(msg){ window.RoadoraToast ? window.RoadoraToast(msg) : console.log(msg); }
  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function escapeAttr(value){ return escapeHtml(value).replace(/`/g,''); }
  function read(){
    try{
      const data=JSON.parse(localStorage.getItem(KEY)||'{}');
      return {
        version:data.version||1,
        origin:data.origin||ORIGIN,
        destination:data.destination||DESTINATION,
        stops:Array.isArray(data.stops)?data.stops.filter(Boolean):[],
        updatedAt:data.updatedAt||null
      };
    }catch(_){
      return {version:1,origin:ORIGIN,destination:DESTINATION,stops:[],updatedAt:null};
    }
  }
  function write(data){
    const clean={
      version:1,
      origin:data?.origin||ORIGIN,
      destination:data?.destination||DESTINATION,
      stops:Array.isArray(data?.stops)?data.stops.filter(Boolean).slice(0,9):[],
      updatedAt:new Date().toISOString()
    };
    localStorage.setItem(KEY,JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent('roadora:roadtrip:update',{detail:clean}));
    updateBadge(clean);
    return clean;
  }
  function typeIcon(type){
    const t=String(type||'').toLowerCase();
    if(t==='hotel') return '🏨';
    if(t==='fuel') return '⛽';
    if(t==='ev') return '⚡';
    if(t==='food') return '🍽️';
    if(t==='view') return '⛰️';
    if(t==='wc') return '🚻';
    return '📍';
  }
  function pointQuery(item){
    if(Array.isArray(item?.ll) && Number.isFinite(Number(item.ll[0])) && Number.isFinite(Number(item.ll[1]))){
      return `${Number(item.ll[0]).toFixed(6)},${Number(item.ll[1]).toFixed(6)}`;
    }
    return item?.name || '';
  }
  function mapsUrl(){
    const data=read();
    const params=new URLSearchParams();
    params.set('api','1');
    // v6.9.2: origin bewust weglaten. Google Maps gebruikt dan de actuele locatie
    // en toont op mobiel weer de Start-knop, óók met waypoints.
    params.set('destination',data.destination||DESTINATION);
    params.set('travelmode','driving');
    const waypoints=data.stops.map(pointQuery).filter(Boolean).slice(0,9);
    if(waypoints.length) params.set('waypoints',waypoints.join('|'));
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }
  function ensurePanel(){
    let panel=qs('#roadtripMiniPanelV584');
    if(panel) return panel;
    panel=document.createElement('section');
    panel.id='roadtripMiniPanelV584';
    panel.className='roadtripMiniPanelV584';
    (qs('#mapScreen .roadMapApp')||document.body).appendChild(panel);
    return panel;
  }
  function updateBadge(data=read()){
    const count=data.stops.length;
    qsa('#mapScreen .bottomNav .navItem[data-nav="roadtrip"]').forEach(btn=>{
      btn.dataset.roadtripCount=String(count);
      btn.classList.toggle('roadtripHasStops',count>0);
      btn.setAttribute('aria-label', count ? `Mijn Roadtrip met ${count} stop${count===1?'':'s'}` : 'Mijn Roadtrip');
    });
    const dock=qs('#roadtripMiniDockV584');
    if(dock) dock.hidden=true;
  }
  function readRouteSummary(){
    try{
      const r=JSON.parse(localStorage.getItem(ROUTE_SUMMARY_KEY)||'{}');
      return {
        distanceMeters:Number(r.distanceMeters)||0,
        durationSeconds:Number(r.durationSeconds)||0,
        distanceLabel:r.distanceLabel||'',
        timeLabel:r.timeLabel||''
      };
    }catch(_){ return {distanceMeters:0,durationSeconds:0,distanceLabel:'',timeLabel:''}; }
  }
  function isPoint(stop){
    return Array.isArray(stop?.ll) && Number.isFinite(Number(stop.ll[0])) && Number.isFinite(Number(stop.ll[1]));
  }
  function haversineMeters(a,b){
    if(!a||!b) return 0;
    const R=6371000;
    const toRad=x=>Number(x)*Math.PI/180;
    const dLat=toRad(b[0]-a[0]);
    const dLng=toRad(b[1]-a[1]);
    const lat1=toRad(a[0]);
    const lat2=toRad(b[0]);
    const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  }
  function fmtKm(m){
    if(!Number.isFinite(m)||m<=0) return '— km';
    return Math.round(m/1000).toLocaleString('nl-NL')+' km';
  }
  function fmtTime(sec){
    if(!Number.isFinite(sec)||sec<=0) return '—';
    const min=Math.max(1,Math.round(sec/60));
    return Math.floor(min/60)+'u '+String(min%60).padStart(2,'0')+'m';
  }
  function segmentEstimates(data){
    const summary=readRouteSummary();
    const stops=(data.stops||[]).filter(isPoint);
    const pts=[ORIGIN_LL,...stops.map(s=>[Number(s.ll[0]),Number(s.ll[1])]),DEST_LL];
    const straight=[];
    for(let i=0;i<pts.length-1;i++) straight.push(Math.max(1,haversineMeters(pts[i],pts[i+1])));
    const totalStraight=straight.reduce((a,b)=>a+b,0)||1;
    const totalMeters=summary.distanceMeters||totalStraight*1.18;
    const totalSeconds=summary.durationSeconds||totalMeters/24;
    return straight.map(m=>({
      distanceLabel:fmtKm(totalMeters*(m/totalStraight)),
      timeLabel:fmtTime(totalSeconds*(m/totalStraight))
    }));
  }
  function writeOptimisticRouteSummary(data){
    // v6.9.7: direct feedback na verwijderen/leegmaken, vóór ORS klaar is.
    // ORS overschrijft dit daarna met de echte route-samenvatting.
    try{
      const stops=(data.stops||[]).filter(isPoint);
      const pts=[ORIGIN_LL,...stops.map(s=>[Number(s.ll[0]),Number(s.ll[1])]),DEST_LL];
      let straight=0;
      for(let i=0;i<pts.length-1;i++) straight+=Math.max(1,haversineMeters(pts[i],pts[i+1]));
      const distanceMeters=Math.round(straight*1.18);
      const durationSeconds=Math.round(distanceMeters/24);
      localStorage.setItem(ROUTE_SUMMARY_KEY,JSON.stringify({
        distanceMeters,
        durationSeconds,
        distanceLabel:fmtKm(distanceMeters),
        timeLabel:fmtTime(durationSeconds),
        stopCount:stops.length,
        provisional:true,
        updatedAt:new Date().toISOString()
      }));
    }catch(_){ }
  }
  function routeSummaryLabel(data){
    const summary=readRouteSummary();
    const parts=[];
    if(data.stops.length) parts.push(`${data.stops.length} stop${data.stops.length===1?'':'s'}`);
    if(summary.distanceLabel) parts.push(summary.distanceLabel);
    if(summary.timeLabel) parts.push(summary.timeLabel);
    return parts.join(' · ') || (data.stops.length ? `${data.stops.length} stop${data.stops.length===1?'':'s'} toegevoegd` : 'Bouw je route met tussenstops');
  }
  function closeOtherLayers(){
    qs('#roadoraStopOverlayV57')?.classList.remove('open');
    qs('#mapScreen')?.classList.remove('stopOverlayOpenV57');
    qs('#hotelDetailSheet')?.classList.remove('open','expanded');
    qs('#hotelCompareSheet')?.classList.remove('open');
  }
  function renderPanel(){
    const data=read();
    const panel=ensurePanel();
    closeOtherLayers();
    const stops=data.stops;
    const segments=segmentEstimates(data);
    const segmentRow=(seg,label)=>`<div class="roadtripV693Segment"><span>${escapeHtml(label||'Rijden')}</span><b>${escapeHtml(seg?.distanceLabel||'— km')} · ${escapeHtml(seg?.timeLabel||'—')}</b></div>`;
    const stopRows=stops.length ? stops.map((s,i)=>`
      ${segmentRow(segments[i], i===0?'Vanaf start':'Volgend traject')}
      <div class="roadtripV63Stop" data-trip-id="${escapeAttr(s.id)}">
        <div class="roadtripV63Index">${i+1}</div>
        <div class="roadtripV63Icon">${typeIcon(s.type)}</div>
        <button class="roadtripV63Main" type="button" data-tripv63-action="focus" data-trip-id="${escapeAttr(s.id)}">
          <b>${escapeHtml(s.name||'Tussenstop')}</b>
          <small>${escapeHtml(s.label||s.type||'Stop')}${s.meta ? ' · '+escapeHtml(s.meta) : ''}</small>
        </button>
        <button class="roadtripV63Remove" type="button" data-tripv63-action="remove" data-trip-id="${escapeAttr(s.id)}" aria-label="Stop verwijderen">×</button>
      </div>`).join('') + segmentRow(segments[stops.length], 'Naar eindbestemming') : `
      <div class="roadtripV63Empty">
        <b>Nog geen tussenstops</b>
        <span>Kies een hotel, tankstation, laadpunt of uitje op de kaart en tik op “Voeg toe aan roadtrip”.</span>
      </div>`;

    panel.innerHTML=`
      <div class="roadtripPanelScrimV584" data-tripv63-action="close"></div>
      <article class="roadtripPanelCardV584 roadtripV63Card" role="dialog" aria-label="Mijn Roadtrip">
        <header class="roadtripV63Head">
          <div><span>Mijn Roadtrip</span><b>${escapeHtml(routeSummaryLabel(data))}</b></div>
          <button type="button" data-tripv63-action="close" aria-label="Sluiten">×</button>
        </header>
        <div class="roadtripV63RouteLine">
          <div class="roadtripV63Endpoint"><i>Start</i><b>${escapeHtml(data.origin)}</b></div>
          ${stopRows}
          <div class="roadtripV63Endpoint"><i>Eind</i><b>${escapeHtml(data.destination)}</b></div>
        </div>
        <footer class="roadtripV63Footer">
          <button type="button" class="roadtripV63Ghost" data-tripv63-action="clear" ${stops.length?'':'disabled'}>Leegmaken</button>
          <button type="button" class="roadtripV63Primary" data-tripv63-action="maps">Start in Google Maps</button>
        </footer>
      </article>`;
    qs('#mapScreen')?.classList.add('roadtripPanelOpenV621','roadtripPanelOpenV63');
    panel.classList.add('open','roadtripV63Open');
    updateBadge(data);
  }
  function closePanel(){
    qs('#roadtripMiniPanelV584')?.classList.remove('open','roadtripV63Open');
    qs('#mapScreen')?.classList.remove('roadtripPanelOpenV621','roadtripPanelOpenV63');
  }
  function refreshRouteAfterTripChange(){
    clearTimeout(refreshRouteAfterTripChange._timer);
    refreshRouteAfterTripChange._timer=setTimeout(()=>{
      try{ window.RoadoraMapApi?.reloadRoute?.(); }catch(_){ }
      try{ window.RoadoraTripMap?.render?.(); }catch(_){ }
      if(qs('#roadtripMiniPanelV584')?.classList.contains('open')) setTimeout(renderPanel,650);
    },70);
  }
  function removeStop(id){
    const data=read();
    data.stops=data.stops.filter(s=>String(s.id)!==String(id));
    const clean=write(data);
    writeOptimisticRouteSummary(clean);
    renderPanel();
    refreshRouteAfterTripChange();
    toast('Stop verwijderd');
  }
  function clearStops(){
    const data=read();
    if(!data.stops.length) return;
    data.stops=[];
    const clean=write(data);
    writeOptimisticRouteSummary(clean);
    renderPanel();
    refreshRouteAfterTripChange();
    toast('Roadtrip geleegd');
  }
  function findStop(id){ return read().stops.find(s=>String(s.id)===String(id)); }
  function focusStop(id){
    const stop=findStop(id);
    if(!stop){ toast('Stop niet gevonden'); return; }
    closePanel();
    try{
      window.RoadoraMapApi?.showPanel?.(stop);
      setTimeout(()=>window.RoadoraMapApi?.focusSelected?.(),80);
      toast('Stop geopend op kaart');
    }catch(err){
      console.warn('Roadtrip focus stop:',err);
      toast('Openen op kaart lukt niet');
    }
  }
  function openMaps(){
    window.open(mapsUrl(),'_blank','noopener');
    const count=read().stops.length;
    toast(count ? `Google Maps geopend met ${count} tussenstop${count===1?'':'s'}` : 'Google Maps route geopend');
  }
  function setBottomActive(nav){
    qsa('#mapScreen .bottomNav .navItem').forEach(b=>{
      const is=(b.dataset.nav||'').toLowerCase()===nav;
      b.classList.toggle('active',is);
      b.classList.toggle('is-active',is);
    });
  }
  function closeTransientPanels(){
    closeOtherLayers();
    closePanel();
    qs('#roadoraStopOverlayV57')?.classList.remove('open');
    qs('#mapScreen')?.classList.remove('stopOverlayOpenV57','roadtripPanelOpenV621','roadtripPanelOpenV63');
  }

  document.addEventListener('click',function(e){
    const t=e.target;
    if(!t?.closest) return;

    const nav=t.closest('#mapScreen .bottomNav .navItem[data-nav="roadtrip"]');
    if(nav){
      e.preventDefault();
      e.stopImmediatePropagation();
      qsa('#mapScreen .bottomNav .navItem').forEach(b=>b.classList.toggle('active',b===nav));
      renderPanel();
      return false;
    }

    const action=t.closest('[data-tripv63-action]');
    if(action){
      e.preventDefault();
      e.stopImmediatePropagation();
      const a=action.dataset.tripv63Action;
      if(a==='close') return closePanel();
      if(a==='remove') return removeStop(action.dataset.tripId);
      if(a==='clear') return clearStops();
      if(a==='focus') return focusStop(action.dataset.tripId);
      if(a==='maps') return openMaps();
    }
  },true);

  window.addEventListener('roadora:roadtrip:update',function(e){ updateBadge(e.detail||read()); });
  window.addEventListener('storage',function(e){ if(!e.key || e.key===KEY) updateBadge(); });
  function init(){
    updateBadge();
    const dock=qs('#roadtripMiniDockV584');
    if(dock) dock.hidden=true;
    document.body.classList.add('roadoraV631RoadtripFlowGoed');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();

  window.RoadoraRoadtripPanel={open:renderPanel,render:renderPanel,close:closePanel,segments:segmentEstimates};
  window.RoadoraMapsExport={url:mapsUrl,open:openMaps};
})();


/* Roadora v6.4 Route Core Functionality — Goed
   - Mijn Roadtrip-stops zijn zichtbaar op de kaart
   - Route-tab focust op de volledige route inclusief gekozen stops
   - Eén centrale stoplijst uit localStorage blijft de bron voor kaart + Maps-export
   - Veilige standalone laag: geen wijzigingen aan map-init of ORS flow
*/
(function(){
  'use strict';
  const KEY='roadoraRoadtripV1';
  const ORIGIN_LL=[51.9244,4.4777];
  const DEST_LL=[47.2692,11.4041];
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  let layer=null;
  let bootTimer=null;

  function toast(msg){ window.RoadoraToast ? window.RoadoraToast(msg) : console.log(msg); }
  function read(){
    try{
      const data=JSON.parse(localStorage.getItem(KEY)||'{}');
      return Array.isArray(data.stops)?data.stops.filter(Boolean):[];
    }catch(_){ return []; }
  }
  function isPoint(stop){
    return Array.isArray(stop?.ll) && Number.isFinite(Number(stop.ll[0])) && Number.isFinite(Number(stop.ll[1]));
  }
  function iconFor(type){
    const t=String(type||'').toLowerCase();
    if(t==='hotel') return '🏨';
    if(t==='fuel') return '⛽';
    if(t==='ev') return '⚡';
    if(t==='food') return '🍽️';
    if(t==='view') return '⛰️';
    if(t==='wc') return '🚻';
    return '📍';
  }
  function ensureLayer(){
    const map=window.roadoraLeafletMap;
    if(!map || !window.L) return null;
    if(!layer){
      layer=window.L.layerGroup().addTo(map);
    }
    return layer;
  }
  function makeIcon(stop,index){
    const html=`<div class="roadtripMapPinV64" data-roadtrip-type="${String(stop?.type||'stop').replace(/"/g,'')}"><span>${index+1}</span><b>${iconFor(stop?.type)}</b></div>`;
    return window.L.divIcon({html,iconSize:[34,34],iconAnchor:[17,17],className:''});
  }
  function routePoints(stops=read()){
    const pts=[ORIGIN_LL];
    stops.forEach(s=>{ if(isPoint(s)) pts.push([Number(s.ll[0]),Number(s.ll[1])]); });
    pts.push(DEST_LL);
    return pts;
  }
  function render(){
    const map=window.roadoraLeafletMap;
    const L=window.L;
    const group=ensureLayer();
    if(!map || !L || !group) return false;
    group.clearLayers();
    const stops=read().filter(isPoint);

    // v7.0.3: geen roadtrip-hulplijn meer tekenen.
    // De enige route-lijn in de kaart is de echte blauwe ORS-route.
    // Roadtrip-stops blijven zichtbaar als genummerde pins bovenop de route.

    stops.forEach((stop,index)=>{
      const marker=L.marker([Number(stop.ll[0]),Number(stop.ll[1])],{icon:makeIcon(stop,index),zIndexOffset:900}).addTo(group);
      marker.on('click',()=>{
        try{
          window.RoadoraMapApi?.showPanel?.(stop);
          setTimeout(()=>window.RoadoraMapApi?.focusSelected?.(),60);
          toast('Roadtrip-stop geopend');
        }catch(err){
          console.warn('Roadtrip marker open:',err);
        }
      });
    });
    document.body.classList.toggle('roadoraHasTripStopsV64',stops.length>0);
    return true;
  }
  function fitTripRoute(reason='route'){
    const map=window.roadoraLeafletMap;
    const L=window.L;
    if(!map || !L) return;
    const stops=read().filter(isPoint);
    const pts=routePoints(stops);
    const bounds=L.latLngBounds(pts.map(p=>L.latLng(p[0],p[1])));
    const small=window.matchMedia?.('(max-width: 560px)')?.matches;
    try{
      render();
      map.invalidateSize(false);
      map.fitBounds(bounds, small?{paddingTopLeft:[26,118],paddingBottomRight:[26,148],maxZoom:8}:{paddingTopLeft:[48,150],paddingBottomRight:[48,182],maxZoom:8});
      toast(stops.length?`Volledige roadtrip in beeld · ${stops.length} stop${stops.length===1?'':'s'}`:'Volledige route in beeld');
    }catch(err){ console.warn('Roadtrip fit:',err); }
  }
  function scheduleRender(){
    clearTimeout(bootTimer);
    bootTimer=setTimeout(()=>{
      if(!render()) scheduleRender();
    },180);
  }

  document.addEventListener('click',function(e){
    const t=e.target;
    if(!t?.closest) return;
    const routeNav=t.closest('#mapScreen .bottomNav .navItem[data-nav="route"]');
    if(routeNav){
      // v7.0.4 Route Clean Mode: Route-tab toont alleen de actieve blauwe ORS-route + gekozen roadtrip-stops.
      // Roadtrip-state blijft bewaard; alleen tijdelijke categorie/detail lagen gaan dicht.
      try{ window.RoadoraMapApi?.setFilters?.([]); }catch(_){}
      try{ window.RoadoraMapApi?.closeCategories?.(); }catch(_){}
      try{ window.RoadoraMapApi?.clearSelection?.(); }catch(_){}
      try{ window.RoadoraRoadtripPanel?.close?.(); }catch(_){}
      setTimeout(()=>fitTripRoute('route-clean'),120);
      return;
    }
  },true);

  window.addEventListener('roadora:roadtrip:update',()=>{ scheduleRender(); });
  window.addEventListener('storage',e=>{ if(!e.key || e.key===KEY) scheduleRender(); });
  window.addEventListener('resize',()=>scheduleRender());

  const oldInit=window.initRoadoraMapSubpage;
  if(typeof oldInit==='function' && !oldInit.__roadoraV64Wrapped){
    const wrapped=function(){
      const res=oldInit.apply(this,arguments);
      scheduleRender();
      return res;
    };
    wrapped.__roadoraV64Wrapped=true;
    window.initRoadoraMapSubpage=wrapped;
  }

  window.RoadoraTripMap={render,fit:fitTripRoute};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',scheduleRender,{once:true}); else scheduleRender();
})();

/* Roadora v7.0.5 — Roadtrip Panel Final Override
   - Forceert één correcte Mijn Roadtrip-weergave boven oudere panel handlers
   - Toont start, eindbestemming en km/tijd per traject
   - Raakt Maps-export en ORS-route niet aan
*/
(function(){
  'use strict';
  const KEY='roadoraRoadtripV1';
  const SUMMARY_KEY='roadoraRouteSummaryV1';
  const ORIGIN='Rotterdam, Nederland';
  const DEST='Innsbruck, Oostenrijk';
  const ORIGIN_LL=[51.9244,4.4777];
  const DEST_LL=[47.2692,11.4041];
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));

  function esc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function read(){
    try{
      const d=JSON.parse(localStorage.getItem(KEY)||'{}');
      return {origin:d.origin||ORIGIN,destination:d.destination||DEST,stops:Array.isArray(d.stops)?d.stops.filter(Boolean):[]};
    }catch(_){return {origin:ORIGIN,destination:DEST,stops:[]};}
  }
  function write(data){
    const clean={version:1,origin:data.origin||ORIGIN,destination:data.destination||DEST,stops:(data.stops||[]).filter(Boolean).slice(0,9),updatedAt:new Date().toISOString()};
    localStorage.setItem(KEY,JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent('roadora:roadtrip:update',{detail:clean}));
    return clean;
  }
  function summary(){
    try{return JSON.parse(localStorage.getItem(SUMMARY_KEY)||'{}')||{};}catch(_){return {};}
  }
  function isPoint(s){return Array.isArray(s?.ll)&&Number.isFinite(Number(s.ll[0]))&&Number.isFinite(Number(s.ll[1]));}
  function hav(a,b){
    if(!a||!b)return 0;
    const R=6371000,rad=x=>Number(x)*Math.PI/180;
    const dLat=rad(b[0]-a[0]),dLng=rad(b[1]-a[1]),la1=rad(a[0]),la2=rad(b[0]);
    const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  }
  function fmtKm(m){return Number.isFinite(m)&&m>0?Math.round(m/1000).toLocaleString('nl-NL')+' km':'— km';}
  function fmtTime(sec){
    if(!Number.isFinite(sec)||sec<=0)return '—';
    const min=Math.max(1,Math.round(sec/60));
    return Math.floor(min/60)+'u '+String(min%60).padStart(2,'0')+'m';
  }
  function segments(data){
    const stops=(data.stops||[]).filter(isPoint);
    const pts=[ORIGIN_LL,...stops.map(s=>[Number(s.ll[0]),Number(s.ll[1])]),DEST_LL];
    const legs=[];
    for(let i=0;i<pts.length-1;i++) legs.push(Math.max(1,hav(pts[i],pts[i+1])));
    const totalStraight=legs.reduce((a,b)=>a+b,0)||1;
    const s=summary();
    const totalMeters=Number(s.distanceMeters)||legs.reduce((a,b)=>a+b,0)*1.18;
    const totalSeconds=Number(s.durationSeconds)||totalMeters/24;
    return legs.map(m=>({km:fmtKm(totalMeters*(m/totalStraight)),time:fmtTime(totalSeconds*(m/totalStraight))}));
  }
  function icon(type){
    const t=String(type||'').toLowerCase();
    if(t==='hotel')return '🏨'; if(t==='fuel')return '⛽'; if(t==='ev')return '⚡'; if(t==='food')return '🍽️'; if(t==='wc')return '🚻'; if(t==='view')return '⛰️'; return '📍';
  }
  function mapsUrl(){
    const d=read();
    const p=new URLSearchParams({api:'1',destination:d.destination||DEST,travelmode:'driving'});
    const waypoints=d.stops.filter(isPoint).map(s=>`${Number(s.ll[0]).toFixed(6)},${Number(s.ll[1]).toFixed(6)}`).slice(0,9);
    if(waypoints.length)p.set('waypoints',waypoints.join('|'));
    return `https://www.google.com/maps/dir/?${p.toString()}`;
  }
  function panel(){
    let el=qs('#roadtripMiniPanelV584');
    if(!el){el=document.createElement('section');el.id='roadtripMiniPanelV584';el.className='roadtripMiniPanelV584';(qs('#mapScreen .roadMapApp')||document.body).appendChild(el);}
    return el;
  }
  function updateBadge(){
    const count=read().stops.length;
    qsa('#mapScreen .bottomNav .navItem[data-nav="roadtrip"]').forEach(b=>{b.dataset.roadtripCount=String(count);b.classList.toggle('roadtripHasStops',count>0);});
  }
  function closeOther(){
    qs('#hotelDetailSheet')?.classList.remove('open','expanded');
    qs('#hotelCompareSheet')?.classList.remove('open');
    qs('#roadoraStopOverlayV57')?.classList.remove('open');
    qs('#mapScreen')?.classList.remove('stopOverlayOpenV57');
  }
  function render(){
    closeOther();
    const d=read();
    const seg=segments(d);
    const total=summary();
    const totalLine=[d.stops.length?`${d.stops.length} stop${d.stops.length===1?'':'s'}`:'0 stops',total.distanceLabel,total.timeLabel].filter(Boolean).join(' · ');
    const rows=[];
    rows.push(`<div class="roadtripV705Endpoint"><i>Start</i><b>${esc(d.origin)}</b></div>`);
    d.stops.forEach((s,i)=>{
      rows.push(`<div class="roadtripV705Segment"><span>${i===0?'Vanaf start':'Volgend traject'}</span><b>${esc(seg[i]?.km)} · ${esc(seg[i]?.time)}</b></div>`);
      rows.push(`<div class="roadtripV705Stop" data-trip-id="${esc(s.id||'')}"><div class="roadtripV705Index">${i+1}</div><div class="roadtripV705Icon">${icon(s.type)}</div><button type="button" class="roadtripV705Main" data-roadtrip705="focus" data-trip-id="${esc(s.id||'')}"><b>${esc(s.name||'Tussenstop')}</b><small>${esc([s.label||s.type||'Stop',s.meta||''].filter(Boolean).join(' · '))}</small></button><button type="button" class="roadtripV705Remove" data-roadtrip705="remove" data-trip-id="${esc(s.id||'')}">×</button></div>`);
    });
    rows.push(`<div class="roadtripV705Segment"><span>Naar eindbestemming</span><b>${esc(seg[d.stops.length]?.km)} · ${esc(seg[d.stops.length]?.time)}</b></div>`);
    rows.push(`<div class="roadtripV705Endpoint"><i>Eind</i><b>${esc(d.destination)}</b></div>`);
    const empty=`<div class="roadtripV705Empty"><b>Nog geen tussenstops</b><span>Kies een hotel, tankstation, laadpunt of uitje en voeg hem toe aan je roadtrip.</span></div>`;
    const el=panel();
    el.innerHTML=`<div class="roadtripPanelScrimV584" data-roadtrip705="close"></div><article class="roadtripPanelCardV584 roadtripV705Card" role="dialog" aria-label="Mijn Roadtrip"><header class="roadtripV705Head"><div><span>Mijn Roadtrip</span><b>${esc(totalLine||'Bouw je route met tussenstops')}</b></div><button type="button" data-roadtrip705="close">×</button></header><div class="roadtripV705List">${d.stops.length?rows.join(''):empty}</div><footer class="roadtripV705Footer"><button type="button" data-roadtrip705="clear" ${d.stops.length?'':'disabled'}>Leegmaken</button><button type="button" data-roadtrip705="maps">Start in Google Maps</button></footer></article>`;
    qs('#mapScreen')?.classList.add('roadtripPanelOpenV621','roadtripPanelOpenV63','roadtripPanelOpenV705');
    el.classList.add('open','roadtripV63Open','roadtripV705Open');
    updateBadge();
  }
  function close(){panel().classList.remove('open','roadtripV63Open','roadtripV705Open');qs('#mapScreen')?.classList.remove('roadtripPanelOpenV621','roadtripPanelOpenV63','roadtripPanelOpenV705');}
  function remove(id){
    const d=read(); d.stops=d.stops.filter(s=>String(s.id)!==String(id)); write(d); render();
    setTimeout(()=>{try{window.RoadoraMapApi?.reloadRoute?.();}catch(_){} try{window.RoadoraTripMap?.render?.();}catch(_){}},80);
  }
  function clear(){const d=read(); d.stops=[]; write(d); render(); setTimeout(()=>{try{window.RoadoraMapApi?.reloadRoute?.();}catch(_){} try{window.RoadoraTripMap?.render?.();}catch(_){}},80);}
  function focus(id){const s=read().stops.find(x=>String(x.id)===String(id)); close(); if(s){try{window.RoadoraMapApi?.showPanel?.(s);setTimeout(()=>window.RoadoraMapApi?.focusSelected?.(),80);}catch(_){}}}
  function openMaps(){window.open(mapsUrl(),'_blank','noopener');}

  // Window capture loopt vóór oudere document-handlers en voorkomt dat oude panelen zonder km/tijd openen.
  window.addEventListener('click',function(e){
    const t=e.target; if(!t?.closest)return;
    const nav=t.closest('#mapScreen .bottomNav .navItem[data-nav="roadtrip"]');
    const action=t.closest('[data-roadtrip705]');
    if(nav){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();render();return false;}
    if(action){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();const a=action.dataset.roadtrip705;if(a==='close')return close();if(a==='remove')return remove(action.dataset.tripId);if(a==='clear')return clear();if(a==='focus')return focus(action.dataset.tripId);if(a==='maps')return openMaps();}
  },true);
  window.addEventListener('roadora:roadtrip:update',updateBadge);
  window.addEventListener('storage',e=>{if(!e.key||e.key===KEY)updateBadge();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',updateBadge,{once:true});else updateBadge();
  window.RoadoraRoadtripPanel={open:render,render,close};
})();


/* Roadora v7.0.7 — Fase 1.8 Cleanup + Performance Guard
   - Geen nieuwe features; alleen core-stabiliteit
   - Route-tab bewaart roadtrip-stops, sluit alleen tijdelijke detail/categorie lagen
   - Oude zwevende roadtrip-dock/panel classes worden opgeschoond
   - Roadtrip storage wordt licht genormaliseerd tegen dubbele items
   - Maps-export blijft onaangeraakt/locked
*/
(function(){
  'use strict';
  const KEY='roadoraRoadtripV1';
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  let routeCleanTimer=null;
  let normalizeTimer=null;

  function readTrip(){
    try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){return {};}
  }
  function stopId(s){
    return String(s?.id || s?.googlePlaceId || [s?.type||'stop',s?.name||'',Array.isArray(s?.ll)?s.ll.join(','):''].join(':'));
  }
  function normalizeRoadtrip(){
    const data=readTrip();
    const input=Array.isArray(data.stops)?data.stops.filter(Boolean):[];
    const seen=new Set();
    const stops=[];
    input.forEach(s=>{
      const id=stopId(s);
      if(!id || seen.has(id)) return;
      seen.add(id);
      stops.push({...s,id});
    });
    const clean={...data,version:data.version||1,origin:data.origin||'Rotterdam, Nederland',destination:data.destination||'Innsbruck, Oostenrijk',stops:stops.slice(0,9),updatedAt:data.updatedAt||new Date().toISOString()};
    if(JSON.stringify(clean)!==JSON.stringify(data)){
      localStorage.setItem(KEY,JSON.stringify(clean));
      window.dispatchEvent(new CustomEvent('roadora:roadtrip:update',{detail:clean}));
    }
  }
  function scheduleNormalize(){
    clearTimeout(normalizeTimer);
    normalizeTimer=setTimeout(normalizeRoadtrip,90);
  }
  function closeLegacyRoadtripLayers(){
    const dock=qs('#roadtripMiniDockV584');
    if(dock){dock.hidden=true;dock.style.display='none';}
    qsa('#roadtripMiniPanelV584').forEach(panel=>{
      if(!panel.classList.contains('roadtripV705Open')) panel.classList.remove('open','roadtripV63Open');
    });
    qs('#mapScreen')?.classList.remove('roadtripPanelOpenV63','roadtripPanelOpenV621');
  }
  function closeTransientLayers(){
    qs('#hotelDetailSheet')?.classList.remove('open','expanded');
    qs('#hotelCompareSheet')?.classList.remove('open');
    qs('#roadoraStopOverlayV57')?.classList.remove('open');
    qs('#mapScreen')?.classList.remove('stopOverlayOpenV57','fromHotelsMap');
  }
  function enforceRouteMode(){
    closeTransientLayers();
    closeLegacyRoadtripLayers();
    try{window.RoadoraRoadtripPanel?.close?.();}catch(_){}
    try{window.RoadoraMapApi?.setFilters?.([]);}catch(_){}
    try{window.RoadoraMapApi?.closeCategories?.();}catch(_){}
    try{window.RoadoraMapApi?.clearSelection?.();}catch(_){}
    try{window.RoadoraTripMap?.render?.();}catch(_){}
    try{window.RoadoraMapApi?.fitRoute?.('route-clean');}catch(_){}
    qsa('#mapScreen .bottomNav .navItem').forEach(btn=>{
      const active=btn.dataset.nav==='route';
      btn.classList.toggle('active',active);
      btn.classList.toggle('is-active',active);
    });
  }
  function scheduleRouteMode(){
    clearTimeout(routeCleanTimer);
    routeCleanTimer=setTimeout(enforceRouteMode,80);
  }

  document.addEventListener('click',function(e){
    const t=e.target;
    if(!t?.closest) return;
    const nav=t.closest('#mapScreen .bottomNav .navItem[data-nav]');
    if(nav?.dataset.nav==='route') scheduleRouteMode();
    if(nav?.dataset.nav==='stops'){
      setTimeout(()=>{try{window.RoadoraRoadtripPanel?.close?.();}catch(_){} closeLegacyRoadtripLayers();},60);
    }
  },true);

  window.addEventListener('roadora:roadtrip:update',scheduleNormalize);
  window.addEventListener('storage',e=>{if(!e.key||e.key===KEY) scheduleNormalize();});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{normalizeRoadtrip();closeLegacyRoadtripLayers();},{once:true});
  else {normalizeRoadtrip();closeLegacyRoadtripLayers();}

  window.RoadoraCleanupGuard={normalizeRoadtrip,enforceRouteMode};
})();


/* Roadora v7.0.9 — Topbar Info Restore + Clean Route Card
   - Topbar toont weer nuttige ritinformatie: tijd, km, stops en route-status
   - Geen placeholders meer zoals "Aankomst —" of "Maps-ready" als ORS-data beschikbaar is
   - Bottom route-card blijft route-context/CTA en gebruikt dezelfde centrale route summary
   - Maps export blijft locked/onaangeraakt
*/
(function(){
  'use strict';
  const TRIP_KEY='roadoraRoadtripV1';
  const SUMMARY_KEY='roadoraRouteSummaryV1';
  const qs=(s,r=document)=>r.querySelector(s);
  let guard=false;
  let timer=null;

  function readJson(key,fallback={}){try{return JSON.parse(localStorage.getItem(key)||'{}')||fallback;}catch(_){return fallback;}}
  function readTrip(){const d=readJson(TRIP_KEY,{});return {stops:Array.isArray(d.stops)?d.stops.filter(Boolean):[]};}
  function readSummary(){return readJson(SUMMARY_KEY,{});}
  function text(sel,fallback=''){return (qs(sel)?.textContent||fallback).trim();}
  function isValidTime(v){return /^\d+u\s*\d{0,2}m?$/i.test(String(v||'').trim()) || /^\d+u$/i.test(String(v||'').trim());}
  function isValidKm(v){return /\d/.test(String(v||'')) && /km/i.test(String(v||''));}
  function vehicleLabel(){return qs('#mapScreen .vehicle.active span:last-child')?.textContent?.trim() || qs('#routeSetupScreen .rVehicle.active')?.textContent?.replace(/[🚘⚡🚐🏍️]/g,'').trim() || 'Auto';}
  function stopCount(){return readTrip().stops.length;}
  function fallbackMetaParts(){
    const meta=text('#stopMeta','');
    return String(meta).split('·').map(x=>x.trim()).filter(Boolean);
  }
  function routeKm(){
    const sum=readSummary();
    if(isValidKm(sum.distanceLabel)) return sum.distanceLabel;
    const chip=text('#mapStatusDistance','');
    if(isValidKm(chip)) return chip;
    const stat=text('.routePanel .stat:nth-child(2) b','');
    if(isValidKm(stat)) return stat;
    const fromMeta=fallbackMetaParts().find(isValidKm);
    return fromMeta || '— km';
  }
  function routeTime(){
    const sum=readSummary();
    if(isValidTime(sum.timeLabel)) return sum.timeLabel;
    const chip=text('#mapStatusEta','');
    if(isValidTime(chip)) return chip;
    const fromMeta=fallbackMetaParts().find(isValidTime);
    return fromMeta || 'route laden';
  }
  function stopLabel(){const n=stopCount();return `${n} stop${n===1?'':'s'}`;}
  function hasRouteNumbers(){return isValidKm(routeKm()) && isValidTime(routeTime());}
  function routeMeta(){
    const parts=[];
    const km=routeKm(), time=routeTime();
    if(isValidKm(km)) parts.push(km);
    if(isValidTime(time)) parts.push(time);
    if(stopCount()) parts.push(stopLabel());
    return parts.join(' · ') || 'Route wordt geladen';
  }
  function isRouteLikeSheet(){
    const sheet=qs('#mapScreen .sheet');
    const type=sheet?.dataset?.type || '';
    const title=text('#stopTitle','');
    return !type || ['destination','overview','route'].includes(type) || /Innsbruck|Rotterdam/.test(title);
  }
  function setTopbarGlobal(){
    if(guard) return;
    guard=true;
    try{
      const title=qs('#mapStatusTitle');
      const badge=qs('#mapStatusBadge');
      const sub=qs('#mapStatusSub');
      const eta=qs('#mapStatusEta');
      const dist=qs('#mapStatusDistance');
      const next=qs('#mapStatusNext');
      const cockpit=qs('#mapScreen .mapCockpit');
      const km=routeKm();
      const time=routeTime();
      if(cockpit) cockpit.setAttribute('data-copilot-state','route');
      if(title) title.textContent='Rotterdam → Innsbruck';
      if(badge) badge.textContent='🟢 Route actief';
      if(sub) sub.textContent=hasRouteNumbers() ? `${vehicleLabel()} route · ${time} · ${km}` : `${vehicleLabel()} route · route laden`;
      if(eta) eta.textContent=isValidTime(time) ? time : 'route laden';
      if(dist) dist.textContent=isValidKm(km) ? km : '— km';
      if(next) next.textContent=stopCount() ? stopLabel() : 'Geen stops';
    }finally{guard=false;}
  }
  function setRouteSheetSummary(){
    const sheet=qs('#mapScreen .sheet');
    if(!sheet || !isRouteLikeSheet()) return;
    sheet.dataset.type='route';
    const over=qs('#mapScreen .overline');
    const title=qs('#stopTitle');
    const meta=qs('#stopMeta');
    const desc=qs('#stopDesc');
    const primary=qs('#mapScreen .sheetActions .primary');
    const secondary=qs('#mapScreen .sheetActions .secondary');
    const save=qs('#mapScreen .sheetActions .saveStop');
    if(over) over.textContent='Route-overzicht';
    if(title) title.textContent='Rotterdam → Innsbruck';
    if(meta) meta.textContent=routeMeta();
    if(desc) desc.textContent='Je actieve Roadora-route is geladen. De kaart toont de volledige route met je gekozen tussenstops.';
    if(primary) primary.textContent='➤ Navigeer volledige route';
    if(secondary){ secondary.textContent='ⓘ Route info'; secondary.hidden=false; secondary.classList.remove('is-hidden'); }
    if(save){ save.hidden=true; save.disabled=true; save.classList.add('is-disabled'); }
  }
  function refreshHierarchy(){setTopbarGlobal();setRouteSheetSummary();}
  function schedule(){clearTimeout(timer);timer=setTimeout(refreshHierarchy,80);}

  document.addEventListener('click',function(e){
    const t=e.target;
    if(!t?.closest) return;
    const nav=t.closest('#mapScreen .bottomNav .navItem[data-nav]');
    if(nav?.dataset.nav==='route') setTimeout(refreshHierarchy,160);
    if(nav?.dataset.nav==='roadtrip') setTimeout(setTopbarGlobal,160);
    if(nav?.dataset.nav==='stops') setTimeout(setTopbarGlobal,160);
  },true);
  ['roadora:roadtrip:update','roadora:route:update'].forEach(ev=>window.addEventListener(ev,schedule));
  window.addEventListener('storage',e=>{if(!e.key||e.key===TRIP_KEY||e.key===SUMMARY_KEY)schedule();});
  const obs=new MutationObserver(()=>schedule());
  function boot(){
    const ui=qs('#mapScreen .ui');
    if(ui) obs.observe(ui,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-type','class']});
    refreshHierarchy();
    setTimeout(refreshHierarchy,450);
    setTimeout(refreshHierarchy,1200);
    setTimeout(refreshHierarchy,2200);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.RoadoraInfoHierarchy={refresh:refreshHierarchy,routeSheet:setRouteSheetSummary,topbar:setTopbarGlobal};
})();

/* Roadora v7.1.0 — Info Dedup + Stop Count Sync
   - Topbar: één compacte route-regel met tijd/km
   - Topbar chips: alleen aantal gekozen tussenstops zichtbaar
   - Stats-rij: stops telt mee met echte roadtrip-state, geen 6–8 placeholder
   - Bottom route-card: routecontext/CTA zonder opnieuw dezelfde km/tijd te herhalen
   - Maps export/ORS blijven onaangeraakt
*/
(function(){
  'use strict';
  const TRIP_KEY='roadoraRoadtripV1';
  const SUMMARY_KEY='roadoraRouteSummaryV1';
  const qs=(s,r=document)=>r.querySelector(s);
  let timer=null;
  let busy=false;

  function readJson(key,fallback={}){
    try{return JSON.parse(localStorage.getItem(key)||'{}')||fallback;}catch(_){return fallback;}
  }
  function tripStops(){
    const d=readJson(TRIP_KEY,{});
    return Array.isArray(d.stops)?d.stops.filter(Boolean):[];
  }
  function stopCount(){return tripStops().length;}
  function stopLabel(){const n=stopCount();return `${n} stop${n===1?'':'s'}`;}
  function text(sel,fallback=''){return (qs(sel)?.textContent||fallback).trim();}
  function validKm(v){return /\d/.test(String(v||'')) && /km/i.test(String(v||''));}
  function validTime(v){return /^\d+u(\s*\d{1,2}m)?$/i.test(String(v||'').trim()) || /^\d+u\s*\d{1,2}$/i.test(String(v||'').trim());}
  function summary(){return readJson(SUMMARY_KEY,{});}
  function routeKm(){
    const s=summary();
    if(validKm(s.distanceLabel)) return s.distanceLabel;
    const stat=text('.routePanel .stat:nth-child(2) b','');
    if(validKm(stat)) return stat;
    const meta=text('#stopMeta','').split('·').map(x=>x.trim()).find(validKm);
    return meta || '— km';
  }
  function routeTime(){
    const s=summary();
    if(validTime(s.timeLabel)) return s.timeLabel;
    const sub=text('#mapStatusSub','').split('·').map(x=>x.trim()).find(validTime);
    if(validTime(sub)) return sub;
    const meta=text('#stopMeta','').split('·').map(x=>x.trim()).find(validTime);
    return meta || 'route laden';
  }
  function vehicle(){
    return qs('#mapScreen .vehicle.active span:last-child')?.textContent?.trim()
      || qs('#routeSetupScreen .rVehicle.active')?.textContent?.replace(/[🚘⚡🚐🏍️]/g,'').trim()
      || 'Auto';
  }
  function isRouteSheet(){
    const sheet=qs('#mapScreen .sheet');
    const type=sheet?.dataset?.type || '';
    const title=text('#stopTitle','');
    return !type || ['destination','overview','route'].includes(type) || /Rotterdam|Innsbruck/i.test(title);
  }
  function syncStats(){
    const kmEl=qs('.routePanel .stat:nth-child(2) b');
    const stopsEl=qs('.routePanel .stat:nth-child(3) b');
    const stopsSmall=qs('.routePanel .stat:nth-child(3) small');
    const km=routeKm();
    if(kmEl && validKm(km)) kmEl.textContent=km;
    if(stopsEl) stopsEl.textContent=String(stopCount());
    if(stopsSmall) stopsSmall.textContent=stopCount()===1?'Stop':'Stops';
  }
  function syncTopbar(){
    const title=qs('#mapStatusTitle');
    const badge=qs('#mapStatusBadge');
    const sub=qs('#mapStatusSub');
    const eta=qs('#mapStatusEta');
    const dist=qs('#mapStatusDistance');
    const next=qs('#mapStatusNext');
    const cockpit=qs('#mapScreen .mapCockpit');
    const km=routeKm();
    const time=routeTime();
    if(cockpit) cockpit.setAttribute('data-copilot-state','route');
    if(title) title.textContent='Rotterdam → Innsbruck';
    if(badge) badge.textContent='🟢 Route actief';
    if(sub) sub.textContent=`${vehicle()} route · ${validTime(time)?time:'route laden'}${validKm(km)?' · '+km:''}`;

    // Dedup: chips tonen niet opnieuw tijd én km. Alleen aantal gekozen tussenstops blijft zichtbaar.
    if(eta){eta.textContent=stopLabel(); eta.style.display='inline-flex';}
    if(dist){dist.textContent=''; dist.style.display='none';}
    if(next){next.textContent=''; next.style.display='none';}
  }
  function syncRouteCard(){
    const sheet=qs('#mapScreen .sheet');
    if(!sheet || !isRouteSheet()) return;
    sheet.dataset.type='route';
    const over=qs('#mapScreen .overline');
    const title=qs('#stopTitle');
    const meta=qs('#stopMeta');
    const desc=qs('#stopDesc');
    const primary=qs('#mapScreen .sheetActions .primary');
    const secondary=qs('#mapScreen .sheetActions .secondary');
    const save=qs('#mapScreen .sheetActions .saveStop');
    if(over) over.textContent='Route-overzicht';
    if(title) title.textContent='Rotterdam → Innsbruck';
    if(meta) meta.textContent=`Route actief · ${stopLabel()}`;
    if(desc) desc.textContent='De kaart toont je actieve roadtrip-route met je gekozen tussenstops. Gebruik Stops om nieuwe plekken langs de route te ontdekken.';
    if(primary) primary.textContent='➤ Navigeer volledige route';
    if(secondary){secondary.textContent='ⓘ Route info';secondary.hidden=false;secondary.classList.remove('is-hidden');}
    if(save){save.hidden=true;save.disabled=true;save.classList.add('is-disabled');}
  }
  function refresh(){
    if(busy) return;
    busy=true;
    try{syncStats();syncTopbar();syncRouteCard();}
    finally{busy=false;}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(refresh,70);}

  document.addEventListener('click',function(e){
    const nav=e.target?.closest?.('#mapScreen .bottomNav .navItem[data-nav]');
    if(nav) setTimeout(refresh,120);
  },true);
  ['roadora:roadtrip:update','roadora:route:update','DOMContentLoaded'].forEach(ev=>window.addEventListener(ev,schedule));
  window.addEventListener('storage',e=>{if(!e.key || e.key===TRIP_KEY || e.key===SUMMARY_KEY) schedule();});

  const obs=new MutationObserver(schedule);
  function boot(){
    const ui=qs('#mapScreen .ui');
    if(ui) obs.observe(ui,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-type','class','style']});
    refresh();
    setTimeout(refresh,250);
    setTimeout(refresh,900);
    setTimeout(refresh,1800);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.RoadoraInfoDedup={refresh};
})();


/* Roadora v7.2.4 — Phase 2.4 Core Facade
   Niet-destructieve architectuurlaag. Deze facade verandert geen bestaand gedrag,
   maar geeft latere modules één veilige ingang naar Route, Map, Roadtrip, Stops, UI en Maps Export.
*/
(function(){
  'use strict';
  if(window.RoadoraCore?.version) return;

  function safeCall(fn, fallback){
    try{ return typeof fn === 'function' ? fn() : fallback; }catch(_){ return fallback; }
  }

  window.RoadoraCore={
    version:'7.3.0',
    phase:'2.4-data-state-cleanup',
    locked:{ mapsExport:true },
    state:{
      get roadtrip(){ return safeCall(()=>window.RoadoraRoadtrip?.read?.(), null); },
      get selectedStop(){ return safeCall(()=>window.RoadoraMapApi?.getSelectedStop?.(), window.RoadoraState?.selectedStop || null); },
      refreshRoadtrip(){
        window.dispatchEvent(new CustomEvent('roadora:roadtrip:update'));
        window.dispatchEvent(new CustomEvent('roadora:route:update'));
      }
    },
    route:{
      reload(){ return window.RoadoraMapApi?.reloadRoute?.(); },
      fit(reason='core-fit'){ return window.RoadoraMapApi?.fitRoute?.(reason); },
      clearSelection(){ return window.RoadoraMapApi?.clearSelection?.(); }
    },
    map:{
      setFilters(filters){ return window.RoadoraMapApi?.setFilters?.(filters); },
      closeCategories(){ return window.RoadoraMapApi?.closeCategories?.(); },
      focusSelected(){ return window.RoadoraMapApi?.focusSelected?.(); }
    },
    mapsExport:{
      open(mode='nav'){ return window.RoadoraMapsExport?.open?.(mode); },
      url(){ return window.RoadoraMapsExport?.url?.(); }
    },
    ui:{
      refreshInfo(){ return window.RoadoraInfoDedup?.refresh?.(); },
      toast(message){ return window.RoadoraToast?.(message); }
    }
  };
})();


/* Roadora v7.3.1 — Places Only Hotels
   Niet-destructieve datalaag. Doel: één vaste plek voor route-summary,
   roadtrip-state, category-state en toekomstige Google Places-resultaten.
   Let op: deze laag verandert bewust geen bestaande UX of Maps-flow.
*/
(function(){
  'use strict';
  if(window.RoadoraDataLayer?.version) return;

  const KEYS={
    roadtrip:'roadoraRoadtripV1',
    routeSummary:'roadoraRouteSummaryV1',
    categoryState:'roadoraCategoryStateV1',
    placesCache:'roadoraPlacesCacheV1'
  };

  function safeJsonRead(key, fallback){
    try{return JSON.parse(localStorage.getItem(key)||'null') ?? fallback;}
    catch(_){return fallback;}
  }
  function safeJsonWrite(key, value){
    try{localStorage.setItem(key, JSON.stringify(value));return true;}
    catch(_){return false;}
  }
  function nowIso(){return new Date().toISOString();}
  function normalizeStop(stop, source='unknown'){
    const ll=Array.isArray(stop?.ll)?[Number(stop.ll[0]),Number(stop.ll[1])]:null;
    return {
      id: stop?.id || stop?.googlePlaceId || `${stop?.type||'stop'}:${stop?.name||''}:${ll?ll.join(','):''}`,
      name: stop?.name || 'Roadora stop',
      type: stop?.type || 'stop',
      label: stop?.label || 'Tussenstop',
      meta: stop?.meta || '',
      ll: ll && Number.isFinite(ll[0]) && Number.isFinite(ll[1]) ? ll : null,
      source,
      provider: stop?.provider || null,
      googlePlaceId: stop?.googlePlaceId || null,
      googleMapsUri: stop?.googleMapsUri || null,
      raw: stop || null
    };
  }
  function readRoadtrip(){
    const data=safeJsonRead(KEYS.roadtrip,{version:1,origin:'Rotterdam, Nederland',destination:'Innsbruck, Oostenrijk',stops:[]});
    return {
      version:data.version||1,
      origin:data.origin||'Rotterdam, Nederland',
      destination:data.destination||'Innsbruck, Oostenrijk',
      stops:Array.isArray(data.stops)?data.stops.map(s=>normalizeStop(s,s.source||'roadtrip')).filter(s=>s.ll):[],
      updatedAt:data.updatedAt||null
    };
  }
  function readRouteSummary(){
    return safeJsonRead(KEYS.routeSummary,{distanceLabel:null,timeLabel:null,stopCount:readRoadtrip().stops.length,updatedAt:null});
  }
  function writeRouteSummary(summary){
    const clean={
      distanceLabel:summary?.distanceLabel||summary?.km||null,
      timeLabel:summary?.timeLabel||summary?.time||null,
      stopCount:Number.isFinite(Number(summary?.stopCount))?Number(summary.stopCount):readRoadtrip().stops.length,
      updatedAt:nowIso()
    };
    safeJsonWrite(KEYS.routeSummary,clean);
    window.dispatchEvent(new CustomEvent('roadora:route:update',{detail:clean}));
    return clean;
  }
  function readCategoryState(){
    const data=safeJsonRead(KEYS.categoryState,{active:[],mode:'clean-route'});
    return {active:Array.isArray(data.active)?data.active:[],mode:data.mode||'clean-route',updatedAt:data.updatedAt||null};
  }
  function writeCategoryState(next){
    const clean={active:Array.isArray(next?.active)?Array.from(new Set(next.active)):[],mode:next?.mode||'stops',updatedAt:nowIso()};
    safeJsonWrite(KEYS.categoryState,clean);
    window.dispatchEvent(new CustomEvent('roadora:categories:update',{detail:clean}));
    return clean;
  }
  function classifyStopSource(stop){
    if(stop?.googlePlaceId || stop?.provider==='Google Places') return 'google-places';
    if(stop?.source) return stop.source;
    if(stop?.type && ['fuel','hotel','ev','food','view','wc'].includes(stop.type)) return 'fallback-or-category';
    return 'unknown';
  }

  window.RoadoraDataLayer={
    version:'7.3.0',
    keys:KEYS,
    normalizeStop,
    classifyStopSource,
    roadtrip:{read:readRoadtrip},
    routeSummary:{read:readRouteSummary,write:writeRouteSummary},
    categories:{read:readCategoryState,write:writeCategoryState},
    places:{
      readCache(){return safeJsonRead(KEYS.placesCache,{version:1,items:[],updatedAt:null});},
      writeCache(items=[]){const clean={version:1,items:Array.isArray(items)?items:[],updatedAt:nowIso()};safeJsonWrite(KEYS.placesCache,clean);return clean;}
    }
  };

  // Koppel de datalaag veilig aan de bestaande Core facade zonder gedrag te wijzigen.
  if(window.RoadoraCore){
    window.RoadoraCore.data=window.RoadoraDataLayer;
  }
})();

/* Roadora v7.4.8 — Mijn Roadtrip V2 Page Hard Fix
   - Oude Roadtrip-popup wordt niet meer via de bottom-nav aangeroepen
   - Mijn Roadtrip opent als echte aparte subpage
   - Document-level legacy handlers worden omzeild door de nav-item te isoleren
   - Maps/ORS blijven untouched
*/
(function(){
  'use strict';
  const TRIP_KEY='roadoraRoadtripV1';
  const SUMMARY_KEY='roadoraRouteSummaryV1';
  const ORIGIN='Rotterdam, Nederland';
  const DEST='Innsbruck, Oostenrijk';
  const ORIGIN_LL=[51.9244,4.4777];
  const DEST_LL=[47.2692,11.4041];
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const toast=msg=>window.RoadoraToast?window.RoadoraToast(msg):console.log(msg);

  function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'')||fallback;}catch(_){return fallback;}}
  function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value));}
  function readTrip(){
    const data=readJson(TRIP_KEY,{version:1,origin:ORIGIN,destination:DEST,stops:[]});
    return {
      version:data.version||1,
      origin:data.origin||ORIGIN,
      destination:data.destination||DEST,
      stops:Array.isArray(data.stops)?data.stops.filter(Boolean):[],
      updatedAt:data.updatedAt||null
    };
  }
  function writeTrip(data){
    const clean={...data,origin:data.origin||ORIGIN,destination:data.destination||DEST,stops:Array.isArray(data.stops)?data.stops:[],updatedAt:new Date().toISOString()};
    writeJson(TRIP_KEY,clean);
    window.dispatchEvent(new CustomEvent('roadora:roadtrip:update',{detail:clean}));
    return clean;
  }
  function readSummary(){return readJson(SUMMARY_KEY,{distanceLabel:'1.005 km',timeLabel:'9u 03m',stopCount:readTrip().stops.length});}
  function ll(stop,fallback){
    if(Array.isArray(stop?.ll)&&stop.ll.length>=2) return [Number(stop.ll[0]),Number(stop.ll[1])];
    if(Array.isArray(stop?.location)&&stop.location.length>=2) return [Number(stop.location[0]),Number(stop.location[1])];
    if(stop?.lat&&stop?.lng) return [Number(stop.lat),Number(stop.lng)];
    return fallback;
  }
  function kmBetween(a,b){
    const R=6371, toRad=d=>d*Math.PI/180;
    const dLat=toRad(b[0]-a[0]), dLng=toRad(b[1]-a[1]);
    const s=Math.sin(dLat/2)**2+Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLng/2)**2;
    return 2*R*Math.atan2(Math.sqrt(s),Math.sqrt(1-s));
  }
  function timeFromKm(km){
    const min=Math.max(8,Math.round((km/92)*60));
    const h=Math.floor(min/60), m=min%60;
    return h?`${h}u ${String(m).padStart(2,'0')}m`:`${m} min`;
  }
  function typeLabel(stop){
    const t=String(stop?.type||'').toLowerCase();
    if(t==='hotel') return 'Overnachting';
    if(t==='fuel') return 'Tankstop';
    if(t==='ev') return 'Laadpunt';
    if(t==='food') return 'Eten & drinken';
    if(t==='view'||t==='poi') return 'Uitje';
    return stop?.label||'Tussenstop';
  }
  function stopIcon(stop){
    const t=String(stop?.type||'').toLowerCase();
    if(t==='hotel') return '🏨';
    if(t==='fuel') return '⛽';
    if(t==='ev') return '⚡';
    if(t==='food') return '🍽️';
    if(t==='view'||t==='poi') return '🏞️';
    return '📍';
  }

  function killLegacyRoadtrip(){
    $('#roadtripMiniPanelV584')?.classList.remove('open','roadtripV63Open','roadtripV684Open');
    $('#roadtripMiniDockV584')?.setAttribute('hidden','hidden');
    $('#mapScreen')?.classList.remove('roadtripPanelOpenV621','roadtripPanelOpenV63','roadtripPanelOpenV684');
  }

  function isolateBottomRoadtripButton(){
    $$('#mapScreen .bottomNav .navItem[data-nav="roadtrip"], #mapScreen .bottomNav .navItem[data-roadtrip-page="true"]').forEach(oldBtn=>{
      let btn=oldBtn;
      if(!oldBtn.dataset.roadtripPageBound){
        const clone=oldBtn.cloneNode(true);
        oldBtn.replaceWith(clone);
        btn=clone;
      }
      btn.dataset.nav='roadtripPage';
      btn.dataset.roadtripPage='true';
      btn.dataset.roadtripPageBound='true';
      btn.setAttribute('type','button');
      btn.addEventListener('click',function(e){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        openPage();
        return false;
      },true);
    });
    updateBadge();
  }

  function ensurePage(){
    let page=$('#roadtripScreenV2Page');
    if(page) return page;
    page=document.createElement('section');
    page.id='roadtripScreenV2Page';
    page.className='roadtripScreenV2Page';
    page.setAttribute('aria-label','Mijn Roadtrip');
    page.innerHTML=`<div class="roadtripV2PageInner"></div>`;
    ($('.phone')||document.body).appendChild(page);
    return page;
  }

  function render(){
    const page=ensurePage();
    const inner=$('.roadtripV2PageInner',page);
    const trip=readTrip();
    const summary=readSummary();
    const stops=trip.stops;
    const totalStops=stops.length;
    let prev=ORIGIN_LL;
    const timeline=[];
    timeline.push(`<div class="rtv2Point start"><i>A</i><div><span>Startpunt</span><b>${esc(trip.origin)}</b></div></div>`);
    stops.forEach((s,i)=>{
      const p=ll(s,prev);
      const km=Math.round(kmBetween(prev,p)*1.18);
      timeline.push(`<div class="rtv2Segment"><span></span><b>${km.toLocaleString('nl-NL')} km</b><em>${timeFromKm(km)}</em></div>`);
      timeline.push(`<div class="rtv2Stop" data-trip-id="${esc(s.id||i)}"><i>${i+1}</i><strong>${stopIcon(s)}</strong><button type="button" data-rtv2-action="focus" data-trip-id="${esc(s.id||i)}"><span>${esc(typeLabel(s))}</span><b>${esc(s.name||'Tussenstop')}</b><small>${esc(String(s.address||s.meta||'Langs route').split(' · ')[0])}</small></button><button type="button" class="rtv2Remove" data-rtv2-action="remove" data-trip-id="${esc(s.id||i)}" aria-label="Stop verwijderen">×</button></div>`);
      prev=p;
    });
    const lastKm=Math.round(kmBetween(prev,DEST_LL)*1.18);
    if(stops.length){ timeline.push(`<div class="rtv2Segment"><span></span><b>${lastKm.toLocaleString('nl-NL')} km</b><em>${timeFromKm(lastKm)}</em></div>`); }
    timeline.push(`<div class="rtv2Point end"><i>B</i><div><span>Eindbestemming</span><b>${esc(trip.destination)}</b></div></div>`);
    const empty=!stops.length?`<div class="rtv2Tip"><b>Tip</b><span>Kies een hotel, tankstation of andere plek op de kaart en voeg die toe aan je roadtrip.</span></div>`:'';
    inner.innerHTML=`
      <header class="rtv2Header">
        <button type="button" class="rtv2Back" data-rtv2-action="close" aria-label="Terug naar kaart">‹</button>
        <div><span>Mijn Roadtrip</span><h2>${esc(trip.origin.replace(', Nederland',''))} → ${esc(trip.destination.replace(', Oostenrijk',''))}</h2></div>
        <button type="button" class="rtv2Close" data-rtv2-action="close" aria-label="Sluiten">×</button>
      </header>
      <section class="rtv2Hero">
        <div><span>Route-overzicht</span><b>${esc(summary.timeLabel||'9u 03m')}</b><small>Rijtijd</small></div>
        <div><span>Afstand</span><b>${esc(summary.distanceLabel||'1.005 km')}</b><small>Totaal</small></div>
        <div><span>Stops</span><b>${totalStops}</b><small>Tussenstops</small></div>
      </section>
      <nav class="rtv2Tabs"><button class="active" type="button">Overzicht</button><button type="button" disabled>Trajecten</button><button type="button" disabled>Hotels</button><button type="button" disabled>Notities</button></nav>
      <section class="rtv2Timeline">${timeline.join('')}${empty}</section>
      <footer class="rtv2Footer">
        <button type="button" data-rtv2-action="clear" ${stops.length?'':'disabled'}>Leegmaken</button>
        <button type="button" data-rtv2-action="maps">Start in Google Maps</button>
      </footer>`;
  }

  function setBottomActive(){
    $$('#mapScreen .bottomNav .navItem').forEach(b=>{
      const active=b.dataset.roadtripPage==='true';
      b.classList.toggle('active',active);
      b.classList.toggle('is-active',active);
    });
  }
  function openPage(){
    killLegacyRoadtrip();
    render();
    ensurePage().classList.add('active');
    $('.phone')?.classList.add('roadtripV2PageOpen');
    setBottomActive();
    toast('Mijn Roadtrip geopend');
  }
  function closePage(){
    ensurePage().classList.remove('active');
    $('.phone')?.classList.remove('roadtripV2PageOpen');
    $$('#mapScreen .bottomNav .navItem').forEach(b=>{
      const active=(b.dataset.nav||'')==='route';
      b.classList.toggle('active',active);
      b.classList.toggle('is-active',active);
    });
    try{ window.RoadoraMapApi?.fitRoute?.('roadtrip-close'); }catch(_){ }
  }
  function removeStop(id){
    const trip=readTrip();
    trip.stops=trip.stops.filter((s,i)=>String(s.id||i)!==String(id));
    writeTrip(trip);
    render();
    updateBadge();
    toast('Stop verwijderd');
  }
  function clearStops(){
    const trip=readTrip();
    if(!trip.stops.length) return;
    trip.stops=[];
    writeTrip(trip);
    render();
    updateBadge();
    toast('Roadtrip geleegd');
  }
  function focusStop(id){
    const trip=readTrip();
    const stop=trip.stops.find((s,i)=>String(s.id||i)===String(id));
    if(!stop) return toast('Stop niet gevonden');
    closePage();
    try{ window.RoadoraMapApi?.showPanel?.(stop); setTimeout(()=>window.RoadoraMapApi?.focusSelected?.(),80); }catch(_){ }
  }
  function updateBadge(){
    const count=readTrip().stops.length;
    $$('#mapScreen .bottomNav .navItem[data-roadtrip-page="true"], #mapScreen .bottomNav .navItem[data-nav="roadtripPage"]').forEach(btn=>{
      btn.dataset.roadtripCount=String(count);
      btn.classList.toggle('roadtripHasStops',count>0);
    });
  }

  document.addEventListener('click',function(e){
    const t=e.target;
    if(!t?.closest) return;
    const a=t.closest('[data-rtv2-action]');
    if(!a) return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    const action=a.dataset.rtv2Action;
    if(action==='close') return closePage();
    if(action==='remove') return removeStop(a.dataset.tripId);
    if(action==='clear') return clearStops();
    if(action==='focus') return focusStop(a.dataset.tripId);
    if(action==='maps') return window.RoadoraMapsExport?.open ? window.RoadoraMapsExport.open('roadtrip') : toast('Maps-export niet beschikbaar');
  },true);

  window.RoadoraRoadtripPage={open:openPage,close:closePage,render,updateBadge};
  window.addEventListener('roadora:roadtrip:update',()=>{isolateBottomRoadtripButton(); if($('#roadtripScreenV2Page')?.classList.contains('active')) render();});
  window.addEventListener('roadora:route:update',()=>{ if($('#roadtripScreenV2Page')?.classList.contains('active')) render();});
  function init(){
    killLegacyRoadtrip();
    isolateBottomRoadtripButton();
    ensurePage();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
