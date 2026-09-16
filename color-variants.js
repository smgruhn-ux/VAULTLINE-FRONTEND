// ═══════════════════════════════════════════════════════════════
// Vaultline — color-variants.js
// Enhanced color/size selection for the quick-view product detail.
// Loaded after app-live.js. Reads window.__quickProduct / __quickColorSwatch.
// ═══════════════════════════════════════════════════════════════

const qSwatches=document.querySelector('#quick-swatches');
const qVariants=document.querySelector('#quick-variants');
const qImage=document.querySelector('#quick-image');
const qPrice=document.querySelector('#quick-price');
const qColorLabel=document.querySelector('#quick-color-label');
const qBuy=document.querySelector('#quick-buy');

let syncing=false;

// ── Helpers (mirror app-live.js) ──────────────────────────────
const ok=v=>!(v?.stock?.type==='LIMITED'&&Number(v?.stock?.inStock||0)<=0);
const vImg=v=>v?.images?.[0]?.transformedUrl||v?.images?.[0]?.url||'';
const vColor=v=>v?.attributes?.color?.name||'';
const vSwatch=v=>v?.attributes?.color?.swatch||'';
const vSize=v=>v?.attributes?.size?.name||'';
const esc=(v='')=>String(v).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const money=(v,c='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency:c}).format(Number(v)||0);

// ── Group variants by swatch hex (aligns with rendered swatch dots) ─
function colorGroups(variants){
  const out=[];const seen=new Set();
  for(const v of variants){
    const sw=vSwatch(v);if(!sw)continue;
    if(!seen.has(sw)){seen.add(sw);out.push({name:vColor(v),swatch:sw,image:'',variants:[]});}
    const g=out.find(x=>x.swatch===sw);
    g.variants.push(v);
    if(!g.image){const img=vImg(v);if(img)g.image=img;}
  }
  return out;
}

// ── Apply a color selection ───────────────────────────────────
function applyColor(swatchHex,groups){
  if(!groups.length)return;
  const group=groups.find(g=>g.swatch===swatchHex)||groups[0];

  // 1. Highlight the selected swatch dot
  const dots=[...(qSwatches?.querySelectorAll('.sw')||[])];
  dots.forEach((dot,i)=>{
    const g=groups[i];
    const sel=!!g&&g.swatch===group.swatch;
    const stock=!!g&&g.variants.some(ok);
    dot.classList.toggle('is-sel',sel);
    dot.classList.toggle('is-out',!stock);
    dot.setAttribute('aria-pressed',String(sel));
  });

  // 2. Show selected color name
  if(qColorLabel)qColorLabel.textContent=group.name;

  // 3. Update product image
  if(qImage&&group.image)qImage.src=group.image;

  // 4. Rebuild size buttons for this color
  rebuildSizes(group);

  // 5. Update price
  updatePrice(group);
}

function rebuildSizes(group){
  if(!qVariants)return;
  syncing=true;
  const variants=group.variants;
  qVariants.innerHTML=variants.map(v=>{
    const sz=vSize(v);const cn=vColor(v);
    const display=sz||(cn||'Default');
    return `<button type="button" class="sz" data-vid="${esc(v.id)}" data-swatch="${esc(vSwatch(v))}" data-size="${esc(sz)}" ${ok(v)?'':'disabled class="sz is-out"'} aria-label="${esc(display)}">${esc(display)}</button>`;
  }).join('');
  // Auto-select first available size
  const first=qVariants.querySelector('.sz:not([disabled])');
  if(first)first.classList.add('is-sel');
  requestAnimationFrame(()=>{syncing=false;});
}

function updatePrice(group){
  if(!qPrice)return;
  const selBtn=qVariants?.querySelector('.sz.is-sel');
  const vid=selBtn?.dataset.vid;
  const v=vid?group.variants.find(x=>x.id===vid):group.variants.find(ok)||group.variants[0];
  if(v?.unitPrice)qPrice.textContent=money(v.unitPrice.value,v.unitPrice.currency);
}

// ── Size button click ─────────────────────────────────────────
qVariants?.addEventListener('click',e=>{
  const btn=e.target.closest('.sz:not([disabled])');
  if(!btn)return;
  qVariants.querySelectorAll('.sz').forEach(s=>s.classList.remove('is-sel'));
  btn.classList.add('is-sel');
  // Update price for selected size
  const p=window.__quickProduct;if(!p)return;
  const v=p.variants.find(x=>x.id===btn.dataset.vid);
  if(v?.unitPrice)qPrice.textContent=money(v.unitPrice.value,v.unitPrice.currency);
});

qVariants?.addEventListener('keydown',e=>{
  const btn=e.target.closest('.sz');
  if(btn&&(e.key==='Enter'||e.key===' ')){e.preventDefault();btn.click();}
});

// ── Swatch click in quick-view ────────────────────────────────
qSwatches?.addEventListener('click',e=>{
  const dot=e.target.closest('.sw');
  if(!dot)return;
  const p=window.__quickProduct;
  if(!p?.variants?.length)return;
  const groups=colorGroups(p.variants);
  const idx=[...(qSwatches.querySelectorAll('.sw'))].indexOf(dot);
  const group=groups[idx];
  if(!group||!group.variants.some(ok))return;
  applyColor(group.swatch,groups);
});

qSwatches?.addEventListener('keydown',e=>{
  const dot=e.target.closest('.sw');
  if(dot&&(e.key==='Enter'||e.key===' ')){e.preventDefault();dot.click();}
});

// ── Auto-init when quick-view opens ───────────────────────────
function initialSync(){
  if(syncing)return;
  const p=window.__quickProduct;
  if(!p?.variants?.length)return;
  const groups=colorGroups(p.variants);
  if(!groups.length)return;
  // If only one unnamed group, skip color selection
  if(groups.length<=1&&!groups[0].name)return;
  // Use pre-selected swatch from card, or default to first
  const preSel=window.__quickColorSwatch;
  const target=preSel&&groups.find(g=>g.swatch===preSel)?preSel:groups[0].swatch;
  applyColor(target,groups);
}

// Observe swatch container for content changes (triggered by openQuick)
const obs=new MutationObserver(()=>requestAnimationFrame(initialSync));
if(qSwatches)obs.observe(qSwatches,{childList:true});
