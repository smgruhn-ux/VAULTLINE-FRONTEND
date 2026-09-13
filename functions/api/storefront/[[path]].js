export async function onRequest(context){
  const {request,env,params}=context;
  const base=(env.FOURTHWALL_STOREFRONT_API_BASE||'').replace(/\/$/,'');
  const token=env.FOURTHWALL_STOREFRONT_TOKEN;
  if(!base||!token){
    return Response.json({error:'Fourthwall headless credentials are not configured yet.'},{status:503});
  }
  const path=Array.isArray(params.path)?params.path.join('/'):String(params.path||'');
  const incoming=new URL(request.url);
  const target=new URL(`${base}/${path}`);
  target.search=incoming.search;
  const headers=new Headers(request.headers);
  headers.set('Authorization',`Bearer ${token}`);
  headers.set('Accept','application/json');
  headers.delete('host');
  const init={method:request.method,headers,redirect:'manual'};
  if(!['GET','HEAD'].includes(request.method)) init.body=request.body;
  try{
    const upstream=await fetch(target.toString(),init);
    const outHeaders=new Headers(upstream.headers);
    outHeaders.set('Cache-Control',request.method==='GET'?'public, max-age=60':'no-store');
    return new Response(upstream.body,{status:upstream.status,headers:outHeaders});
  }catch(error){
    return Response.json({error:'Fourthwall Storefront API request failed.'},{status:502});
  }
}
