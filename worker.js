const API_BASE = 'https://storefront-api.fourthwall.com/v1';
const FOURTHWALL_SITE = 'https://vaultlineofficial-shop.fourthwall.com';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function imageUrl(image) {
  return image?.transformedUrl || image?.url || '';
}

function uniqueImages(images) {
  const seen = new Set();
  return (images || []).filter((image) => {
    const url = imageUrl(image);
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

function mapProduct(product) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const images = uniqueImages([
    ...(Array.isArray(product.images) ? product.images : []),
    ...variants.flatMap((variant) => Array.isArray(variant.images) ? variant.images : [])
  ]);
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description || '',
    price: variants[0]?.unitPrice?.value || 0,
    currency: variants[0]?.unitPrice?.currency || 'USD',
    primaryImageUrl: imageUrl(images[0]),
    images,
    variants
  };
}

function cartTarget(pathname) {
  if (pathname === '/api/cart') return `${API_BASE}/carts`;
  const match = pathname.match(/^\/api\/cart\/([^/]+)(?:\/(add|remove|change))?$/);
  if (!match) return null;
  const id = decodeURIComponent(match[1]);
  return `${API_BASE}/carts/${encodeURIComponent(id)}${match[2] ? `/${match[2]}` : ''}`;
}

async function fourthwallFetch(target, token, init = {}) {
  const upstream = new URL(target);
  upstream.searchParams.set('storefront_token', token);
  const response = await fetch(upstream.toString(), init);
  const text = await response.text();
  if (!response.ok) {
    let message = `Fourthwall request failed (${response.status}).`;
    try {
      const payload = JSON.parse(text);
      message = payload?.message || payload?.error?.message || payload?.error || message;
    } catch {}
    return { error: json({ error: String(message), status: response.status }, response.status) };
  }
  return { response, text };
}

async function storefrontProducts(collectionSlug, token) {
  const safe = String(collectionSlug || '').trim();
  if (!/^[a-z0-9-]+$/i.test(safe)) return json({ error: 'Invalid collection slug' }, 400);
  try {
    const products = [];
    const seen = new Set();
    let page = 0;
    let hasNextPage = true;
    const pageSize = 100;

    while (hasNextPage && page < 100) {
      const target = new URL(`${API_BASE}/collections/${encodeURIComponent(safe)}/products`);
      target.searchParams.set('currency', 'USD');
      target.searchParams.set('page', String(page));
      target.searchParams.set('size', String(pageSize));

      const result = await fourthwallFetch(target.toString(), token, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });
      if (result.error) return result.error;

      const payload = JSON.parse(result.text || '{}');
      const pageProducts = Array.isArray(payload) ? payload : (payload.results || payload.products || []);
      for (const product of pageProducts) {
        if (!product?.id || seen.has(product.id)) continue;
        seen.add(product.id);
        products.push(mapProduct(product));
      }

      const paging = payload?.paging;
      if (!paging) {
        hasNextPage = false;
      } else {
        hasNextPage = Boolean(
          paging.hasNextPage ??
          (Number(paging.pageNumber ?? page) + 1 < Number(paging.totalPages ?? 0))
        );
        page = Number(paging.pageNumber ?? page) + 1;
      }
    }

    return json({ collection: safe, products });
  } catch (error) {
    return json({ error: `Fourthwall catalog request failed: ${error?.message || 'unknown network error'}` }, 502);
  }
}

async function serveAssetOrFourthwall(request, env) {
  const assetResponse = await env.ASSETS.fetch(request);
  if (assetResponse.status !== 404) return assetResponse;

  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return assetResponse;

  // Fourthwall still uses vaultlineofficial.us as the shop's primary domain
  // for customer-system links (order management, contact, tracking, etc.).
  // Those routes do not exist in this custom frontend, so hand only missing
  // routes back to the shop's internal Fourthwall domain while preserving
  // the full path and signed query string.
  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, FOURTHWALL_SITE);
  return Response.redirect(target.toString(), 302);
}

async function serveAssetRoot(request, env) {
  const assetRequest = new Request(new URL('/index.html', request.url), request);
  const response = await env.ASSETS.fetch(assetRequest);
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('x-vaultline-root', 'asset-index-v3');
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const token = String(env.FOURTHWALL_STOREFRONT_TOKEN || '').trim();

    if (url.pathname === '/' || /^\/products\/[^/]+\/?$/.test(url.pathname)) return serveAssetRoot(request, env);

    if (url.pathname === '/api/storefront/products') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      if (!token) return json({ error: 'Fourthwall Storefront token is not configured on this Worker.' }, 503);
      return storefrontProducts('all', token);
    }

    const collectionMatch = url.pathname.match(/^\/api\/storefront\/collections\/([a-z0-9-]+)\/products$/i);
    if (collectionMatch) {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      if (!token) return json({ error: 'Fourthwall Storefront token is not configured on this Worker.' }, 503);
      return storefrontProducts(collectionMatch[1], token);
    }

    const target = cartTarget(url.pathname);
    if (!target) return serveAssetOrFourthwall(request, env);
    if (!token) return json({ error: 'Fourthwall Storefront token is not configured on this Worker.' }, 503);

    const method = request.method.toUpperCase();
    const create = url.pathname === '/api/cart';
    const action = /\/(add|remove|change)$/.test(url.pathname);
    if ((create || action) && method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (!create && !action && method !== 'GET') return json({ error: 'Method not allowed' }, 405);

    const upstream = new URL(target);
    if (method === 'GET') upstream.searchParams.set('currency', 'USD');
    const init = { method, headers: { Accept: 'application/json' } };
    if (method === 'POST') {
      init.headers['Content-Type'] = 'application/json';
      init.body = await request.text() || '{}';
    }

    const result = await fourthwallFetch(upstream.toString(), token, init);
    if (result.error) return result.error;
    return new Response(result.text, {
      status: result.response.status,
      headers: {
        'content-type': result.response.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store'
      }
    });
  }
};
