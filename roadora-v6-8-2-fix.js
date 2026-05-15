/* Roadora v6.8.2 — echte fixlaag
   - Maps-export/navigatie wordt NIET aangepast.
   - Mijn Roadtrip krijgt volledige start → segment → stop → segment → eindbestemming timeline.
   - Topbar/bottomsheet worden route-aware.
   - Oude category markers worden na routewijziging gefilterd op de actieve Leaflet-route.
*/
(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const START={name:'Rotterdam, Nederland',short:'Rotterdam',type:'start',role:'Startpunt'};
  const END={name:'Innsbruck, Oostenrijk',short:'Innsbruck',type:'end',role:'Eindbestemming'};
  const FALLBACK_STOPS=[
    {name:'EnBW Ladepark Heidelberg',type:'ev',role:'Laadstop',meta:'12 snelladers'},
    {name:'Stuttgart Mitte',type:'food',role:'Eten & drinken',meta:'Pauzeplek richting Oostenrijk'}
  ];
  const FALLBACK_SEGMENTS=[
    {from:'Rotterdam',to:'EnBW Ladepark Heidelberg',km:356,min:235},
    {from:'EnBW Ladepark Heidelberg',to:'Stuttgart Mitte',km:120,min:80},
    {from:'Stuttgart Mitte',to:'Innsbruck',km:493,min:279}
  ];
  const state={model:null,lastRouteCoords:null,armed:false};

  function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function toast(msg){ if(window.RoadoraToast) return window.RoadoraToast(msg); const t=$('#mapToast'); if(t){t.textContent=msg;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),1300);} }
  function fmtTime(min){min=Math.max(0,Math.round(Number(min)||0));const h=Math.floor(min/60),m=min%60;return h?(m?`${h}u ${String(m).padStart(2,'0')}m`:`${h}u`):`${m}m`;}
  function labelFor(t){return ({start:'Startpunt',end:'Eindbestemming',fuel:'Tankstop',hotel:'Hotelstop',ev:'Laadstop',food:'Eten & drinken',view:'Activiteit'})[t]||'Tussenstop';}
  function iconFor(p,i){ if(p.type==='start')return 'A'; if(p.type==='end')return 'B'; if(p.type==='fuel')return '⛽'; if(p.type==='hotel')return '🏨'; if(p.type==='ev')return '⚡'; if(p.type==='food')return '🍽️'; return String(i); }
  function cleanName(v){return String(v||'').replace(/^[0-9]+\s*/,'').replace(/×$/,'').trim();}

  function globalStops(){
    const candidates=[
      window.RoadoraTripStops,window.RoadoraRouteStops,window.RoadoraSelectedStops,
      window.RoadoraState?.roadtripStops,window.RoadoraState?.routeStops,window.RoadoraState?.stops,
      window.RoadoraMapApi?.getRoadtripStops?.(),window.RoadoraMapApi?.getStops?.(),window.RoadoraMapApi?.getSelectedStops?.()
    ];
    for(const c of candidates){ if(Array.isArray(c)&&c.length) return c.map(normalizeStop).filter(Boolean); }
    return [];
  }
  function normalizeStop(s){
    if(!s) return null;
    const name=cleanName(s.name||s.title||s.label||s.placeName||s.textContent||'');
    if(!name) return null;
    return {name,type:s.type||s.category||'stop',role:s.role||s.label||labelFor(s.type||s.category),meta:s.meta||s.address||s.desc||s.description||'',ll:s.ll||s.latlng||s.latLng||null};
  }
  function model(){
    const external=window.RoadoraRouteModel||window.RoadoraActiveRoute||null;
    const src=state.model||external||{};
    const start=src.start||START,end=src.end||END;
    let stops=Array.isArray(src.stops)&&src.stops.length?src.stops.map(normalizeStop).filter(Boolean):globalStops();
    if(!stops.length) stops=FALLBACK_STOPS.slice();
    let segments=Array.isArray(src.segments)&&src.segments.length?src.segments:FALLBACK_SEGMENTS.slice(0,stops.length+1);
    if(segments.length<stops.length+1){
      segments=[];
      const totalKm=Number(src.totalKm)||969,totalMin=Number(src.totalMin)||594;
      const parts=stops.length+1;
      for(let i=0;i<parts;i++) segments.push({from:i===0?(start.short||start.name):stops[i-1].name,to:i<stops.length?stops[i].name:(end.short||end.name),km:Math.round(totalKm/parts),min:Math.round(totalMin/parts)});
    }
    const totalKm=Number(src.totalKm)||segments.reduce((a,s)=>a+(Number(s.km)||0),0)||969;
    const totalMin=Number(src.totalMin)||segments.reduce((a,s)=>a+(Number(s.min)||0),0)||594;
    return {start,end,stops,segments,totalKm,totalMin};
  }

  function syncTopbar(){
    const d=model();
    const title=$('#mapStatusTitle'); if(title) title.textContent=`${d.start.short||d.start.name} → ${d.end.short||d.end.name}`;
    const badge=$('#mapStatusBadge'); if(badge) badge.textContent='Roadtrip-route actief';
    const sub=$('#mapStatusSub'); if(sub) sub.textContent=`${d.totalKm} km · ${fmtTime(d.totalMin)} · ${d.stops.length} tussenstops`;
    const eta=$('#mapStatusEta'); if(eta) eta.textContent=fmtTime(d.totalMin);
    const dist=$('#mapStatusDistance'); if(dist) dist.textContent=`${d.totalKm} km`;
    const next=$('#mapStatusNext'); if(next) next.textContent=d.stops[0]?`Volgende: ${d.stops[0].name}`:'Volgende: eindbestemming';
    const stats=$$('.stats .stat b'); if(stats[1]) stats[1].textContent=`${d.totalKm} km`; if(stats[2]) stats[2].textContent=String(d.stops.length);
  }
  function syncSheet(){
    const d=model(), next=d.stops[0]||d.end, seg=d.segments[0]||{km:d.totalKm,min:d.totalMin,from:d.start.short||d.start.name};
    const ov=$('.sheet .overline'); if(ov){ov.id='sheetOverline';ov.textContent=d.stops[0]?'Volgende stop':'Eindbestemming';}
    const title=$('#stopTitle'); if(title) title.textContent=next.name;
    const meta=$('#stopMeta'); if(meta) meta.textContent=`${seg.km} km · ${fmtTime(seg.min)} vanaf ${seg.from||d.start.short||d.start.name}`;
    const desc=$('#stopDesc'); if(desc) desc.textContent='Open Mijn Roadtrip voor de afstand en rijtijd per traject. Is een stuk te lang? Voeg daar een extra stop toe of vervang de stop.';
    const primary=$('.sheet .primary'); if(primary) primary.textContent=d.stops[0]?'⌁ Navigeer naar volgende stop':'⌁ Navigeer naar bestemming';
  }

  function ensureTimeline(){
    let el=$('#rdTimelineSheet'); if(el) return el;
    el=document.createElement('section'); el.id='rdTimelineSheet'; el.className='rdTimelineSheet';
    el.innerHTML=`<article class="rdTimelineCard"><div class="rdTimelineHead"><div><span>Mijn Roadtrip</span><h2>Route-opbouw</h2></div><button class="rdTimelineClose" type="button" data-rd-close>×</button></div><div class="rdTimelineList" id="rdTimelineList"></div><div class="rdTimelineFooter"><button class="rdTimelineGhost" type="button" data-rd-close>Sluiten</button><button class="rdTimelinePrimary" type="button" data-rd-action="add-stop">Stop toevoegen</button></div></article>`;
    ($('#mapScreen .roadMapApp')||document.body).appendChild(el); return el;
  }
  function renderTimeline(){
    const d=model(), points=[d.start,...d.stops,d.end], list=ensureTimeline().querySelector('#rdTimelineList'); if(!list) return;
    list.innerHTML=points.map((p,i)=>{
      let html=`<div class="rdPoint ${esc(p.type||'')}"><div class="rdPointIcon">${esc(iconFor(p,i))}</div><div><b>${esc(p.name)}</b><small>${esc(p.role||labelFor(p.type))}${p.meta?' · '+esc(p.meta):''}</small></div></div>`;
      if(i<points.length-1){ const s=d.segments[i]||{km:0,min:0}; html+=`<div class="rdSeg"><div class="rdSegLine"></div><div><b>${esc(s.km)} km · ${esc(fmtTime(s.min))}</b><small>Rijtijd naar ${esc(points[i+1].name)}</small></div><button class="rdMini" type="button" data-rd-action="add-between" data-between="${i}">+ stop</button></div>`; }
      return html;
    }).join('');
  }
  function hideOldTripSheets(){
    $$('section,div,article').forEach(el=>{
      if(el.id==='rdTimelineSheet'||el.closest('#rdTimelineSheet')) return;
      const txt=(el.textContent||'').slice(0,160).toLowerCase();
      if(txt.includes('je gekozen tussenstops') || (txt.includes('mijn roadtrip')&&txt.includes('leegmaken')&&txt.includes('klaar'))) el.classList.add('rdOldTripHidden');
    });
  }
  function openTimeline(){hideOldTripSheets();renderTimeline();ensureTimeline().classList.add('open');$$('#mapScreen .bottomNav .navItem').forEach(b=>b.classList.toggle('active',b.dataset.nav==='roadtrip'));toast('Mijn Roadtrip geopend');}
  function closeTimeline(){ $('#rdTimelineSheet')?.classList.remove('open'); }

  function latlngOf(x){
    if(!x) return null;
    if(Array.isArray(x)) return {lat:Number(x[0]),lng:Number(x[1])};
    if(typeof x.lat==='number'&&typeof x.lng==='number') return x;
    if(typeof x.lat==='number'&&typeof x.lon==='number') return {lat:x.lat,lng:x.lon};
    return null;
  }
  function distMeters(a,b){
    const R=6371000,rad=Math.PI/180,lat1=a.lat*rad,lat2=b.lat*rad,dlat=(b.lat-a.lat)*rad,dlng=(b.lng-a.lng)*rad;
    const h=Math.sin(dlat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlng/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  }
  function project(p,origin){ const mLat=111320, mLng=111320*Math.cos((origin.lat||0)*Math.PI/180); return {x:(p.lng-origin.lng)*mLng,y:(p.lat-origin.lat)*mLat}; }
  function pointSegDist(p,a,b){
    const o=a, P=project(p,o), A=project(a,o), B=project(b,o), vx=B.x-A.x,vy=B.y-A.y, wx=P.x-A.x,wy=P.y-A.y;
    const c=vx*vx+vy*vy; if(!c) return distMeters(p,a); const t=Math.max(0,Math.min(1,(wx*vx+wy*vy)/c));
    const q={lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t}; return distMeters(p,q);
  }
  function distanceToRoute(p,coords){ let best=Infinity; for(let i=0;i<coords.length-1;i++) best=Math.min(best,pointSegDist(p,coords[i],coords[i+1])); return best; }
  function extractRouteCoords(){
    const api=window.RoadoraMapApi||{}; let g=api.getRouteGeometry?.()||window.RoadoraActiveRouteGeometry||state.lastRouteCoords;
    if(Array.isArray(g)&&g.length){ const c=g.map(latlngOf).filter(Boolean); if(c.length>1) return c; }
    if(g?.coordinates){ const c=g.coordinates.map(x=>Array.isArray(x)?{lat:Number(x[1]),lng:Number(x[0])}:latlngOf(x)).filter(Boolean); if(c.length>1) return c; }
    const map=window.roadoraLeafletMap; if(!map?._layers) return null;
    let best=null,bestLen=0;
    Object.values(map._layers).forEach(layer=>{
      if(typeof layer.getLatLngs!=='function') return;
      let arr=layer.getLatLngs(); if(Array.isArray(arr[0])) arr=arr.flat(2);
      const coords=arr.map(latlngOf).filter(Boolean); if(coords.length<8) return;
      let len=0; for(let i=0;i<coords.length-1;i++) len+=distMeters(coords[i],coords[i+1]);
      if(len>bestLen){bestLen=len;best=coords;}
    });
    if(best) state.lastRouteCoords=best; return best;
  }
  function isCategoryMarker(marker){
    const el=marker.getElement?.()||marker._icon; const html=(el?.innerHTML||el?.textContent||'').toLowerCase(); const cls=(el?.className||'').toString().toLowerCase();
    if(html.includes('hotel')||html.includes('bed')||html.includes('🛏')||html.includes('⛽')||html.includes('⚡')||html.includes('🍽')||html.includes('restaurant')) return true;
    return cls.includes('cat')||cls.includes('stop')||cls.includes('hotel')||cls.includes('fuel')||cls.includes('ev')||cls.includes('food');
  }
  function filterMarkersAlongRoute(){
    const map=window.roadoraLeafletMap, coords=extractRouteCoords(); if(!map?._layers||!coords||coords.length<2) return;
    Object.values(map._layers).forEach(layer=>{
      if(typeof layer.getLatLng!=='function') return;
      const p=latlngOf(layer.getLatLng()); if(!p) return;
      const el=layer.getElement?.()||layer._icon; if(!el||!isCategoryMarker(layer)) return;
      const d=distanceToRoute(p,coords); const show=d<=22000;
      el.style.display=show?'':'none'; if(layer._shadow) layer._shadow.style.display=show?'':'none';
    });
  }
  function refreshRouteSync(detail={}){
    if(detail.model) state.model=detail.model; if(detail.geometry) state.lastRouteCoords=null;
    syncTopbar(); syncSheet(); renderTimeline();
    const api=window.RoadoraMapApi||{};
    try{ api.clearCategoryMarkers?.(); }catch(_){ }
    try{ api.reloadCategoriesAlongRoute?.(detail.geometry||extractRouteCoords()); }catch(_){ }
    [120,500,1100,2200].forEach(ms=>setTimeout(filterMarkersAlongRoute,ms));
  }
  function armRoadtripButton(){
    if(state.armed) return; state.armed=true;
    const bind=()=>{
      const btn=$('#mapScreen .bottomNav .navItem[data-nav="roadtrip"]'); if(!btn||btn.dataset.rdArmed) return;
      btn.dataset.rdArmed='1';
      ['pointerdown','mousedown','touchstart','click'].forEach(ev=>btn.addEventListener(ev,function(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openTimeline();},true));
    };
    bind(); setTimeout(bind,300); setTimeout(bind,1000);
  }

  document.addEventListener('click',function(e){
    const btn=e.target.closest('button'); if(!btn) return;
    if(btn.closest('#rdTimelineSheet') && btn.hasAttribute('data-rd-close')){e.preventDefault();closeTimeline();return;}
    if(btn.closest('#rdTimelineSheet') && btn.dataset.rdAction){e.preventDefault();toast('Kies een categorie op de kaart om hier een stop toe te voegen');return;}
    if(btn.dataset.nav==='roadtrip'){e.preventDefault();e.stopImmediatePropagation();openTimeline();return;}
  },true);
  document.addEventListener('roadora:route-changed',e=>refreshRouteSync(e.detail||{}));
  document.addEventListener('roadora:stops-changed',e=>refreshRouteSync(e.detail||{}));
  window.RoadoraRouteSync={model,syncTopbar,syncSheet,renderTimeline,openTimeline,closeTimeline,filterMarkersAlongRoute,refreshRouteSync};
  window.addEventListener('DOMContentLoaded',()=>{armRoadtripButton();setTimeout(refreshRouteSync,180);setInterval(filterMarkersAlongRoute,2500);});
})();
