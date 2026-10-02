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

function yoycolArray(payload) {
  const direct = [
    payload?.data?.items, payload?.data?.results, payload?.data?.list, payload?.data?.records,
    payload?.data?.productTemplates, payload?.data?.product_templates, payload?.data?.templates,
    payload?.items, payload?.results, payload?.list, payload?.records,
    payload?.productTemplates, payload?.product_templates, payload?.templates, payload?.data
  ].find(Array.isArray);
  if (direct) return direct;

  const arrays = [];
  const visit = (value, depth = 0) => {
    if (!value || depth > 6) return;
    if (Array.isArray(value)) {
      if (value.length) arrays.push(value);
      for (const item of value.slice(0, 5)) visit(item, depth + 1);
      return;
    }
    if (typeof value === 'object') {
      for (const child of Object.values(value)) visit(child, depth + 1);
    }
  };
  visit(payload);

  const score = (arr) => {
    const sample = arr.slice(0, 5).filter((x) => x && typeof x === 'object');
    let points = sample.length * 2;
    for (const row of sample) {
      const keys = Object.keys(row).join(' ').toLowerCase();
      if (/template|design/.test(keys)) points += 8;
      if (/mockup|preview|image/.test(keys)) points += 5;
      if (/product|spu|sku/.test(keys)) points += 4;
      if (/name|title/.test(keys)) points += 2;
      if (/(^|\s)id(\s|$)|code|no/.test(keys)) points += 2;
    }
    return points;
  };

  return arrays.sort((a, b) => score(b) - score(a))[0] || [];
}

function yoycolString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function yoycolNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
  }
  return 0;
}

function yoycolImageUrls(value, out = [], depth = 0) {
  if (!value || out.length >= 40 || depth > 7) return out;
  if (typeof value === 'string') {
    const candidate = value.trim();
    if (
      /^https?:\/\//i.test(candidate) &&
      (
        /\.(?:png|jpe?g|webp|gif)(?:\?|#|$)/i.test(candidate) ||
        /image|img|mockup|preview|thumbnail|thumb|render|cdn|cloud\.yoycol/i.test(candidate)
      )
    ) out.push(candidate);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) yoycolImageUrls(item, out, depth + 1);
    return out;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (
        typeof child === 'string' &&
        /image|img|mockup|preview|thumbnail|thumb|render|cover|photo|url|src/i.test(key) &&
        /^https?:\/\//i.test(child.trim())
      ) out.push(child.trim());
    }
    for (const child of Object.values(value)) yoycolImageUrls(child, out, depth + 1);
  }
  return out;
}

function yoycolVariantAttributes(variant = {}) {
  const size = yoycolString(variant?.size, variant?.sizeName, variant?.size_name, variant?.attributes?.size?.name);
  const color = yoycolString(variant?.color, variant?.colorName, variant?.color_name, variant?.attributes?.color?.name);
  const swatch = yoycolString(variant?.colorHex, variant?.color_hex, variant?.hex, variant?.attributes?.color?.swatch);
  const attributes = {};
  if (size) attributes.size = { name: size };
  if (color || swatch) attributes.color = { name: color || 'Color', swatch: swatch || '#151515' };
  return attributes;
}

function mapYoycolTemplate(template = {}) {
  const rawId = yoycolString(template.id, template.templateId, template.template_id, template.templateNo, template.template_no, template.templateCode, template.template_code, template.designId, template.design_id, template.designNo, template.design_no, template.code, template.uuid);
  if (!rawId) return null;

  const rawVariants = Array.isArray(template.variants)
    ? template.variants
    : (Array.isArray(template.variantList) ? template.variantList
      : (Array.isArray(template.variant_list) ? template.variant_list
        : (Array.isArray(template.skus) ? template.skus
          : (Array.isArray(template.skuList) ? template.skuList
            : (Array.isArray(template.sku_list) ? template.sku_list : [])))));

  const images = [...new Set(yoycolImageUrls(template))].slice(0, 18);
  const price = yoycolNumber(
    template.retailPrice, template.retail_price, template.salePrice, template.sale_price,
    template.price, template.sellPrice, template.sell_price, template.sellingPrice, template.selling_price,
    template.priceInfo?.retailPrice, template.price_info?.retail_price,
    rawVariants[0]?.retailPrice, rawVariants[0]?.retail_price, rawVariants[0]?.salePrice, rawVariants[0]?.sale_price, rawVariants[0]?.price
  );

  let variants = rawVariants.slice(0, 100).map((variant, index) => ({
    id: 'yoycol:' + rawId + ':' + yoycolString(variant.id, variant.variantId, variant.variant_id, variant.sku, index),
    unitPrice: { value: yoycolNumber(variant.retailPrice, variant.retail_price, variant.price, price), currency: 'USD' },
    attributes: yoycolVariantAttributes(variant),
    images: yoycolImageUrls(variant).slice(0, 4).map((url) => ({ url })),
    provider: 'yoycol'
  }));
  if (!variants.length && price > 0) {
    variants = [{
      id: 'yoycol:' + rawId + ':default',
      unitPrice: { value: price, currency: 'USD' },
      attributes: {},
      images: images.slice(0, 4).map((url) => ({ url })),
      provider: 'yoycol'
    }];
  }

  return {
    id: 'yoycol:' + rawId,
    provider: 'yoycol',
    providerId: rawId,
    purchasable: price > 0 && variants.length > 0,
    name: yoycolString(template.name, template.title, template.designName, template.design_name, template.templateName, template.template_name, template.productName, template.product_name, template.spuName, template.spu_name) || 'Vaultline Yoycol piece',
    slug: ('yoycol-' + rawId).replace(/[^A-Za-z0-9_-]/g, '-'),
    description: yoycolString(template.description, template.desc, template.productDescription, template.product_description, template.templateDescription, template.template_description),
    price,
    currency: 'USD',
    primaryImageUrl: images[0] || '',
    images: images.map((url) => ({ url })),
    variants
  };
}

async function yoycolDiagnostics(env) {
  const result = await yoycolGet('/product_templates', env, { page: 1, size: 10 });
  if (result.error) {
    let details = {};
    try { details = await result.error.clone().json(); } catch {}
    return json({
      ok: false,
      endpoint: '/product_templates',
      error: details?.error || 'Template API request failed.',
      code: details?.code || null,
      upstreamStatus: details?.upstreamStatus || null
    }, 200);
  }

  const rows = yoycolArray(result.payload);
  const samples = rows.slice(0, 5).map((row) => {
    const mapped = mapYoycolTemplate(row);
    return {
      keys: Object.keys(row || {}).slice(0, 40),
      id: mapped?.providerId || null,
      name: mapped?.name || null,
      imageCount: mapped?.images?.length || 0,
      variantCount: mapped?.variants?.length || 0,
      price: mapped?.price || 0
    };
  });

  return json({
    ok: true,
    endpoint: '/product_templates',
    rawTopLevelKeys: Object.keys(result.payload || {}),
    rowCount: rows.length,
    samples
  });
}

async function yoycolStorefrontProducts(url, env) {
  const requestedSize = Math.max(1, Math.min(50, Number.parseInt(url.searchParams.get('size') || '50', 10) || 50));
  const products = [];
  const seen = new Set();

  for (let page = 1; page <= 10; page += 1) {
    const result = await yoycolGet('/product_templates', env, { page, size: requestedSize });
    if (result.error) return result.error;

    const rows = yoycolArray(result.payload);
    for (const row of rows) {
      const mapped = mapYoycolTemplate(row);
      if (!mapped?.id || seen.has(mapped.id)) continue;
      seen.add(mapped.id);
      products.push(mapped);
    }

    if (rows.length < requestedSize) break;
  }

  return json({
    provider: 'yoycol',
    previewOnly: false,
    products
  });
}


function safeQuantity(value) {
  return Math.max(1, Math.min(10, Number.parseInt(String(value || '1'), 10) || 1));
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function loadYoycolTemplates(env) {
  const products = [];
  const seen = new Set();
  const size = 50;
  for (let page = 1; page <= 10; page += 1) {
    const result = await yoycolGet('/product_templates', env, { page, size });
    if (result.error) return result;
    const rows = yoycolArray(result.payload);
    for (const row of rows) {
      const mapped = mapYoycolTemplate(row);
      if (!mapped?.providerId || seen.has(mapped.providerId)) continue;
      seen.add(mapped.providerId);
      products.push(mapped);
    }
    if (rows.length < size) break;
  }
  return { products };
}

async function resolveYoycolCheckout(items, env) {
  if (!Array.isArray(items) || !items.length || items.length > 20) {
    return { error: json({ error: 'Your Yoycol cart is empty or invalid.' }, 400) };
  }
  const loaded = await loadYoycolTemplates(env);
  if (loaded.error) return loaded;

  const resolved = [];
  for (const incoming of items) {
    const providerId = yoycolString(incoming?.providerId);
    const variantId = yoycolString(incoming?.variantId);
    const quantity = safeQuantity(incoming?.quantity);
    const product = loaded.products.find((p) => p.providerId === providerId);
    if (!product || !product.purchasable) {
      return { error: json({ error: 'One of the Yoycol products is no longer available for checkout.' }, 409) };
    }
    const variant = product.variants.find((v) => v.id === variantId) || product.variants[0];
    const unit = Number(variant?.unitPrice?.value || product.price || 0);
    if (!Number.isFinite(unit) || unit <= 0) {
      return { error: json({ error: 'One of the Yoycol products does not have a valid retail price.' }, 409) };
    }
    resolved.push({
      providerId,
      variantId: variant.id,
      name: product.name,
      image: product.primaryImageUrl || '',
      quantity,
      unitPrice: Math.round(unit * 100) / 100,
      currency: 'USD',
      attributes: variant.attributes || {}
    });
  }
  const total = Math.round(resolved.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) * 100) / 100;
  return { items: resolved, total, currency: 'USD' };
}

function paymentConfig(env) {
  const paypalClientId = String(env.PAYPAL_CLIENT_ID || '').trim();
  return {
    fulfillmentMode: 'manual_after_settlement',
    paypal: Boolean(paypalClientId && String(env.PAYPAL_CLIENT_SECRET || '').trim()),
    paypalClientId: paypalClientId || null,
    paypalMode: String(env.PAYPAL_MODE || 'live').toLowerCase() === 'sandbox' ? 'sandbox' : 'live'
  };
}

async function paypalAccessToken(env) {
  const clientId = String(env.PAYPAL_CLIENT_ID || '').trim();
  const secret = String(env.PAYPAL_CLIENT_SECRET || '').trim();
  if (!clientId || !secret) return { error: json({ error: 'PayPal is not configured.' }, 503) };
  const mode = String(env.PAYPAL_MODE || 'live').toLowerCase() === 'sandbox' ? 'sandbox' : 'live';
  const base = mode === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
  const credentials = btoa(clientId + ':' + secret);
  const response = await fetch(base + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + credentials,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    return { error: json({ error: 'PayPal authentication failed.' }, 502) };
  }
  return { token: payload.access_token, base };
}

async function paypalCreateOrder(request, env) {
  const body = await readJsonBody(request);
  const checkout = await resolveYoycolCheckout(body?.items, env);
  if (checkout.error) return checkout.error;
  const auth = await paypalAccessToken(env);
  if (auth.error) return auth.error;

  const itemTotal = checkout.total.toFixed(2);
  const response = await fetch(auth.base + '/v2/checkout/orders', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + auth.token,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': 'vaultline-' + randomHex(12)
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        description: 'Vaultline by Gizzy Graves — Yoycol fulfillment',
        custom_id: 'VAULTLINE-YOYCOL-HOLD',
        amount: {
          currency_code: 'USD',
          value: itemTotal,
          breakdown: { item_total: { currency_code: 'USD', value: itemTotal } }
        },
        items: checkout.items.map((item) => ({
          name: item.name.slice(0, 120),
          quantity: String(item.quantity),
          unit_amount: { currency_code: 'USD', value: item.unitPrice.toFixed(2) },
          category: 'PHYSICAL_GOODS',
          sku: (item.providerId + ':' + item.variantId).slice(0, 127)
        }))
      }],
      application_context: {
        brand_name: 'Vaultline by Gizzy Graves',
        shipping_preference: 'GET_FROM_FILE',
        user_action: 'PAY_NOW',
        return_url: 'https://vaultlineofficial.us/order-received.html?provider=paypal',
        cancel_url: 'https://vaultlineofficial.us/yoycol-checkout.html?cancelled=1'
      }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.id) return json({ error: payload?.message || 'PayPal order creation failed.' }, 502);
  return json({ id: payload.id, total: checkout.total, currency: checkout.currency });
}

async function paypalCaptureOrder(request, env) {
  const body = await readJsonBody(request);
  const orderId = yoycolString(body?.orderId);
  if (!/^[A-Z0-9]+$/i.test(orderId)) return json({ error: 'Invalid PayPal order ID.' }, 400);
  const auth = await paypalAccessToken(env);
  if (auth.error) return auth.error;
  const response = await fetch(auth.base + '/v2/checkout/orders/' + encodeURIComponent(orderId) + '/capture', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + auth.token,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': 'vaultline-capture-' + orderId
    },
    body: '{}'
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return json({ error: payload?.message || 'PayPal capture failed.' }, 502);
  const paid = payload?.status === 'COMPLETED';
  return json({
    paid,
    status: payload?.status || null,
    orderId: payload?.id || orderId,
    fulfillmentStatus: paid ? 'PAID_AWAITING_MANUAL_PRODUCTION' : 'PAYMENT_NOT_COMPLETED'
  }, paid ? 200 : 409);
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

    if (url.pathname === '/api/yoycol/products') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      return yoycolStorefrontProducts(url, env);
    }

    if (url.pathname === '/api/yoycol/diagnostics') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      return yoycolDiagnostics(env);
    }

    if (url.pathname === '/api/payments/config') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      return json(paymentConfig(env));
    }

    if (url.pathname === '/api/payments/paypal/create-order') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      return paypalCreateOrder(request, env);
    }

    if (url.pathname === '/api/payments/paypal/capture-order') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      return paypalCaptureOrder(request, env);
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
