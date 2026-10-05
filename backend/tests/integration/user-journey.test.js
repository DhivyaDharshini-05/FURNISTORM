require('dotenv').config();
const request  = require('supertest');
const app      = require('../../src/app');
const { pool } = require('../../src/config/database');
const { connectRedis } = require('../../src/config/redis');

let token;
let userId;
let variantId;
let cartItemId;
let wishlistItemId;
let addressId;

const TEST_USER = {
  name:     'Journey User',
  email:    `journey_${Date.now()}@furnistorm.com`,
  password: 'Journey@1234',
};

beforeAll(async () => {
  await connectRedis();

  const res = await request(app).post('/api/auth/register').send(TEST_USER);
  token  = res.body.token;
  userId = res.body.user.id;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await pool.end();
});

// ── 1. PRODUCT ────────────────────────────────────────────────────────────────

describe('Product', () => {
  test('fetch product and pick a variant with stock', async () => {
    const res = await request(app).get('/api/products/1/variants');
    expect(res.status).toBe(200);

    const variant = res.body.variants.find((v) => parseInt(v.available_quantity) > 0);
    expect(variant).toBeDefined();
    variantId = variant.id;
  });
});

// ── 2. ADD TO CART ────────────────────────────────────────────────────────────

describe('Add to Cart', () => {
  test('adds variant to cart', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_variant_id: variantId, quantity: 1 });

    expect(res.status).toBe(201);
    expect(res.body.cart.items.length).toBeGreaterThan(0);
    cartItemId = res.body.cart.items.find((i) => i.variant_id === variantId).id;
  });

  test('rejects add without auth', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .send({ product_variant_id: variantId, quantity: 1 });
    expect(res.status).toBe(401);
  });

  test('rejects invalid quantity', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_variant_id: variantId, quantity: 0 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ── 3. UPDATE QUANTITY ────────────────────────────────────────────────────────

describe('Update Quantity', () => {
  test('updates cart item quantity', async () => {
    const res = await request(app)
      .patch(`/api/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 3 });

    expect(res.status).toBe(200);
    const item = res.body.cart.items.find((i) => i.id === cartItemId);
    expect(item.quantity).toBe(3);
  });

  test('rejects quantity of 0', async () => {
    const res = await request(app)
      .patch(`/api/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 0 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 404 for non-existent cart item', async () => {
    const res = await request(app)
      .patch('/api/cart/items/99999')
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CART_ITEM_NOT_FOUND');
  });
});

// ── 4. WISHLIST ───────────────────────────────────────────────────────────────

describe('Wishlist', () => {
  test('adds variant to wishlist', async () => {
    const res = await request(app)
      .post('/api/wishlist/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_variant_id: variantId });

    expect(res.status).toBe(201);
    expect(res.body.wishlist.items.length).toBeGreaterThan(0);
    wishlistItemId = res.body.wishlist.items.find((i) => i.variant_id === variantId).id;
  });

  test('rejects duplicate wishlist entry', async () => {
    const res = await request(app)
      .post('/api/wishlist/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_variant_id: variantId });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_IN_WISHLIST');
  });

  test('removes item from wishlist', async () => {
    const res = await request(app)
      .delete(`/api/wishlist/items/${wishlistItemId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.wishlist.items.find((i) => i.id === wishlistItemId)).toBeUndefined();
  });
});

// ── 5. ADDRESS ────────────────────────────────────────────────────────────────

describe('Address', () => {
  const ADDRESS = {
    name:         'Journey User',
    phone:        '9000000001',
    address_line: '12 Test Street',
    city:         'Mumbai',
    state:        'Maharashtra',
    postal_code:  '400001',
  };

  test('creates an address', async () => {
    const res = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(ADDRESS);

    expect(res.status).toBe(201);
    expect(res.body.address).toMatchObject({ city: 'Mumbai', country: 'India' });
    addressId = res.body.address.id;
  });

  test('updates the address', async () => {
    const res = await request(app)
      .patch(`/api/addresses/${addressId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ city: 'Pune' });

    expect(res.status).toBe(200);
    expect(res.body.address.city).toBe('Pune');
  });

  test('returns 404 for another user\'s address', async () => {
    const res = await request(app)
      .get('/api/addresses/99999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ADDRESS_NOT_FOUND');
  });

  test('deletes the address', async () => {
    const res = await request(app)
      .delete(`/api/addresses/${addressId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
