const API_BASE = 'https://storefront-api.fourthwall.com/v1';
const FOURTHWALL_SITE = 'https://vaultlineofficial-shop.fourthwall.com';
const YOYCOL_BASE = 'https://www.yoycol.com';
const YOYCOL_V4 = '/api/2025/open/v4';
const YOYCOL_OK = '100000';

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

function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function randomHex(byteLength = 16) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function cleanYoycolParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [String(key), String(value)])
      .sort(([a], [b]) => a.localeCompare(b))
  );
}

async function yoycolSignature(secretKey, signatureData) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return bytesToBase64(await crypto.subtle.sign('HMAC', key, encoder.encode(signatureData)));
}

async function yoycolGet(path, env, params = {}) {
  const accessKey = String(env.YOYCOL_ACCESS_KEY || '').trim();
  const secretKey = String(env.YOYCOL_SECRET_KEY || '').trim();
  if (!accessKey || !secretKey) {
    return { error: json({ error: 'Yoycol API credentials are not configured on this Worker.' }, 503) };
  }

  const safePath = String(path || '');
  if (!safePath.startsWith('/') || safePath.includes('..')) {
    return { error: json({ error: 'Invalid Yoycol API path.' }, 400) };
  }

  const fullPath = YOYCOL_V4 + safePath;
  const timestamp = String(Date.now());
  const nonce = randomHex(16);
  const algorithm = 'HmacSHA256';
  const version = '4.0';
  const sortedParams = cleanYoycolParams(params);
  const paramString = Object.entries(sortedParams)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const signatureLines = [
    'method=GET',
    `path=${fullPath}`,
    `timestamp=${timestamp}`,
    `nonce=${nonce}`,
    `accessKey=${accessKey}`,
    `algorithm=${algorithm}`,
    `version=${version}`
  ];
  if (paramString) signatureLines.push(`params=${paramString}`);

  const signature = await yoycolSignature(secretKey, signatureLines.join('\n'));
  const upstream = new URL(fullPath, YOYCOL_BASE);
  for (const [key, value] of Object.entries(sortedParams)) upstream.searchParams.set(key, value);

  try {
    const response = await fetch(upstream.toString(), {
      method: 'GET',
      headers: {
        'X-API-Access-Key': accessKey,
        'X-API-Timestamp': timestamp,
        'X-API-Nonce': nonce,
        'X-API-Algorithm': algorithm,
        'X-API-Version': version,
        'X-API-Signature': signature,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      return { error: json({ error: `Yoycol returned a non-JSON response (${response.status}).` }, 502) };
    }

    if (!response.ok) {
      return {
        error: json({
          error: payload?.msg || payload?.message || `Yoycol request failed (${response.status}).`,
          upstreamStatus: response.status
        }, 502)
      };
    }

    if (String(payload?.code || '') !== YOYCOL_OK) {
      return {
        error: json({
          error: payload?.msg || payload?.message || 'Yoycol rejected the API request.',
          code: payload?.code || null
        }, 502)
      };
    }

    return { payload };
  } catch (error) {
    return { error: json({ error: `Yoycol request failed: ${error?.message || 'unknown network error'}` }, 502) };
  }
}

async function yoycolStatus(env) {
  const result = await yoycolGet('/catalog/products', env, { page: 1, size: 1 });
  if (result.error) return result.error;
  return json({
    connected: true,
    provider: 'Yoycol',
    apiVersion: '4.0',
    credentials: 'configured'
  });
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

    if (url.pathname === '/' || url.pathname === '/shop' || url.pathname === '/collections' || url.pathname === '/lookbook' || /^\/collections\/[a-z0-9-]+\/?$/i.test(url.pathname) || /^\/products\/[^/]+\/?$/.test(url.pathname)) return serveAssetRoot(request, env);

    if (url.pathname === '/api/yoycol/status') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      return yoycolStatus(env);
    }

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
