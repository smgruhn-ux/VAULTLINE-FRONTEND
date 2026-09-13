const API_BASE='https://storefront-api.fourthwall.com/v1';

function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
  });
}

function upstreamFor(pathname){
  if(pathname==='/api/cart')return `${API_BASE}/carts`;
  const match=pathname.match(/^\/api\/cart\/([^/]+)(?:\/(add|remove|change))?$/);
  if(!match)return null;
  const id=decodeURIComponent(match[1]);
  const action=match[2];
  return `${API_BASE}/carts/${encodeURIComponent(id)}${action?`/${action}`:''}`;
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    const target=upstreamFor(url.pathname);
    if(!target)return env.ASSETS.fetch(request);

    const token=String(env.FOURTHWALL_STOREFRONT_TOKEN||'').trim();
    if(!token)return json({error:'Fourthwall Storefront token is not configured on this Worker.'},503);

    const method=request.method.toUpperCase();
    const create=url.pathname==='/api/cart';
    const action=/\/(add|remove|change)$/.test(url.pathname);
    if((create||action)&&method!=='POST')return json({error:'Method not allowed'},405);
    if(!create&&!action&&method!=='GET')return json({error:'Method not allowed'},405);

    const upstream=new URL(target);
    if(method==='GET')upstream.searchParams.set('currency','USD');

    const init={
      method,
      headers:{
        Accept:'application/json',
        Authorization:`Bearer ${token}`
      }
    };

    if(method==='POST'){
      init.headers['Content-Type']='application/json';
      init.body=await request.text()||'{}';
    }

    try{
      const response=await fetch(upstream.toString(),init);
      const text=await response.text();
      if(!response.ok){
        let message=`Fourthwall cart request failed (${response.status}).`;
        try{
          const parsed=JSON.parse(text);
          message=parsed?.message||parsed?.error?.message||parsed?.error||message;
        }catch{}
        return json({error:String(message),status:response.status},response.status);
      }
      return new Response(text,{
        status:response.status,
        headers:{
          'content-type':response.headers.get('content-type')||'application/json; charset=utf-8',
          'cache-control':'no-store'
        }
      });
    }catch(error){
      return json({error:`Fourthwall Storefront API request failed: ${error?.message||'unknown network error'}`},502);
    }
  }
};
