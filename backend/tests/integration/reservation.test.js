require('dotenv').config();
const request  = require('supertest');
const app      = require('../../src/app');
const { pool } = require('../../src/config/database');
const { connectRedis } = require('../../src/config/redis');

let token;
let userId;
let variantId;
let reservationId;
let initialAvailable;

const TEST_USER = {
  name:     'Inventory User',
  email:    `inventory_${Date.now()}@furnistorm.com`,
  password: 'Inventory@1234',
};

beforeAll(async () => {
  await connectRedis();
  const res = await request(app).post('/api/auth/register').send(TEST_USER);
  token  = res.body.token;
  userId = res.body.user.id;

  // pick a variant with stock
  const vRes = await request(app).get('/api/products/1/variants');
  const variant = vRes.body.variants.find((v) => parseInt(v.available_quantity) > 0);
  variantId        = variant.id;
  initialAvailable = parseInt(variant.available_quantity);
});

afterAll(async () => {
  await pool.query('DELETE FROM reservations WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await pool.end();
});

// helper to read live inventory
const getInventory = () =>
  pool.query('SELECT available_quantity, reserved_quantity, sold_quantity FROM inventory WHERE product_variant_id = $1', [variantId]);

// ── 1. AVAILABLE → RESERVED ───────────────────────────────────────────────────

describe('AVAILABLE → RESERVED', () => {
  test('reserves stock and decrements available_quantity', async () => {
    const { rows: [before] } = await getInventory();

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_variant_id: variantId, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.reservation.status).toBe('RESERVED');
    reservationId = res.body.reservation.id;

    const { rows: [after] } = await getInventory();
    expect(parseInt(after.available_quantity)).toBe(parseInt(before.available_quantity) - 2);
    expect(parseInt(after.reserved_quantity)).toBe(parseInt(before.reserved_quantity) + 2);
  });

  test('idempotency — same key returns same reservation', async () => {
    const key = `idem-${Date.now()}`;
    const r1 = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_variant_id: variantId, quantity: 1, idempotency_key: key });

    const r2 = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_variant_id: variantId, quantity: 1, idempotency_key: key });

    expect(r1.status).toBe(201);
    expect(r2.body.reservation.id).toBe(r1.body.reservation.id);

    // release the idempotency reservation so it doesn't affect later tests
    await request(app)
      .patch(`/api/reservations/${r1.body.reservation.id}/release`)
      .set('Authorization', `Bearer ${token}`);
  });

  test('rejects when stock is insufficient', async () => {
    const { rows: [inv] } = await pool.query(
      'SELECT available_quantity FROM inventory WHERE product_variant_id = $1',
      [variantId]
    );
    const overStock = parseInt(inv.available_quantity) + 1;

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_variant_id: variantId, quantity: overStock > 100 ? 100 : overStock });

    // if overStock > 100 the validator fires first (422), otherwise service fires (409)
    expect([409, 422]).toContain(res.status);
    expect(['INSUFFICIENT_STOCK', 'VALIDATION_ERROR']).toContain(res.body.error.code);
  });

  test('rejects invalid payload', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_variant_id: variantId, quantity: 0 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ── 2. RESERVED → PAYMENT_PENDING ────────────────────────────────────────────

describe('RESERVED → PAYMENT_PENDING', () => {
  test('transitions status to PAYMENT_PENDING', async () => {
    const res = await request(app)
      .patch(`/api/reservations/${reservationId}/payment-pending`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.reservation.status).toBe('PAYMENT_PENDING');
  });

  test('rejects duplicate transition from PAYMENT_PENDING', async () => {
    const res = await request(app)
      .patch(`/api/reservations/${reservationId}/payment-pending`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });
});

// ── 3. PAYMENT_PENDING → CONFIRMED ───────────────────────────────────────────

describe('PAYMENT_PENDING → CONFIRMED', () => {
  test('transitions status to CONFIRMED', async () => {
    const res = await request(app)
      .patch(`/api/reservations/${reservationId}/confirm`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.reservation.status).toBe('CONFIRMED');
  });

  test('rejects confirm from wrong state', async () => {
    const res = await request(app)
      .patch(`/api/reservations/${reservationId}/confirm`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });
});

// ── 4. CONFIRMED → SOLD ───────────────────────────────────────────────────────

describe('CONFIRMED → SOLD', () => {
  test('transitions to SOLD and moves reserved → sold in inventory', async () => {
    const { rows: [before] } = await getInventory();

    const res = await request(app)
      .patch(`/api/reservations/${reservationId}/sold`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.reservation.status).toBe('SOLD');

    const { rows: [after] } = await getInventory();
    expect(parseInt(after.reserved_quantity)).toBe(parseInt(before.reserved_quantity) - 2);
    expect(parseInt(after.sold_quantity)).toBe(parseInt(before.sold_quantity) + 2);
  });

  test('rejects further transitions from SOLD', async () => {
    const res = await request(app)
      .patch(`/api/reservations/${reservationId}/release`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });
});

// ── 5. RELEASE (stock restored) ───────────────────────────────────────────────

describe('RELEASE', () => {
  let releaseReservationId;

  test('creates a fresh reservation then releases it — restores available_quantity', async () => {
    const { rows: [before] } = await getInventory();

    const r = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_variant_id: variantId, quantity: 1 });

    expect(r.status).toBe(201);
    releaseReservationId = r.body.reservation.id;

    const rel = await request(app)
      .patch(`/api/reservations/${releaseReservationId}/release`)
      .set('Authorization', `Bearer ${token}`);

    expect(rel.status).toBe(200);
    expect(rel.body.reservation.status).toBe('RELEASED');

    const { rows: [after] } = await getInventory();
    expect(parseInt(after.available_quantity)).toBe(parseInt(before.available_quantity));
  });
});

// ── 6. GET ────────────────────────────────────────────────────────────────────

describe('GET /api/reservations/:id', () => {
  test('returns reservation with product info', async () => {
    const res = await request(app)
      .get(`/api/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.reservation).toHaveProperty('sku');
    expect(res.body.reservation).toHaveProperty('product_name');
    expect(res.body.reservation.status).toBe('SOLD');
  });

  test('returns 404 for unknown reservation', async () => {
    const res = await request(app)
      .get('/api/reservations/99999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RESERVATION_NOT_FOUND');
  });
});
