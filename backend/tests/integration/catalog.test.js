require('dotenv').config();
const request  = require('supertest');
const app      = require('../../src/app');
const { pool } = require('../../src/config/database');
const { connectRedis } = require('../../src/config/redis');

beforeAll(() => connectRedis());
afterAll(()  => pool.end());

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/categories', () => {
  test('returns all 8 categories', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.categories.length).toBe(8);
  });

  test('second call is served from cache', async () => {
    await request(app).get('/api/categories');          // prime cache
    const res = await request(app).get('/api/categories'); // should hit cache
    expect(res.status).toBe(200);
    expect(res.body.fromCache).toBe(true);
  });
});

describe('GET /api/categories/:id', () => {
  test('returns a single category', async () => {
    const res = await request(app).get('/api/categories/1');
    expect(res.status).toBe(200);
    expect(res.body.category).toHaveProperty('name');
  });

  test('returns 404 for unknown category', async () => {
    const res = await request(app).get('/api/categories/99999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS — list
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/products', () => {
  test('returns paginated product list', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 12 });
    expect(res.body.products.length).toBeGreaterThan(0);
  });

  test('pagination — page 2 returns different products', async () => {
    const p1 = await request(app).get('/api/products?page=1&limit=5');
    const p2 = await request(app).get('/api/products?page=2&limit=5');
    expect(p1.body.products[0].id).not.toBe(p2.body.products[0].id);
  });

  test('pagination — limit is capped at 50', async () => {
    const res = await request(app).get('/api/products?limit=999');
    expect(res.body.pagination.limit).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS — search
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/products?search=', () => {
  test('search by name returns matching products', async () => {
    const res = await request(app).get('/api/products?search=sofa');
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeGreaterThan(0);
    res.body.products.forEach((p) =>
      expect(p.name.toLowerCase()).toMatch(/sofa/)
    );
  });

  test('search with no match returns empty array', async () => {
    const res = await request(app).get('/api/products?search=xyznonexistent999');
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(0);
    expect(res.body.pagination.total).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS — filters
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/products — filters', () => {
  test('filter by category_id', async () => {
    const res = await request(app).get('/api/products?category=1');
    expect(res.status).toBe(200);
    res.body.products.forEach((p) => expect(p.category_id).toBe(1));
  });

  test('filter by brand', async () => {
    const res = await request(app).get('/api/products?brand=ComfortCraft');
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeGreaterThan(0);
    res.body.products.forEach((p) =>
      expect(p.brand.toLowerCase()).toContain('comfortcraft')
    );
  });

  test('filter by min_price and max_price', async () => {
    const res = await request(app).get('/api/products?min_price=10000&max_price=30000');
    expect(res.status).toBe(200);
    res.body.products.forEach((p) => {
      const price = parseFloat(p.discount_price || p.base_price);
      expect(price).toBeGreaterThanOrEqual(10000);
      expect(price).toBeLessThanOrEqual(30000);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS — sort
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/products — sort', () => {
  test('sort by price_asc', async () => {
    const res = await request(app).get('/api/products?sort=price_asc&limit=5');
    const prices = res.body.products.map((p) => parseFloat(p.discount_price || p.base_price));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  test('sort by price_desc', async () => {
    const res = await request(app).get('/api/products?sort=price_desc&limit=5');
    const prices = res.body.products.map((p) => parseFloat(p.discount_price || p.base_price));
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS — single + variants
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/products/:id', () => {
  test('returns a single product with category info', async () => {
    const res = await request(app).get('/api/products/1');
    expect(res.status).toBe(200);
    expect(res.body.product).toHaveProperty('id', 1);
    expect(res.body.product).toHaveProperty('category_name');
  });

  test('returns 404 for unknown product', async () => {
    const res = await request(app).get('/api/products/99999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  test('second call served from cache', async () => {
    await request(app).get('/api/products/1');          // prime cache
    const res = await request(app).get('/api/products/1'); // should hit cache
    expect(res.body.fromCache).toBe(true);
  });
});

describe('GET /api/products/:id/variants', () => {
  test('returns variants with inventory', async () => {
    const res = await request(app).get('/api/products/1/variants');
    expect(res.status).toBe(200);
    expect(res.body.variants.length).toBeGreaterThan(0);
    expect(res.body.variants[0]).toHaveProperty('sku');
    expect(res.body.variants[0]).toHaveProperty('available_quantity');
  });

  test('flash-sale variant has available_quantity = 100', async () => {
    const res = await request(app).get('/api/products/1/variants');
    const flash = res.body.variants.find((v) => v.sku.endsWith('-STD'));
    expect(parseInt(flash.available_quantity)).toBe(100);
  });

  test('returns 404 for variants of unknown product', async () => {
    const res = await request(app).get('/api/products/99999/variants');
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FILTER OPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/products/filters', () => {
  test('returns brands, styles, colors, materials, price range', async () => {
    const res = await request(app).get('/api/products/filters');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.filters.brands)).toBe(true);
    expect(Array.isArray(res.body.filters.styles)).toBe(true);
    expect(Array.isArray(res.body.filters.colors)).toBe(true);
    expect(Array.isArray(res.body.filters.materials)).toBe(true);
    expect(res.body.filters.price).toHaveProperty('min_price');
    expect(res.body.filters.price).toHaveProperty('max_price');
  });
});
