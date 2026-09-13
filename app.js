const STORE_URL='https://vaultlineofficial.us';
const fallbackProducts=[
{name:'In Ruin We Trust Slides',slug:'in-ruin-we-trust-slides',price:36,image:'https://cdn.fourthwall.com/customizations/sh_0e0db572-47ce-453b-a747-142819f87a74/699ce60f-5fb4-4dcb-855a-74d3f865b6ee.png'},
{name:'White Sigil Rib Tank',slug:'white-sigil-rib-tank',price:25,image:'https://cdn.fourthwall.com/customizations/sh_0e0db572-47ce-453b-a747-142819f87a74/26b306d0-ab15-4974-9a9e-8729093d77d6.webp'},
{name:'Crimson Thorn Baby Tee',slug:'crimson-thorn-baby-tee-vaultline-by-gizzy-graves',price:37,image:'https://cdn.fourthwall.com/customizations/sh_0e0db572-47ce-453b-a747-142819f87a74/54978fa7-1209-4d1c-9283-ff4f848068a1.webp'},
{name:'Northern Fracture Hoodie',slug:'vaultline-northern-fracture-hoodie',price:62,image:'https://cdn.fourthwall.com/customizations/sh_0e0db572-47ce-453b-a747-142819f87a74/69a3a0b2-52a8-4383-954c-f7c5383ceef2.webp'},
{name:'Northern Thorn Cami',slug:'northern-thorn-cami-vaultline',price:25,image:'https://cdn.fourthwall.com/customizations/sh_0e0db572-47ce-453b-a747-142819f87a74/6099ed73-bac7-49c4-ac3d-514c6c67aca0.png'},
{name:'IXXI Vaultline Tee',slug:'ixxi-vaultline-tee',price:38,image:'https://cdn.fourthwall.com/offer/sh_0e0db572-47ce-453b-a747-142819f87a74/00db2ce5-1ceb-4aee-8ad5-673047373ab1.png'},
{name:'Half Butterfly Fracture Baby Tee',slug:'half-butterfly-fracture-baby-tee',price:38,image:'https://cdn.fourthwall.com/customizations/sh_0e0db572-47ce-453b-a747-142819f87a74/bbf26803-a430-4b71-af64-5167312caf82.webp'},
{name:'Vaultline Gift Card',slug:'vaultline-gift-card',price:25,image:'https://cdn.fourthwall.com/offer/sh_0e0db572-47ce-453b-a747-142819f87a74/c2f2de89-d029-47a8-8446-ab2cabd39270.png'}
];
const grid=document.querySelector('#product-grid');
const status=document.querySelector('#catalog-status');
const nav=document.querySelector('#site-nav');
const toggle=document.querySelector('.nav-toggle');
const drawer=document.querySelector('#cart-drawer');
const scrim=document.querySelector('#scrim');
const cartButton=document.querySelector('#cart-button');
const cartClose=document.querySelector('#cart-close');
const checkoutButton=document.querySelector('#checkout-button');
const cartItems=document.querySelector('#cart-items');

function money(value,currency='USD'){return new Intl.NumberFormat('en-US',{style:'currency',currency}).format(Number(value)||0)}
function normalizeProducts(payload){
  const list=Array.isArray(payload)?payload:(payload.products||payload.data||payload.items||[]);
  return list.map(p=>({
    name:p.name||p.title||'Vaultline piece',
    slug:p.slug||p.handle||p.id,
    price:p.price?.amount||p.price||p.variants?.[0]?.price?.amount||p.variants?.[0]?.price||0,
    currency:p.price?.currency||p.currency||p.variants?.[0]?.currency||'USD',
    image:p.primaryImageUrl||p.image?.url||p.images?.[0]?.url||p.images?.[0]||'',
    url:p.url||null
  })).filter(p=>p.name);
}
function renderProducts(products,live=false){
  grid.innerHTML=products.map(p=>`<article class="product-card" data-slug="${p.slug}">
    <a href="${p.url||`${STORE_URL}/products/${p.slug}`}" aria-label="View ${p.name}">
      <div class="product-image">${p.image?`<img src="${p.image}" alt="${p.name}" loading="lazy">`:''}</div>
      <div class="product-meta"><div class="product-name">${p.name}</div><div class="product-price">From ${money(p.price,p.currency||'USD')}</div></div>
    </a>
  </article>`).join('');
  status.textContent=live?'Live catalog connected through Fourthwall.':'Showing current Vaultline products. Headless API connection is ready for its token.';
}
async function loadCatalog(){
  status.textContent='Loading live Fourthwall catalog…';
  try{
    const res=await fetch('/api/storefront/products',{headers:{Accept:'application/json'}});
    if(!res.ok) throw new Error(`API ${res.status}`);
    const data=await res.json();
    const products=normalizeProducts(data);
    if(!products.length) throw new Error('No products returned');
    renderProducts(products,true);
  }catch(err){renderProducts(fallbackProducts,false)}
}
function openCart(){drawer.classList.add('open');scrim.classList.add('open');drawer.setAttribute('aria-hidden','false');cartItems.innerHTML='<p class="cart-empty">The cart UI is staged. Once the Fourthwall Storefront token is added in Cloudflare, cart creation and checkout redirect can be enabled without exposing the token.</p>'}
function closeCart(){drawer.classList.remove('open');scrim.classList.remove('open');drawer.setAttribute('aria-hidden','true')}
toggle.addEventListener('click',()=>{const isOpen=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(isOpen))});
cartButton.addEventListener('click',openCart);cartClose.addEventListener('click',closeCart);scrim.addEventListener('click',closeCart);
document.querySelector('#refresh-products').addEventListener('click',loadCatalog);
checkoutButton.addEventListener('click',()=>window.location.assign(STORE_URL));
loadCatalog();
