const fs = require('fs');

const token = process.env.FOURTHWALL_STOREFRONT_TOKEN;

if (!token) {
  throw new Error('Missing FOURTHWALL_STOREFRONT_TOKEN');
}

const url = new URL(
  'https://storefront-api.fourthwall.com/v1/collections/all/products'
);

url.searchParams.set('currency', 'USD');
url.searchParams.set('limit', '100');
url.searchParams.set('storefront_token', token);

async function buildCatalog() {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Fourthwall Storefront API returned ${response.status}`);
  }

  const data = await response.json();

  const products = (data.results || []).map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description || '',
    price: product.variants?.[0]?.unitPrice?.value || 0,
    currency: product.variants?.[0]?.unitPrice?.currency || 'USD',
    primaryImageUrl:
      product.images?.[0]?.transformedUrl ||
      product.images?.[0]?.url ||
      '',
    variants: product.variants || []
  }));

  fs.mkdirSync('api/storefront', { recursive: true });

  fs.writeFileSync(
    'api/storefront/products',
    JSON.stringify({ products })
  );

  console.log(`Built Vaultline catalog with ${products.length} products.`);
}

buildCatalog();
