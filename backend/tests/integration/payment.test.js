require('dotenv').config();
const request  = require('supertest');
const app      = require('../../src/app');
const { pool } = require('../../src/config/database');
const { connectRedis } = require('../../src/config/redis');

let token;
let userId;
let addressId;
let variantId;

const TEST_USER = {
  name:     'Payment User',
  email:    `payment_${Date.now()}@furnistorm.com`,
  password: 'Payment@1234',
};

const ADDRESS = {
  name: 'Payment User', phone: '9000000003',
  address_line: '1 Payment Road', city: 'Bangalore',
  state: 'Karnataka', postal_code: '560001',
};

const auth = () => ({ Authorization: `Bearer ${token}` });

// seed a checkout and return { order, payment }
const doCheckout = async () => {
  await request(app).delete('/api/cart').set(auth());
  await request(app).post('/api/cart/items').set(auth())
    .send({ product_variant_id: variantId, quantity: 1 });
  const res = await request(app).post('/api/checkout').set(auth())
    .send({ address_id: addressId, payment_method: 'UPI' });
  return { order: res.body.order, payment: res.body.payment };
};

beforeAll(async () => {
  await connectRedis();
  const reg = await request(app).post('/api/auth/register').send(TEST_USER);
  token  = reg.body.token;
  userId = reg.body.user.id;

  const addr = await request(app).post('/api/addresses').set(auth()).send(ADDRESS);
  addressId = addr.body.address.id;

  const vRes = await request(app).get('/api/products/1/variants');
  variantId  = vRes.body.variants.find((v) => parseInt(v.available_quantity) > 0).id;
});

afterAll(async () => {
  await pool.query('DELETE FROM reservations WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM order_items  WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)', [userId]);
  await pool.query('DELETE FROM payments     WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM orders       WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM users        WHERE id = $1', [userId]);
  await pool.end();
});

// ── 1. SUCCESS ────────────────────────────────────────────────────────────────

describe('SUCCESS', () => {
  test('marks payment COMPLETED, order CONFIRMED, inventory reserved → sold', async () => {
    const { payment } = await doCheckout();

    const { rows: [invBefore] } = await pool.query(
      'SELECT reserved_quantity, sold_quantity FROM inventory WHERE product_variant_id = $1',
      [variantId]
    );

    const res = await request(app)
      .patch(`/api/payments/${payment.id}/success`)
      .set(auth())
      .send({ transaction_reference: `TXN-SUCCESS-${Date.now()}` });

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe('COMPLETED');

    const order = await pool.query('SELECT status FROM orders WHERE id = $1', [payment.order_id]);
    expect(order.rows[0].status).toBe('CONFIRMED');

    const { rows: [invAfter] } = await pool.query(
      'SELECT reserved_quantity, sold_quantity FROM inventory WHERE product_variant_id = $1',
      [variantId]
    );
    expect(parseInt(invAfter.reserved_quantity)).toBe(parseInt(invBefore.reserved_quantity) - 1);
    expect(parseInt(invAfter.sold_quantity)).toBe(parseInt(invBefore.sold_quantity) + 1);
  });

  test('rejects success on already COMPLETED payment', async () => {
    const { payment } = await doCheckout();
    const txn = `TXN-ALREADY-${Date.now()}`;
    await request(app).patch(`/api/payments/${payment.id}/success`).set(auth()).send({ transaction_reference: txn });

    const res = await request(app)
      .patch(`/api/payments/${payment.id}/success`)
      .set(auth())
      .send({ transaction_reference: `TXN-AGAIN-${Date.now()}` });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_COMPLETED');
  });
});

// ── 2. FAILED ─────────────────────────────────────────────────────────────────

describe('FAILED', () => {
  test('marks payment FAILED, order CANCELLED, inventory released', async () => {
    const { payment } = await doCheckout();

    const { rows: [invBefore] } = await pool.query(
      'SELECT available_quantity, reserved_quantity FROM inventory WHERE product_variant_id = $1',
      [variantId]
    );

    const res = await request(app)
      .patch(`/api/payments/${payment.id}/failed`)
      .set(auth())
      .send({ reason: 'Bank declined' });

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe('FAILED');

    const order = await pool.query('SELECT status FROM orders WHERE id = $1', [payment.order_id]);
    expect(order.rows[0].status).toBe('CANCELLED');

    const { rows: [invAfter] } = await pool.query(
      'SELECT available_quantity, reserved_quantity FROM inventory WHERE product_variant_id = $1',
      [variantId]
    );
    expect(parseInt(invAfter.available_quantity)).toBe(parseInt(invBefore.available_quantity) + 1);
    expect(parseInt(invAfter.reserved_quantity)).toBe(parseInt(invBefore.reserved_quantity) - 1);
  });
});

// ── 3. TIMEOUT ────────────────────────────────────────────────────────────────

describe('TIMEOUT', () => {
  test('rejects timeout on a fresh payment (not yet expired)', async () => {
    const { payment } = await doCheckout();

    const res = await request(app)
      .patch(`/api/payments/${payment.id}/timeout`)
      .set(auth());

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PAYMENT_NOT_TIMED_OUT');

    // cleanup
    await request(app).patch(`/api/payments/${payment.id}/failed`).set(auth());
  });

  test('processes timeout on an artificially aged payment', async () => {
    const { payment } = await doCheckout();

    // backdate created_at by 31 minutes so timeout check passes
    await pool.query(
      `UPDATE payments SET created_at = now() - interval '31 minutes' WHERE id = $1`,
      [payment.id]
    );

    const res = await request(app)
      .patch(`/api/payments/${payment.id}/timeout`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe('FAILED');

    const order = await pool.query('SELECT status FROM orders WHERE id = $1', [payment.order_id]);
    expect(order.rows[0].status).toBe('CANCELLED');
  });
});

// ── 4. RETRY ──────────────────────────────────────────────────────────────────

describe('RETRY', () => {
  test('creates a new PENDING payment after failure, re-reserves inventory', async () => {
    const { payment } = await doCheckout();
    await request(app).patch(`/api/payments/${payment.id}/failed`).set(auth());

    const { rows: [invBefore] } = await pool.query(
      'SELECT available_quantity, reserved_quantity FROM inventory WHERE product_variant_id = $1',
      [variantId]
    );

    const res = await request(app)
      .post(`/api/payments/${payment.id}/retry`)
      .set(auth());

    expect(res.status).toBe(201);
    expect(res.body.payment.status).toBe('PENDING');
    expect(res.body.payment.order_id).toBe(payment.order_id);

    const { rows: [invAfter] } = await pool.query(
      'SELECT available_quantity, reserved_quantity FROM inventory WHERE product_variant_id = $1',
      [variantId]
    );
    expect(parseInt(invAfter.available_quantity)).toBe(parseInt(invBefore.available_quantity) - 1);
    expect(parseInt(invAfter.reserved_quantity)).toBe(parseInt(invBefore.reserved_quantity) + 1);

    // cleanup — fail the retried payment
    await request(app).patch(`/api/payments/${res.body.payment.id}/failed`).set(auth());
  });

  test('blocks retry on non-FAILED payment', async () => {
    const { payment } = await doCheckout();

    const res = await request(app)
      .post(`/api/payments/${payment.id}/retry`)
      .set(auth());

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_PAYMENT_STATUS');

    await request(app).patch(`/api/payments/${payment.id}/failed`).set(auth());
  });

  test('blocks retry after MAX_RETRY_ATTEMPTS (3) failures', async () => {
    const { payment: p0 } = await doCheckout();
    await request(app).patch(`/api/payments/${p0.id}/failed`).set(auth());

    let lastPaymentId = p0.id;
    for (let i = 0; i < 2; i++) {
      const r = await request(app).post(`/api/payments/${lastPaymentId}/retry`).set(auth());
      lastPaymentId = r.body.payment.id;
      await request(app).patch(`/api/payments/${lastPaymentId}/failed`).set(auth());
    }

    const res = await request(app)
      .post(`/api/payments/${lastPaymentId}/retry`)
      .set(auth());

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('MAX_RETRIES_EXCEEDED');
  });
});

// ── 5. DUPLICATE PAYMENT ──────────────────────────────────────────────────────

describe('DUPLICATE PAYMENT', () => {
  test('rejects a second success with the same transaction_reference', async () => {
    const { payment: p1 } = await doCheckout();
    const { payment: p2 } = await doCheckout();

    const txn = `TXN-DUP-${Date.now()}`;

    const r1 = await request(app)
      .patch(`/api/payments/${p1.id}/success`)
      .set(auth())
      .send({ transaction_reference: txn });
    expect(r1.status).toBe(200);

    const r2 = await request(app)
      .patch(`/api/payments/${p2.id}/success`)
      .set(auth())
      .send({ transaction_reference: txn });
    expect(r2.status).toBe(409);
    expect(r2.body.error.code).toBe('DUPLICATE_PAYMENT');

    // cleanup p2
    await request(app).patch(`/api/payments/${p2.id}/failed`).set(auth());
  });
});

// ── 6. RECONCILIATION ─────────────────────────────────────────────────────────

describe('RECONCILIATION', () => {
  test('reconcile COMPLETED — confirms order and moves inventory', async () => {
    const { payment } = await doCheckout();

    const res = await request(app)
      .patch(`/api/payments/${payment.id}/reconcile`)
      .set(auth())
      .send({ actual_status: 'COMPLETED', transaction_reference: `TXN-RECON-${Date.now()}` });

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe('COMPLETED');

    const order = await pool.query('SELECT status FROM orders WHERE id = $1', [payment.order_id]);
    expect(order.rows[0].status).toBe('CONFIRMED');
  });

  test('reconcile FAILED — cancels order and releases inventory', async () => {
    const { payment } = await doCheckout();

    const { rows: [invBefore] } = await pool.query(
      'SELECT available_quantity FROM inventory WHERE product_variant_id = $1',
      [variantId]
    );

    const res = await request(app)
      .patch(`/api/payments/${payment.id}/reconcile`)
      .set(auth())
      .send({ actual_status: 'FAILED' });

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe('FAILED');

    const { rows: [invAfter] } = await pool.query(
      'SELECT available_quantity FROM inventory WHERE product_variant_id = $1',
      [variantId]
    );
    expect(parseInt(invAfter.available_quantity)).toBe(parseInt(invBefore.available_quantity) + 1);
  });

  test('rejects reconcile on non-PENDING payment', async () => {
    const { payment } = await doCheckout();
    await request(app).patch(`/api/payments/${payment.id}/failed`).set(auth());

    const res = await request(app)
      .patch(`/api/payments/${payment.id}/reconcile`)
      .set(auth())
      .send({ actual_status: 'COMPLETED', transaction_reference: `TXN-X-${Date.now()}` });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_PAYMENT_STATUS');
  });

  test('rejects reconcile with duplicate transaction_reference', async () => {
    const { payment: p1 } = await doCheckout();
    const { payment: p2 } = await doCheckout();
    const txn = `TXN-RECON-DUP-${Date.now()}`;

    await request(app).patch(`/api/payments/${p1.id}/reconcile`).set(auth())
      .send({ actual_status: 'COMPLETED', transaction_reference: txn });

    const res = await request(app).patch(`/api/payments/${p2.id}/reconcile`).set(auth())
      .send({ actual_status: 'COMPLETED', transaction_reference: txn });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_PAYMENT');

    await request(app).patch(`/api/payments/${p2.id}/failed`).set(auth());
  });
});
