const API_BASE='https://storefront-api.fourthwall.com/v1';

function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
  });
}

function cartTarget(pathname){
  if(pathname==='/api/cart')return `${API_BASE}/carts`;
  const match=pathname.match(/^\/api\/cart\/([^/]+)(?:\/(add|remove|change))?$/);
  if(!match)return null;
  const id=decodeURIComponent(match[1]);
  const action=match[2];
  return `${API_BASE}/carts/${encodeURIComponent(id)}${action?`/${action}`:''}`;
}

function mapProduct(product){
  const variants=Array.isArray(product.variants)?product.variants:[];
  return {
    id:product.id,
    name:product.name,
    slug:product.slug,
    description:product.description||'',
    price:variants[0]?.unitPrice?.value||0,
    currency:variants[0]?.unitPrice?.currency||'USD',
    primaryImageUrl:product.images?.[0]?.transformedUrl||product.images?.[0]?.url||'',
    variants
  };
}

async function fourthwallFetch(target,token,init={}){
  const upstream=new URL(target);
  upstream.searchParams.set('storefront_token',token);
  const response=await fetch(upstream.toString(),init);
  const text=await response.text();
  if(!response.ok){
    let message=`Fourthwall request failed (${response.status}).`;
    try{
      const parsed=JSON.parse(text);
      message=parsed?.message||parsed?.error?.message||parsed?.error||message;
    }catch{}
    return {error:json({error:String(message),status:response.status},response.status)};
  }
  return {response,text};
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    const token=String(env.FOURTHWALL_STOREFRONT_TOKEN||'').trim();

    if(url.pathname==='/api/storefront/products'){
      if(request.method.toUpperCase()!=='GET')return json({error:'Method not allowed'},405);
      if(!token)return json({error:'Fourthwall Storefront token is not configured on this Worker.'},503);
      try{
        const target=new URL(`${API_BASE}/collections/all/products`);
        target.searchParams.set('currency','USD');
        target.searchParams.set('limit','100');
        const result=await fourthwallFetch(target.toString(),token,{method:'GET',headers:{Accept:'application/json'}});
        if(result.error)return result.error;
        const payload=JSON.parse(result.text||'{}');
        return json({products:(payload.results||[]).map(mapProduct)});
      }catch(error){
        return json({error:`Fourthwall catalog request failed: ${error?.message||'unknown network error'}`},502);
      }
    }

    const target=cartTarget(url.pathname);
    if(!target)return env.ASSETS.fetch(request);
    if(!token)return json({error:'Fourthwall Storefront token is not configured on this Worker.'},503);

    const method=request.method.toUpperCase();
    const create=url.pathname==='/api/cart';
    const action=/\/(add|remove|change)$/.test(url.pathname);
    if((create||action)&&method!=='POST')return json({error:'Method not allowed'},405);
    if(!create&&!action&&method!=='GET')return json({error:'Method not allowed'},405);

    const upstream=new URL(target);
    if(method==='GET')upstream.searchParams.set('currency','USD');
    const init={method,headers:{Accept:'application/json'}};
    if(method==='POST'){
      init.headers['Content-Type']='application/json';
      init.body=await request.text()||'{}';
    }

    try{
      const result=await fourthwallFetch(upstream.toString(),token,init);
      if(result.error)return result.error;
      return new Response(result.text,{status:result.response.status,headers:{'content-type':result.response.headers.get('content-type')||'application/json; charset=utf-8','cache-control':'no-store'}});
    }catch(error){
      return json({error:`Fourthwall Storefront API request failed: ${error?.message||'unknown network error'}`},502);
    }
  }
};
