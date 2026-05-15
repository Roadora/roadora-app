/* Roadora v6.8 Route Sync + Roadtrip Timeline
   Patch-laag bovenop bestaande app.js.
   Maps-export/navigatie blijft ongemoeid.
*/
(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

  const START={name:'Rotterdam, Nederland',short:'Rotterdam',type:'start',role:'Startpunt'};
  const END={name:'Innsbruck, Oostenrijk',short:'Innsbruck',type:'end',role:'Eindbestemming'};
  const DEFAULT_MODEL={
    start:START,
    end:END,
    stops:[
      {name:'JET',type:'fuel',role:'Tankstop',meta:'Langs de route'},
      {name:'Stuttgart Mitte',type:'food',role:'Eten & drinken',meta:'Handige pauzeplek'}
    ],
    segments:[
      {from:'Rotterdam',to:'JET',km:243,min:145},
      {from:'JET',to:'Stuttgart Mitte',km:320,min:195},
      {from:'Stuttgart Mitte',to:'Innsbruck',km:400,min:241}
    ]
  };

  const state={model:null,lastRouteGeometry:null};

  function toast(msg){
    if(window.RoadoraToast) return window.RoadoraToast(msg);
    const t=$('#mapToast'); if(!t) return;
    t.textContent=msg; t.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('show'),1400);
  }
  function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function fmtTime(min){
    min=Math.max(0,Math.round(Number(min)||0));
    const h=Math.floor(min/60), m=min%60;
    if(!h) return `${m}m`;
    return m?`${h}u ${String(m).padStart(2,'0')}m`:`${h}u`;
  }
  function iconFor(p,i){
    if(p.type==='start') return 'A';
    if(p.type==='end') return 'B';
    if(p.type==='fuel') return '⛽';
    if(p.type==='hotel') return '🏨';
    if(p.type==='ev') return '⚡';
    if(p.type==='food') return '🍽️';
    return i;
  }
  function labelFor(type){
    return ({start:'Startpunt',end:'Eindbestemming',fuel:'Tankstop',hotel:'Hotelstop',ev:'Laadstop',food:'Eten & drinken',view:'Activiteit'})[type]||'Tussenstop';
  }
  function model(){
    const external=window.RoadoraRouteModel || window.RoadoraActiveRoute || null;
    const m=state.model || external || DEFAULT_MODEL;
    const start=m.start||START, end=m.end||END;
    const stops=Array.isArray(m.stops)?m.stops.filter(Boolean):[];
    let segments=Array.isArray(m.segments)?m.segments.filter(Boolean):[];
    if(!segments.length){
      segments=stops.length?[
        {from:start.short||start.name,to:stops[0].name,km:243,min:145},
        ...stops.slice(1).map((s,i)=>({from:stops[i].name,to:s.name,km:220,min:135})),
        {from:stops.at(-1)?.name||start.short||start.name,to:end.short||end.name,km:400,min:241}
      ]:[{from:start.short||start.name,to:end.short||end.name,km:963,min:581}];
    }
    const totalKm=segments.reduce((a,s)=>a+(Number(s.km)||0),0)||Number(m.totalKm)||963;
    const totalMin=segments.reduce((a,s)=>a+(Number(s.min)||0),0)||Number(m.totalMin)||581;
    return {...m,start,end,stops,segments,totalKm,totalMin};
  }

  function syncTopbar(){
    const d=model();
    $('#mapStatusTitle') && ($('#mapStatusTitle').textContent=`${d.start.short||d.start.name} → ${d.end.short||d.end.name}`);
    $('#mapStatusBadge') && ($('#mapStatusBadge').textContent='Roadtrip-route actief');
    $('#mapStatusSub') && ($('#mapStatusSub').textContent=`${d.totalKm} km · ${fmtTime(d.totalMin)} · ${d.stops.length} tussenstops`);
    $('#mapStatusEta') && ($('#mapStatusEta').textContent=fmtTime(d.totalMin));
    $('#mapStatusDistance') && ($('#mapStatusDistance').textContent=`${d.totalKm} km`);
    $('#mapStatusNext') && ($('#mapStatusNext').textContent=d.stops[0]?`Volgende: ${d.stops[0].name}`:'Volgende: eindbestemming');
    const stats=$$('.stats .stat b');
    if(stats[1]) stats[1].textContent=`${d.totalKm} km`;
    if(stats[2]) stats[2].textContent=`${d.stops.length} stops`;
  }

  function syncBottomSheet(){
    const d=model();
    const next=d.stops[0]||d.end;
    const seg=d.segments[0]||{km:d.totalKm,min:d.totalMin,from:d.start.short||d.start.name};
    const overline=$('#sheetOverline') || $('.sheet .overline');
    if(overline){ overline.id='sheetOverline'; overline.textContent=d.stops[0]?'Volgende stop':'Eindbestemming'; }
    $('#stopTitle') && ($('#stopTitle').textContent=next.name);
    $('#stopMeta') && ($('#stopMeta').textContent=`${seg.km} km · ${fmtTime(seg.min)} vanaf ${seg.from||d.start.short||d.start.name}`);
    $('#stopDesc') && ($('#stopDesc').textContent='Je roadtrip-route is actief. Open Mijn Roadtrip om per traject te zien waar een extra stop handig is.');
    $('.sheet .primary') && ($('.sheet .primary').textContent=d.stops[0]?'⌁ Navigeer naar volgende stop':'⌁ Navigeer naar bestemming');
  }

  function ensureTimelineSheet(){
    let el=$('#roadtripTimelineSheet'); if(el) return el;
    el=document.createElement('section');
    el.id='roadtripTimelineSheet';
    el.className='roadtripSheet';
    el.innerHTML=`<article class="roadtripCard">
      <div class="roadtripHead"><div><span>Mijn Roadtrip</span><h2>Route-opbouw</h2></div><button class="roadtripClose" type="button" data-roadtrip-close>×</button></div>
      <div class="roadtripTimeline" id="roadtripTimelineList"></div>
      <div class="roadtripFooter"><button class="roadtripGhost" type="button" data-roadtrip-close>Sluiten</button><button class="roadtripPrimary" type="button" data-roadora-action="add-stop">Stop toevoegen</button></div>
    </article>`;
    ($('#mapScreen .roadMapApp')||document.body).appendChild(el);
    return el;
  }

  function renderTimeline(){
    const d=model(); const points=[d.start,...d.stops,d.end];
    const list=ensureTimelineSheet().querySelector('#roadtripTimelineList'); if(!list) return;
    let html='';
    points.forEach((p,i)=>{
      html+=`<div class="roadtripPoint ${esc(p.type||'')}"><div class="roadtripPointIcon">${esc(iconFor(p,i))}</div><div><b>${esc(p.name)}</b><small>${esc(p.role||labelFor(p.type))}${p.meta?' · '+esc(p.meta):''}</small></div></div>`;
      if(i<points.length-1){
        const seg=d.segments[i]||{km:0,min:0,to:points[i+1].name};
        html+=`<div class="roadtripSegment"><div class="roadtripSegmentLine"></div><div class="roadtripSegmentInfo"><b>${esc(seg.km)} km · ${esc(fmtTime(seg.min))}</b><small>Rijtijd naar ${esc(points[i+1].name)}</small></div><button class="roadtripMiniAction" type="button" data-roadora-action="add-stop-between" data-between="${i}">+ stop</button></div>`;
      }
    });
    list.innerHTML=html;
  }
  function openTimeline(){renderTimeline();ensureTimelineSheet().classList.add('open');$$('#mapScreen .bottomNav .navItem').forEach(b=>b.classList.toggle('active',b.dataset.nav==='roadtrip'));toast('Mijn Roadtrip geopend');}
  function closeTimeline(){ $('#roadtripTimelineSheet')?.classList.remove('open'); }

  function refreshMarkersAlongCurrentRoute(geometry){
    const api=window.RoadoraMapApi||{};
    const routeGeometry=geometry || state.lastRouteGeometry || api.getRouteGeometry?.() || window.RoadoraActiveRouteGeometry || null;
    state.lastRouteGeometry=routeGeometry || state.lastRouteGeometry;
    try{ api.clearCategoryMarkers?.(); }catch(_){ }
    try{ api.clearStopMarkers?.(); }catch(_){ }
    try{ api.reloadCategoriesAlongRoute?.(routeGeometry); }catch(_){ }
    try{ api.refreshStopsAlongRoute?.(routeGeometry); }catch(_){ }
    try{ window.reloadCategoriesAlongRoute?.(routeGeometry); }catch(_){ }
    try{ window.refreshStopsAlongRoute?.(routeGeometry); }catch(_){ }
    document.dispatchEvent(new CustomEvent('roadora:v68-route-markers-refresh',{detail:{geometry:routeGeometry}}));
  }

  function afterRouteChanged(detail={}){
    if(detail.model) state.model=detail.model;
    if(detail.geometry) state.lastRouteGeometry=detail.geometry;
    syncTopbar(); syncBottomSheet(); renderTimeline(); refreshMarkersAlongCurrentRoute(detail.geometry);
  }

  document.addEventListener('click',function(e){
    const btn=e.target.closest('button'); if(!btn) return;
    const action=btn.dataset.roadoraAction;
    if(btn.dataset.nav==='roadtrip' || action==='open-roadtrip') { e.preventDefault(); openTimeline(); return; }
    if(btn.hasAttribute('data-roadtrip-close')) { e.preventDefault(); closeTimeline(); return; }
    if(action==='add-stop' || action==='add-stop-between') { e.preventDefault(); toast('Kies links een categorie om hier een stop toe te voegen'); return; }
  },true);

  document.addEventListener('roadora:route-changed',e=>afterRouteChanged(e.detail||{}));
  document.addEventListener('roadora:stops-changed',e=>afterRouteChanged(e.detail||{}));
  window.RoadoraRouteSync={model,syncTopbar,syncBottomSheet,renderTimeline,openTimeline,closeTimeline,refreshMarkersAlongCurrentRoute,afterRouteChanged};

  window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{syncTopbar();syncBottomSheet();renderTimeline();},120));
})();
