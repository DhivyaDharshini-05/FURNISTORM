require('dotenv').config();
const request  = require('supertest');
const app      = require('../../src/app');
const { pool } = require('../../src/config/database');
const { connectRedis } = require('../../src/config/redis');

let token;
let userId;
let addressId;
let variantId;
let couponCode;

const TEST_USER = {
  name:     'Checkout User',
  email:    `checkout_${Date.now()}@furnistorm.com`,
  password: 'Checkout@1234',
};

const ADDRESS = {
  name: 'Checkout User', phone: '9000000002',
  address_line: '1 Checkout Lane', city: 'Delhi',
  state: 'Delhi', postal_code: '110001',
};

const auth = () => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  await connectRedis();

  // register
  const reg = await request(app).post('/api/auth/register').send(TEST_USER);
  token  = reg.body.token;
  userId = reg.body.user.id;

  // create address
  const addr = await request(app).post('/api/addresses').set(auth()).send(ADDRESS);
  addressId = addr.body.address.id;

  // pick a variant with stock
  const vRes = await request(app).get('/api/products/1/variants');
  variantId  = vRes.body.variants.find((v) => parseInt(v.available_quantity) > 0).id;

  // seed a test coupon
  const { rows: [c] } = await pool.query(
    `INSERT INTO coupons
       (code, discount_type, discount_value, minimum_order_amount, start_date, expiry_date)
     VALUES ('TESTDISCOUNT10', 'PERCENTAGE', 10, 0, now(), now() + interval '1 day')
     RETURNING code`
  );
  couponCode = c.code;
});

afterAll(async () => {
  await pool.query("DELETE FROM coupons WHERE code = 'TESTDISCOUNT10'");
  await pool.query('DELETE FROM reservations WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)', [userId]);
  await pool.query('DELETE FROM payments WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM orders WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await pool.end();
});

// helper: add variant to cart
const addToCart = () =>
  request(app)
    .post('/api/cart/items')
    .set(auth())
    .send({ product_variant_id: variantId, quantity: 1 });

// helper: clear cart
const clearCart = () =>
  request(app).delete('/api/cart').set(auth());

// ── 1. CART EMPTY ─────────────────────────────────────────────────────────────

describe('Validate — empty cart', () => {
  test('rejects checkout when cart is empty', async () => {
    await clearCart();
    const res = await request(app)
      .post('/api/checkout')
      .set(auth())
      .send({ address_id: addressId, payment_method: 'UPI' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CART_EMPTY');
  });
});

// ── 2. INVALID ADDRESS ────────────────────────────────────────────────────────

describe('Validate — bad address', () => {
  test('rejects checkout with unknown address_id', async () => {
    await addToCart();
    const res = await request(app)
      .post('/api/checkout')
      .set(auth())
      .send({ address_id: 99999, payment_method: 'UPI' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ADDRESS_NOT_FOUND');
    await clearCart();
  });
});

// ── 3. INVALID COUPON ─────────────────────────────────────────────────────────

describe('Coupon — invalid code', () => {
  test('rejects checkout with a non-existent coupon', async () => {
    await addToCart();
    const res = await request(app)
      .post('/api/checkout')
      .set(auth())
      .send({ address_id: addressId, payment_method: 'UPI', coupon_code: 'FAKECODE' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_COUPON');
    await clearCart();
  });
});

// ── 4. HAPPY PATH — no coupon ─────────────────────────────────────────────────

describe('Checkout — success without coupon', () => {
  test('creates order, reservations, and payment intent', async () => {
    await addToCart();
    const res = await request(app)
      .post('/api/checkout')
      .set(auth())
      .send({ address_id: addressId, payment_method: 'UPI' });

    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('PAYMENT_PENDING');
    expect(res.body.payment.status).toBe('PENDING');
    expect(res.body.payment.payment_method).toBe('UPI');
    expect(res.body.reservations.length).toBe(1);
    expect(res.body.reservations[0].status).toBe('RESERVED');
    expect(parseFloat(res.body.order.discount_amount)).toBe(0);
  });
});

// ── 5. HAPPY PATH — with coupon ───────────────────────────────────────────────

describe('Checkout — success with coupon', () => {
  test('applies 10% discount and reflects in order totals', async () => {
    await addToCart();
    const res = await request(app)
      .post('/api/checkout')
      .set(auth())
      .send({ address_id: addressId, payment_method: 'CREDIT_CARD', coupon_code: couponCode });

    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('PAYMENT_PENDING');

    const subtotal  = parseFloat(res.body.order.subtotal);
    const discount  = parseFloat(res.body.order.discount_amount);
    const total     = parseFloat(res.body.order.total_amount);

    expect(discount).toBeCloseTo(subtotal * 0.1, 1);
    expect(total).toBeCloseTo(subtotal - discount, 1);
    expect(res.body.reservations[0].status).toBe('RESERVED');
  });
});

// ── 6. IDEMPOTENCY ────────────────────────────────────────────────────────────

describe('Checkout — idempotency', () => {
  test('same idempotency_key returns the same order', async () => {
    await addToCart();
    const key     = `checkout-idem-${Date.now()}`;
    const payload = { address_id: addressId, payment_method: 'COD', idempotency_key: key };

    const r1 = await request(app).post('/api/checkout').set(auth()).send(payload);
    expect(r1.status).toBe(201);

    // second call — cart is now empty but idempotency should replay
    const r2 = await request(app).post('/api/checkout').set(auth()).send(payload);
    expect(r2.body.order.id).toBe(r1.body.order.id);
    expect(r2.body.payment.id).toBe(r1.body.payment.id);
  });
});

// ── 7. VALIDATION ─────────────────────────────────────────────────────────────

describe('Checkout — payload validation', () => {
  test('rejects missing address_id', async () => {
    const res = await request(app)
      .post('/api/checkout')
      .set(auth())
      .send({ payment_method: 'UPI' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects invalid payment_method', async () => {
    const res = await request(app)
      .post('/api/checkout')
      .set(auth())
      .send({ address_id: addressId, payment_method: 'BITCOIN' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/checkout')
      .send({ address_id: addressId, payment_method: 'UPI' });
    expect(res.status).toBe(401);
  });
});
