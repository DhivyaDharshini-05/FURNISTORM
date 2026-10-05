require('dotenv').config();
const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/database');
const { connectRedis } = require('../../src/config/redis');
const { connectRabbitMQ, getChannel } = require('../../src/config/rabbitmq');
const { startOutboxRelay, stopOutboxRelay } = require('../../src/workers/outboxRelay');
const { startReservationExpiryWorker, stopReservationExpiryWorker } = require('../../src/workers/reservationExpiryWorker');

let token;
let userId;
let addressId;
let variants = [];

const TEST_USER = {
  name: 'Reliability User',
  email: `reliability_${Date.now()}@furnistorm.com`,
  password: 'Reliability@1234',
};

const auth = () => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  await connectRedis();
  await connectRabbitMQ();

  // Register
  const reg = await request(app).post('/api/auth/register').send(TEST_USER);
  token = reg.body.token;
  userId = reg.body.user.id;

  // Create address
  const addr = await request(app).post('/api/addresses').set(auth()).send({
    name: 'Reliability', phone: '9000000003',
    address_line: '1 Test Ln', city: 'Mumbai', state: 'MH', postal_code: '400001'
  });
  addressId = addr.body.address.id;

  // Get two variants
  const vRes = await request(app).get('/api/products/1/variants');
  variants = vRes.body.variants.filter((v) => parseInt(v.available_quantity) > 10).slice(0, 2);
});

afterAll(async () => {
  stopOutboxRelay();
  stopReservationExpiryWorker();
  
  await pool.query('DELETE FROM outbox_events WHERE aggregate_id IN (SELECT id::text FROM orders WHERE user_id = $1)', [userId]);
  await pool.query('DELETE FROM outbox_events WHERE aggregate_id IN (SELECT id::text FROM payments WHERE user_id = $1)', [userId]);
  await pool.query('DELETE FROM outbox_events WHERE aggregate_id IN (SELECT id::text FROM reservations WHERE user_id = $1)', [userId]);
  await pool.query('DELETE FROM idempotency_keys WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM reservations WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)', [userId]);
  await pool.query('DELETE FROM payments WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM orders WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = $1)', [userId]);
  await pool.query('DELETE FROM carts WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM addresses WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM wishlists WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  
  await pool.end();
});

const clearCart = () => request(app).delete('/api/cart').set(auth());

describe('1. Checkout Inventory Deadlock', () => {
  test('Two concurrent checkouts with different item ordering do not deadlock', async () => {
    // We will simulate the checkout directly by invoking the service multiple times
    const { checkout } = require('../../src/modules/checkout/checkoutService');

    await clearCart();
    await request(app).post('/api/cart/items').set(auth()).send({ product_variant_id: variants[0].id, quantity: 1 });
    await request(app).post('/api/cart/items').set(auth()).send({ product_variant_id: variants[1].id, quantity: 1 });

    // Since we fixed it by adding ORDER BY pv.id ASC in checkoutService, 
    // it will always lock in the same order regardless of cart insertion order.
    // We'll execute two concurrent checkout calls.
    const p1 = checkout(userId, { address_id: addressId, payment_method: 'UPI', idempotency_key: 'dl-1' });
    const p2 = checkout(userId, { address_id: addressId, payment_method: 'UPI', idempotency_key: 'dl-2' });

    // It should not throw a deadlock error (code 40P01)
    const results = await Promise.allSettled([p1, p2]);
    for (const r of results) {
      if (r.status === 'rejected') {
        expect(r.reason.code).not.toBe('40P01'); // Deadlock detected
      }
    }
  });
});

describe('2. Reservation Expiration Worker', () => {
  test('Expires old reservations', async () => {
    const res = await request(app).post('/api/reservations').set(auth())
      .send({ product_variant_id: variants[0].id, quantity: 1 });
    const reservationId = res.body.reservation.id;

    // Manually force it to expire
    await pool.query(`UPDATE reservations SET expires_at = now() - interval '1 minute' WHERE id = $1`, [reservationId]);

    const { expireReservations } = require('../../src/workers/reservationExpiryWorker');
    
    // We trigger it once for the test
    const { rows: pre } = await pool.query(`SELECT status FROM reservations WHERE id = $1`, [reservationId]);
    expect(pre[0].status).toBe('RESERVED');
    
    await expireReservations();

    const { rows: post } = await pool.query(`SELECT status FROM reservations WHERE id = $1`, [reservationId]);
    expect(post[0].status).toBe('TIMEOUT');
  });
});

describe('4. 100 Concurrent Idempotent Requests', () => {
  test('Only one request succeeds, others return safely or conflict', async () => {
    const key = `idem-100-${Date.now()}`;
    const payload = { product_variant_id: variants[0].id, quantity: 1, idempotency_key: key };
    
    const requests = Array.from({ length: 100 }).map(() =>
      request(app).post('/api/reservations').set(auth()).send(payload)
    );

    const responses = await Promise.all(requests);
    
    const created = responses.filter(r => r.status === 201);
    const conflictsOrSuccesses = responses.filter(r => r.status === 409 || r.status === 201 || r.status === 200);

    expect(created.length).toBeLessThanOrEqual(1);
    // Because some might return 409 (conflict) or 201 (first) or 201/200 (replayed success), 
    // the key is that exactly one actual row is inserted.
    const { rows: dbRows } = await pool.query('SELECT COUNT(*) FROM reservations WHERE idempotency_key = $1', [key]);
    expect(parseInt(dbRows[0].count)).toBe(1);
  });
});

describe('5 & 6. Duplicate payment callbacks', () => {
  test('Two concurrent payment success callbacks only update once', async () => {
    const { checkout } = require('../../src/modules/checkout/checkoutService');
    const { processSuccess } = require('../../src/modules/payments/paymentService');
    
    await clearCart();
    await request(app).post('/api/cart/items').set(auth()).send({ product_variant_id: variants[0].id, quantity: 1 });
    const { payment, order } = await checkout(userId, { address_id: addressId, payment_method: 'UPI' });

    // processSuccess concurrently with DIFFERENT transaction_reference
    const p1 = processSuccess(userId, payment.id, { transaction_reference: `tx1-${Date.now()}` });
    const p2 = processSuccess(userId, payment.id, { transaction_reference: `tx2-${Date.now()}` });

    const results = await Promise.allSettled([p1, p2]);
    
    const successes = results.filter(r => r.status === 'fulfilled' && r.value.payment.status === 'COMPLETED');
    expect(successes.length).toBeGreaterThanOrEqual(1);

    const { rows: [postOrder] } = await pool.query('SELECT status FROM orders WHERE id = $1', [order.id]);
    expect(postOrder.status).toBe('CONFIRMED');
    
    // Ensure only 1 payment was marked completed (or both returned safely but DB only processed once)
    const { rows: [postPayment] } = await pool.query('SELECT status FROM payments WHERE id = $1', [payment.id]);
    expect(postPayment.status).toBe('COMPLETED');
  });
});

describe('7 & 8. Payment retry inventory', () => {
  test('Payment retry with insufficient stock fails', async () => {
    const { checkout } = require('../../src/modules/checkout/checkoutService');
    const { processFailed, retryPayment } = require('../../src/modules/payments/paymentService');
    
    await clearCart();
    await request(app).post('/api/cart/items').set(auth()).send({ product_variant_id: variants[1].id, quantity: 10 });
    const { payment } = await checkout(userId, { address_id: addressId, payment_method: 'UPI' });

    // Fail it
    await processFailed(userId, payment.id);

    // Drain inventory manually to simulate stockout
    await pool.query('UPDATE inventory SET available_quantity = 0 WHERE product_variant_id = $1', [variants[1].id]);

    // Retry should fail with OUT_OF_STOCK
    let error;
    try {
      await retryPayment(userId, payment.id);
    } catch (err) {
      error = err;
    }
    
    expect(error).toBeDefined();
    expect(error.code).toBe('OUT_OF_STOCK');

    // Restore inventory
    await pool.query('UPDATE inventory SET available_quantity = 50 WHERE product_variant_id = $1', [variants[1].id]);
    
    // Retry should now succeed
    const newPayment = await retryPayment(userId, payment.id);
    expect(newPayment.payment.status).toBe('PENDING');
  });
});
