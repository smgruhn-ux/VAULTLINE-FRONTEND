// Vaultline Storefront — app-live.js
// Fourthwall catalog, cart, checkout. Concept-board faithful.

const STORE_URL='https://vaultlineofficial-shop.fourthwall.com';
const CART_KEY='vaultline_fourthwall_cart_id';

const COLLECTIONS={
'deadstep-2':{name:'DEADSTEP',ids:['a6d1a51d-dbc2-443e-ae40-b63aa063d162','36540eef-7b3b-4c11-8a74-2ecfe4a8112c','b898acba-6d88-497a-92ef-1ada640529f9','1090eea7-35ee-4479-a97b-2d1f519f5877']},
'submerged':{name:'CURRENT BETWEEN',ids:['47669ad4-64aa-48c4-98d5-faddb6ac19ca','9b247c1b-98a5-4e22-ac7a-67d5a32ac0b2','0f64031d-8c45-44ae-bed2-afa7ff3e1ea7']},
'mens':{name:'OMEGA',ids:['b286f875-d3af-404b-8566-8e3aff5babf4','5ccc668c-8e1a-453c-a0f3-fef4aa34d643','82222c0a-c528-4515-9ad5-cff53d6f3097','123cfbfc-9f7b-4b46-8922-d24b74577abe','fbcfac27-c34b-4b8d-89d0-2328ee65801e','c626edea-c1a3-4312-bc32-3492bfe3981c','36540eef-7b3b-4c11-8a74-2ecfe4a8112c','47669ad4-64aa-48c4-98d5-faddb6ac19ca','7cb1b3f5-a425-450d-a099-7fc93b4765e9','128c67e2-5013-42f2-b7eb-4bdd038e4f98','77fad9e7-900c-423e-b6d6-07f0565b8b06','f3260b5f-99bd-4da7-955a-c436c1e9f0b1','ccdcd3e3-2a1d-4f31-9ea2-1060e56dac1e','a6d1a51d-dbc2-443e-ae40-b63aa063d162','71401409-2322-4ca0-b18a-d50cda177bbb','f973e82c-3e18-4b13-a64a-dcb30ded4314','937a41b5-7ce9-4a77-882a-c491932f4f87','1090eea7-35ee-4479-a97b-2d1f519f5877','ce087c73-da9b-44b7-85c7-a77d948a9f8c','2671f7e0-8dfe-4491-89df-86493529f9ca']},
'womens':{name:'ALPHA',ids:['9f9a1b81-5322-458e-85fa-240952027d4a','ef947423-3eff-43f1-8039-98e36d258df8','26be87d7-fa56-48fa-a361-712e23bf675f','868e57cd-73e0-4145-a279-c55d1c2db228','09f864b0-6951-43a3-bc50-c623343ea332','128c67e2-5013-42f2-b7eb-4bdd038e4f98','5ccc668c-8e1a-453c-a0f3-fef4aa34d643','f0b25c33-7c1e-4fe5-8ff9-9fa32d2b9802','4dcd357d-3461-4104-b5f4-61c107cea0c7','0f64031d-8c45-44ae-bed2-afa7ff3e1ea7','439519f5-05d1-4ae6-9ff6-f7fe585cf714','b898acba-6d88-497a-92ef-1ada640529f9','ccdcd3e3-2a1d-4f31-9ea2-1060e56dac1e','f973e82c-3e18-4b13-a64a-dcb30ded4314','82222c0a-c528-4515-9ad5-cff53d6f3097','ff4d1949-80d7-4b88-b4c1-5e98815d31af','5a697916-951b-4a27-a501-9ca08392b76b','33067f9e-db5c-402f-a9d1-b8078c0942e5','3661021b-f112-4724-b001-3b489626be26','47f692c3-9bb8-4219-be7b-6c59b807e212','61ee0527-9900-4185-b526-fa285a7220cf','77b91fc0-9d02-4576-a3cb-97f07cb57b91','9b247c1b-98a5-4e22-ac7a-67d5a32ac0b2','908b42e4-ae07-49d8-a584-e6a92d50b93c','dd98fc71-cdda-48ee-8572-f5fea512fec6','69627d6e-8f4d-4aef-a8e7-c2f00a676c01','71401409-2322-4ca0-b18a-d50cda177bbb']},
'grave-offerings':{name:'GRAVE OFFERINGS',ids:['b70bb415-145c-4c32-b483-6f7298930b76','b0816d1c-587b-4da2-953e-5edd5bdc8d82','47f692c3-9bb8-4219-be7b-6c59b807e212','b5f2171f-4bf6-4414-b00e-3f03d0d01495','b286f875-d3af-404b-8566-8e3aff5babf4','7cb1b3f5-a425-450d-a099-7fc93b4765e9','92cfd594-773c-4dd0-adfb-b26ba7be7eca']},
'fractured-liberty':{name:'FRACTURED LIBERTY',ids:['dd98fc71-cdda-48ee-8572-f5fea512fec6','ff4d1949-80d7-4b88-b4c1-5e98815d31af','5a697916-951b-4a27-a501-9ca08392b76b','77b91fc0-9d02-4576-a3cb-97f07cb57b91','69627d6e-8f4d-4aef-a8e7-c2f00a676c01','33067f9e-db5c-402f-a9d1-b8078c0942e5','61ee0527-9900-4185-b526-fa285a7220cf','3661021b-f112-4724-b001-3b489626be26','439519f5-05d1-4ae6-9ff6-f7fe585cf714']}
};

const fallbackProducts=[
{name:'In Ruin We Trust Slides',slug:'in-ruin-we-trust-slides',price:36,image:'https://cdn.fourthwall.com/customizations/sh_0e0db572-47ce-453b-a747-142819f87a74/699ce60f-5fb4-4dcb-855a-74d3f865b6ee.png',copy:'Built for the aftermath.',colors:['#0e0c0f','#f1f1ef'],variants:[]},
{name:'White Sigil Rib Tank',slug:'white-sigil-rib-tank',price:25,image:'https://cdn.fourthwall.com/customizations/sh_0e0db572-47ce-453b-a747-142819f87a74/26b306d0-ab15-4974-9a9e-8729093d77d6.webp',copy:'Minimal from the front.',colors:['#0c0c0c','#243048','#aeb0b2'],variants:[]},
{name:'Crimson Thorn Baby Tee',slug:'crimson-thorn-baby-tee-vaultline-by-gizzy-graves',price:37,image:'https://cdn.fourthwall.com/customizations/sh_0e0db572-47ce-453b-a747-142819f87a74/54978fa7-1209-4d1c-9283-ff4f848068a1.webp',copy:'The front stays restrained.',colors:['#19171b','#3c2926','#e6e7e9'],variants:[]},
{name:'Northern Fracture Hoodie',slug:'vaultline-northern-fracture-hoodie',price:62,image:'https://cdn.fourthwall.com/customizations/sh_0e0db572-47ce-453b-a747-142819f87a74/69a3a0b2-52a8-4383-954c-f7c5383ceef2.webp',copy:'Heavy structure. Controlled fracture.',colors:['#0f0f0f','#30478a','#aeb0b2'],variants:[]},
{name:'Northern Thorn Cami',slug:'northern-thorn-cami-vaultline',price:25,image:'https://cdn.fourthwall.com/customizations/sh_0e0db572-47ce-453b-a747-142819f87a74/6099ed73-bac7-49c4-ac3d-514c6c67aca0.png',copy:'A softer silhouette.',colors:['#0c0c0c'],variants:[]},
{name:'IXXI Vaultline Tee',slug:'ixxi-vaultline-tee',price:38,image:'https://cdn.fourthwall.com/offer/sh_0e0db572-47ce-453b-a747-142819f87a74/00db2ce5-1ceb-4aee-8ad5-673047373ab1.png',copy:'IXXI at the front.',colors:['#424242'],variants:[]},
{name:'Half Butterfly Fracture Baby Tee',slug:'half-butterfly-fracture-baby-tee',price:38,image:'https://cdn.fourthwall.com/customizations/sh_0e0db572-47ce-453b-a747-142819f87a74/bbf26803-a430-4b71-af64-5167312caf82.webp',copy:'Transformation without erasure.',colors:['#19171b'],variants:[]},
{name:'Vaultline Gift Card',slug:'vaultline-gift-card',price:25,image:'https://cdn.fourthwall.com/offer/sh_0e0db572-47ce-453b-a747-142819f87a74/c2f2de89-d029-47a8-8446-ab2cabd39270.png',copy:'Give them access to the Vault.',colors:['#11151c'],variants:[]}
];

let allProducts=fallbackProducts,products=fallbackProducts,catalogLive=false;

const $=s=>document.querySelector(s);
const grid=$('#product-grid'),status=$('#catalog-status');
const menuToggle=$('#menu-toggle'),mobNav=$('#mob-nav');
const drawer=$('#cart-drawer'),scrim=$('#scrim');
const cartButton=$('#cart-button'),cartClose=$('#cart-close'),checkout=$('#checkout-button');
const cartItems=$('#cart-items'),cartCount=$('#cart-count'),cartTotal=$('#cart-total');
const quick=$('#quick-view'),quickClose=$('#quick-close');
const quickImage=$('#quick-image'),quickName=$('#quick-name'),quickDesc=$('#quick-description');
const quickIndex=$('#quick-index'),quickSwatches=$('#quick-swatches'),quickVariants=$('#quick-variants');
const quickPrice=$('#quick-price'),quickBuy=$('#quick-buy'),quickColorLabel=$('#quick-color-label');
const quickThumbs=$('#quick-thumbs');
const shopTitle=$('#shop-title'),shopKicker=$('#shop-kicker');

const money=(v,c='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency:c}).format(Number(v)||0);
const esc=(v='')=>String(v).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const clean=(v='')=>String(v).replace(/<[^>]*>/g,'').trim();
const ok=v=>!(v?.stock?.type==='LIMITED'&&Number(v?.stock?.inStock||0)<=0);
const vImg=v=>v?.images?.[0]?.transformedUrl||v?.images?.[0]?.url||'';
const vColor=v=>v?.attributes?.color?.name||'';
const vSwatch=v=>v?.attributes?.color?.swatch||'';
const vSize=v=>v?.attributes?.size?.name||'';

function normalize(payload){
  const list=Array.isArray(payload)?payload:(payload.products||payload.data||payload.items||[]);
  return list.map(p=>{
    const variants=Array.isArray(p.variants)?p.variants:[];
    const priced=variants.find(ok)||variants[0];
    const colors=[...new Set(variants.map(v=>vSwatch(v)).filter(Boolean))];
    return{id:p.id||p.offerId||'',name:p.name||p.title||'Vaultline piece',slug:p.slug||p.handle||p.id,price:p.price?.amount||p.price||priced?.unitPrice?.value||0,currency:p.price?.currency||p.currency||priced?.unitPrice?.currency||'USD',image:p.primaryImageUrl||p.images?.[0]?.transformedUrl||p.images?.[0]?.url||'',copy:clean(p.description)||'',colors:colors.length?colors:['#151515'],variants};
  });
}

function cardHTML(p,i){
  const swatches=p.colors.slice(0,6).map((c,ci)=>
    `<button type="button" class="sw${ci===0?' is-sel':''}" style="--sw:${esc(c)}" data-swatch="${esc(c)}" data-ci="${ci}" tabindex="0" aria-label="Color ${ci+1}"></button>`
  ).join('');
  return `<article class="p-card" data-idx="${i}">
    <div class="p-card-img" data-trigger="quick" data-index="${i}">
      <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">
    </div>
    <div class="p-card-body">
      <div class="p-card-name">${esc(p.name)}</div>
      <div class="p-card-price">${money(p.price,p.currency)}</div>
      <div class="p-card-swatches">${swatches}</div>
    </div>
  </article>`;
}

function render(list,live,statusText){
  products=list;
  grid.innerHTML=list.length?list.map((p,i)=>cardHTML(p,i)).join(''):'<div class="collection-empty">No products found.</div>';
  status.textContent=statusText||(live?`${list.length} PRODUCTS`:'STAGED');
}
function showAllProducts(){shopKicker.textContent='SHOP';shopTitle.textContent='CURRENT PIECES';render(allProducts,catalogLive);}
function showCollection(slug){
  const col=COLLECTIONS[slug];if(!col)return;
  const filtered=allProducts.filter(p=>new Set(col.ids).has(String(p.id)));
  shopKicker.textContent='THINGS THAT EXIST IN THE IN BETWEEN';
  shopTitle.textContent=col.name;
  render(filtered,catalogLive,`${filtered.length} PRODUCTS`);
  requestAnimationFrame(()=>$('#shop')?.scrollIntoView({behavior:'smooth',block:'start'}));
}
async function loadCatalog(){
  status.textContent='LOADING\u2026';
  try{const r=await fetch('/api/storefront/products');if(!r.ok)throw 0;const list=normalize(await r.json());if(!list.length)throw 0;allProducts=list;catalogLive=true;showAllProducts();}
  catch{allProducts=fallbackProducts;catalogLive=false;showAllProducts();}
}

grid.addEventListener('click',e=>{
  const sw=e.target.closest('.p-card-swatches .sw');
  if(sw){e.stopPropagation();const card=sw.closest('.p-card'),idx=+card.dataset.idx,p=products[idx];if(!p)return;
    card.querySelectorAll('.sw').forEach(s=>s.classList.remove('is-sel'));sw.classList.add('is-sel');
    const match=p.variants.find(v=>vSwatch(v)===sw.dataset.swatch);
    if(match){const img=vImg(match);if(img)card.querySelector('.p-card-img img').src=img;}
    card.dataset.selectedSwatch=sw.dataset.swatch;return;}
  const trigger=e.target.closest('[data-trigger="quick"]');
  if(trigger)openQuick(+trigger.dataset.index);
});
grid.addEventListener('keydown',e=>{const sw=e.target.closest('.p-card-swatches .sw');if(sw&&(e.key==='Enter'||e.key===' ')){e.preventDefault();sw.click();}});

function openQuick(i){
  const p=products[i];if(!p)return;
  window.__quickProduct=p;
  const card=grid.querySelector(`.p-card[data-idx="${i}"]`);
  window.__quickColorSwatch=card?.dataset.selectedSwatch||null;

  quickImage.src=p.image;quickImage.alt=p.name;
  quickName.textContent=p.name;
  quickDesc.textContent=p.copy;
  quickIndex.textContent='VAULTLINE';
  quickPrice.textContent=money(p.price,p.currency);
  if(quickColorLabel)quickColorLabel.textContent='';

  const thumbImgs=new Set();const thumbList=[];
  if(p.image){thumbImgs.add(p.image);thumbList.push(p.image);}
  for(const v of p.variants){const img=vImg(v);if(img&&!thumbImgs.has(img)){thumbImgs.add(img);thumbList.push(img);}}
  if(quickThumbs){
    quickThumbs.innerHTML=thumbList.slice(0,5).map((img,ti)=>
      `<button class="pd-thumb${ti===0?' is-sel':''}" data-thumb-src="${esc(img)}"><img src="${esc(img)}" alt="" loading="lazy"></button>`
    ).join('');
    quickThumbs.querySelectorAll('.pd-thumb').forEach(tb=>tb.onclick=()=>{
      quickThumbs.querySelectorAll('.pd-thumb').forEach(t=>t.classList.remove('is-sel'));
      tb.classList.add('is-sel');quickImage.src=tb.dataset.thumbSrc;
    });
  }

  quickSwatches.innerHTML=p.colors.map((c,ci)=>
    `<button type="button" class="sw" style="--sw:${esc(c)}" data-swatch="${esc(c)}" data-ci="${ci}" tabindex="0" aria-label="Color ${ci+1}"></button>`
  ).join('');

  if(p.variants.length){
    quickVariants.innerHTML=p.variants.map(v=>{
      const sz=vSize(v),cn=vColor(v),display=sz||(cn||'Default');
      return `<button type="button" class="sz" data-vid="${esc(v.id)}" data-color="${esc(cn)}" data-swatch="${esc(vSwatch(v))}" data-size="${esc(sz)}" ${ok(v)?'':'disabled'} aria-label="${esc(display)}">${esc(display)}</button>`;
    }).join('');
    quickBuy.textContent='ADD TO CART';quickBuy.dataset.mode='cart';
  }else{
    quickVariants.innerHTML='<span style="font-size:10px;color:#4e545e;letter-spacing:.1em">NOT AVAILABLE YET</span>';
    quickBuy.textContent='UNAVAILABLE';quickBuy.dataset.mode='unavailable';
  }
  const detailsEl=$('#pd-details-text');
  if(detailsEl)detailsEl.textContent=p.copy||'Premium Vaultline piece.';

  quick.classList.add('open');scrim.classList.add('open');
  quick.setAttribute('aria-hidden','false');document.body.classList.add('locked');
}
function closeQuick(){quick.classList.remove('open');quick.setAttribute('aria-hidden','true');if(!drawer.classList.contains('open'))scrim.classList.remove('open');document.body.classList.remove('locked');}

async function api(path,opt={}){const r=await fetch(path,{...opt,headers:{Accept:'application/json','Content-Type':'application/json',...(opt.headers||{})}});const body=await r.json().catch(()=>({}));if(!r.ok){const d=body.error||body.message||`Failed (${r.status})`;throw new Error(`${r.status}: ${d}`);}return body;}
async function ensureCart(){const id=localStorage.getItem(CART_KEY);if(id){try{return await api(`/api/cart/${encodeURIComponent(id)}`)}catch{localStorage.removeItem(CART_KEY)}}const cart=await api('/api/cart',{method:'POST',body:'{"items":[]}'});localStorage.setItem(CART_KEY,cart.id);return cart;}
function cartMath(cart){let count=0,total=0,currency='USD';for(const item of cart?.items||[]){const q=Number(item.quantity)||0,p=Number(item?.variant?.unitPrice?.value)||0;count+=q;total+=q*p;currency=item?.variant?.unitPrice?.currency||currency;}return{count,total,currency};}
function showCart(cart){const{count,total,currency}=cartMath(cart);cartCount.textContent=count;cartTotal.textContent=money(total,currency);checkout.disabled=!cart?.id||!count;const items=cart?.items||[];if(!items.length){cartItems.innerHTML='<p class="cart-empty">Your cart is empty.</p>';return;}
  cartItems.innerHTML=items.map(item=>{const v=item.variant||{},q=Number(item.quantity)||1,img=v.images?.[0]?.transformedUrl||v.images?.[0]?.url||'',lbl=[v?.attributes?.color?.name,v?.attributes?.size?.name].filter(Boolean).join(' / ')||v?.name||'';
    return`<article style="display:grid;grid-template-columns:60px 1fr;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.04)">${img?`<img src="${esc(img)}" style="width:60px;height:72px;object-fit:contain;background:#0f1114">`:''}<div><strong style="display:block;font-size:11px;letter-spacing:.04em">${esc(v?.product?.name||v.name||'Piece')}</strong><span style="display:block;margin-top:3px;font-size:9px;color:#7a8290;letter-spacing:.08em">${esc(lbl)}</span><div style="display:flex;gap:8px;align-items:center;margin-top:8px"><button data-a="dec" data-id="${esc(v.id)}" data-q="${q}" style="width:26px;height:26px;border:1px solid rgba(255,255,255,.1);background:none;color:#d6d6d6;font-size:14px;cursor:pointer">&minus;</button><span style="font-size:11px;min-width:16px;text-align:center">${q}</span><button data-a="inc" data-id="${esc(v.id)}" data-q="${q}" style="width:26px;height:26px;border:1px solid rgba(255,255,255,.1);background:none;color:#d6d6d6;font-size:14px;cursor:pointer">+</button><button data-a="remove" data-id="${esc(v.id)}" style="margin-left:auto;background:none;border:0;color:#7a8290;cursor:pointer;font-size:9px;letter-spacing:.12em">REMOVE</button></div></div></article>`;
  }).join('');cartItems.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>changeItem(b));}
async function refreshCart(){const id=localStorage.getItem(CART_KEY);if(!id)return showCart({items:[]});try{showCart(await api(`/api/cart/${encodeURIComponent(id)}`))}catch{localStorage.removeItem(CART_KEY);showCart({items:[]});}}
async function changeItem(b){const id=localStorage.getItem(CART_KEY),variantId=b.dataset.id,q=+b.dataset.q||1,a=b.dataset.a;if(!id)return;const remove=a==='remove'||(a==='dec'&&q<=1);const path=`/api/cart/${encodeURIComponent(id)}/${remove?'remove':'change'}`;const items=remove?[{variantId}]:[{variantId,quantity:a==='inc'?q+1:q-1}];showCart(await api(path,{method:'POST',body:JSON.stringify({items})}));}
async function addSelected(e){if(quickBuy.dataset.mode!=='cart')return;e.preventDefault();const selBtn=quickVariants.querySelector('.sz.is-sel');const variantId=selBtn?.dataset.vid;if(!variantId)return;quickBuy.textContent='ADDING\u2026';try{const cart=await ensureCart();const next=await api(`/api/cart/${encodeURIComponent(cart.id)}/add`,{method:'POST',body:JSON.stringify({items:[{variantId,quantity:1}]})});showCart(next);closeQuick();openCart();}catch(err){console.error('Cart error:',err);quickBuy.textContent='TRY AGAIN';quickBuy.dataset.mode='cart';}finally{if(quickBuy.dataset.mode==='cart'&&quickBuy.textContent==='ADDING\u2026')quickBuy.textContent='ADD TO CART';}}
function openCart(){drawer.classList.add('open');scrim.classList.add('open');drawer.setAttribute('aria-hidden','false');document.body.classList.add('locked');refreshCart();}
function closeCart(){drawer.classList.remove('open');drawer.setAttribute('aria-hidden','true');if(!quick.classList.contains('open'))scrim.classList.remove('open');document.body.classList.remove('locked');}
function closeMenu(){mobNav.classList.remove('open');menuToggle.setAttribute('aria-expanded','false');}

menuToggle.onclick=()=>{const o=mobNav.classList.toggle('open');menuToggle.setAttribute('aria-expanded',String(o));};
document.querySelectorAll('#site-nav a, #mob-nav a').forEach(a=>a.addEventListener('click',closeMenu));
document.querySelectorAll('[data-shop-all]').forEach(a=>a.addEventListener('click',()=>showAllProducts()));
document.querySelectorAll('[data-collection]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();showCollection(a.dataset.collection);}));
cartButton.onclick=()=>{closeMenu();openCart();};cartClose.onclick=closeCart;quickClose.onclick=closeQuick;quickBuy.onclick=addSelected;scrim.onclick=()=>{closeQuick();closeCart();};
$('#refresh-products').onclick=loadCatalog;
checkout.onclick=()=>{const id=localStorage.getItem(CART_KEY);if(id)location.assign(`${STORE_URL}/checkout/?cartId=${encodeURIComponent(id)}&cartCurrency=USD`);};
document.querySelectorAll('[data-feature-slug]').forEach(el=>el.onclick=()=>{const i=products.findIndex(p=>p.slug===el.dataset.featureSlug);const j=i<0?allProducts.findIndex(p=>p.slug===el.dataset.featureSlug):i;if(j>=0){if(i<0)products=allProducts;openQuick(i<0?j:i);}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeQuick();closeCart();closeMenu();}});
loadCatalog();refreshCart();
