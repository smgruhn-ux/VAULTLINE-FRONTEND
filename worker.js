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
  const size = yoycolString(
    variant?.size, variant?.SIZE, variant?.sizeName, variant?.SIZENAME, variant?.size_name,
    variant?.attributes?.size?.name
  );
  const color = yoycolString(
    variant?.color, variant?.COLOR, variant?.colorName, variant?.COLORNAME, variant?.color_name,
    variant?.attributes?.color?.name
  );
  const swatch = yoycolString(
    variant?.colorHex, variant?.COLORHEX, variant?.color_hex, variant?.hex, variant?.HEX,
    variant?.attributes?.color?.swatch
  );
  const attributes = {};
  if (size) attributes.size = { name: size };
  if (color || swatch) attributes.color = { name: color || 'Color', swatch: swatch || '#151515' };
  return attributes;
}

function yoycolTemplateMeta(template = {}) {
  return {
    rawId: yoycolString(
      template.id, template.ID, template.templateId, template.TEMPLATEID, template.template_id,
      template.templateNo, template.TEMPLATENO, template.template_no, template.templateCode,
      template.TEMPLATECODE, template.template_code, template.designId, template.DESIGNID,
      template.design_id, template.designNo, template.DESIGNNO, template.design_no,
      template.code, template.CODE, template.uuid, template.UUID
    ),
    designCode: yoycolString(
      template.designCode, template.DESIGNCODE, template.design_code, template.code, template.CODE
    ),
    productId: yoycolString(
      template.productId, template.PRODUCTID, template.product_id, template.spuId, template.SPUID,
      template.spu_id
    ),
    designName: yoycolString(
      template.designName, template.DESIGNNAME, template.design_name, template.name, template.NAME,
      template.title, template.TITLE, template.templateName, template.TEMPLATENAME, template.template_name
    ),
    productName: yoycolString(
      template.productName, template.PRODUCTNAME, template.product_name, template.spuName,
      template.SPUNAME, template.spu_name
    ),
    previewImage: yoycolString(
      template.previewImage, template.PREVIEWIMAGE, template.preview_image, template.mockupUrl,
      template.MOCKUPURL, template.imageUrl, template.IMAGEURL
    )
  };
}

function yoycolPriceOverrides(env) {
  const raw = String(env.YOYCOL_PRICE_OVERRIDES || '').trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function yoycolRetailPrice(template, env) {
  const meta = yoycolTemplateMeta(template);
  const overrides = yoycolPriceOverrides(env);
  const override = yoycolNumber(
    overrides[meta.rawId],
    overrides[meta.designCode],
    overrides[meta.productId]
  );
  if (override > 0) return override;

  return yoycolNumber(
    template.retailPrice, template.RETAILPRICE, template.retail_price,
    template.salePrice, template.SALEPRICE, template.sale_price,
    template.sellPrice, template.SELLPRICE, template.sell_price,
    template.sellingPrice, template.SELLINGPRICE, template.selling_price,
    template.priceInfo?.retailPrice, template.price_info?.retail_price
  );
}

function yoycolRawVariants(template = {}) {
  return Array.isArray(template.variants) ? template.variants
    : (Array.isArray(template.VARIANTS) ? template.VARIANTS
      : (Array.isArray(template.variantList) ? template.variantList
        : (Array.isArray(template.VARIANTLIST) ? template.VARIANTLIST
          : (Array.isArray(template.variant_list) ? template.variant_list
            : (Array.isArray(template.skus) ? template.skus
              : (Array.isArray(template.SKUS) ? template.SKUS
                : (Array.isArray(template.skuList) ? template.skuList
                  : (Array.isArray(template.SKULIST) ? template.SKULIST
                    : (Array.isArray(template.sku_list) ? template.sku_list : [])))))))));
}

function mapYoycolVariant(rawId, variant, index, retailPrice, fallbackImages = []) {
  const rawVariantId = yoycolString(
    variant?.id, variant?.ID, variant?.variantId, variant?.VARIANTID, variant?.variant_id,
    variant?.skuId, variant?.SKUID, variant?.sku_id, variant?.sku, variant?.SKU,
    variant?.code, variant?.CODE, index
  );
  const images = [...new Set(yoycolImageUrls(variant))].slice(0, 4);
  return {
    id: 'yoycol:' + rawId + ':' + rawVariantId,
    providerVariantId: rawVariantId,
    unitPrice: { value: retailPrice, currency: 'USD' },
    attributes: yoycolVariantAttributes(variant),
    images: (images.length ? images : fallbackImages.slice(0, 4)).map((url) => ({ url })),
    provider: 'yoycol'
  };
}

async function yoycolCatalogVariants(productId, env) {
  if (!productId) return [];
  const result = await yoycolGet('/catalog/products/' + encodeURIComponent(productId) + '/variants', env);
  if (result.error) return [];
  return yoycolArray(result.payload);
}

async function mapYoycolTemplate(template = {}, env) {
  const meta = yoycolTemplateMeta(template);
  if (!meta.rawId) return null;

  const images = [...new Set([
    ...(meta.previewImage ? [meta.previewImage] : []),
    ...yoycolImageUrls(template)
  ])].slice(0, 18);

  const retailPrice = yoycolRetailPrice(template, env);
  let rawVariants = yoycolRawVariants(template);

  if (!rawVariants.length && meta.productId) {
    rawVariants = await yoycolCatalogVariants(meta.productId, env);
  }

  let variants = rawVariants.slice(0, 150).map((variant, index) =>
    mapYoycolVariant(meta.rawId, variant, index, retailPrice, images)
  );

  if (!variants.length && retailPrice > 0) {
    variants = [{
      id: 'yoycol:' + meta.rawId + ':default',
      providerVariantId: 'default',
      unitPrice: { value: retailPrice, currency: 'USD' },
      attributes: {},
      images: images.slice(0, 4).map((url) => ({ url })),
      provider: 'yoycol'
    }];
  }

  return {
    id: 'yoycol:' + meta.rawId,
    provider: 'yoycol',
    providerId: meta.rawId,
    designCode: meta.designCode,
    productId: meta.productId,
    purchasable: retailPrice > 0 && variants.length > 0,
    needsRetailPrice: retailPrice <= 0,
    name: meta.productName || meta.designName || 'Vaultline Yoycol piece',
    designName: meta.designName || '',
    slug: ('yoycol-' + meta.rawId).replace(/[^A-Za-z0-9_-]/g, '-'),
    description: yoycolString(
      template.description, template.DESCRIPTION, template.desc, template.DESC,
      template.productDescription, template.PRODUCTDESCRIPTION, template.product_description,
      template.templateDescription, template.TEMPLATEDESCRIPTION, template.template_description
    ),
    price: retailPrice,
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
  const samples = [];
  for (const row of rows.slice(0, 5)) {
    const meta = yoycolTemplateMeta(row);
    const catalogVariants = meta.productId ? await yoycolCatalogVariants(meta.productId, env) : [];
    const mapped = await mapYoycolTemplate(row, env);
    samples.push({
      keys: Object.keys(row || {}).slice(0, 40),
      id: mapped?.providerId || null,
      designCode: mapped?.designCode || null,
      productId: mapped?.productId || null,
      name: mapped?.name || null,
      designName: mapped?.designName || null,
      imageCount: mapped?.images?.length || 0,
      templateVariantCount: yoycolRawVariants(row).length,
      catalogVariantCount: catalogVariants.length,
      mappedVariantCount: mapped?.variants?.length || 0,
      retailPrice: mapped?.price || 0,
      needsRetailPrice: Boolean(mapped?.needsRetailPrice)
    });
  }

  return json({
    ok: true,
    endpoint: '/product_templates',
    rawTopLevelKeys: Object.keys(result.payload || {}),
    rowCount: rows.length,
    samples
  });
}

function isYoycolSellableTemplate(product) {
  const name = String(product?.name || '').toLowerCase();
  const designName = String(product?.designName || '').toLowerCase();
  const combined = name + ' ' + designName;
  return !/(hang\s*tag|packag(?:e|ing)\s*bag|neck\s*label|care\s*label|brand(?:ing)?\s*label|thank\s*you\s*card|insert\s*card)/i.test(combined);
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
      const mapped = await mapYoycolTemplate(row, env);
      if (!mapped?.id || seen.has(mapped.id) || !isYoycolSellableTemplate(mapped) || !mapped.purchasable) continue;
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
      const mapped = await mapYoycolTemplate(row, env);
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
      return { error: json({ error: 'One of the Yoycol products is not ready for checkout. Set a retail price first.' }, 409) };
    }
    const variant = product.variants.find((v) => v.id === variantId) || product.variants[0];
    const unit = Number(variant?.unitPrice?.value || product.price || 0);
    if (!Number.isFinite(unit) || unit <= 0) {
      return { error: json({ error: 'One of the Yoycol products does not have a valid retail price.' }, 409) };
    }
    resolved.push({
      providerId,
      providerVariantId: variant?.providerVariantId || '',
      productId: product.productId || '',
      designCode: product.designCode || '',
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
