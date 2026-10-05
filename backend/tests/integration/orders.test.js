require('dotenv').config();
const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/database');
const { connectRedis } = require('../../src/config/redis');
const { connectRabbitMQ } = require('../../src/config/rabbitmq');
const { checkout } = require('../../src/modules/checkout/checkoutService');

let u1Token, u1Id;
let u2Token, u2Id;
let addressId;
let variantId;
let cartId;

const auth1 = () => ({ Authorization: `Bearer ${u1Token}` });
const auth2 = () => ({ Authorization: `Bearer ${u2Token}` });

beforeAll(async () => {
  await connectRedis();
  await connectRabbitMQ();

  // Create user 1
  const r1 = await request(app).post('/api/auth/register').send({
    name: 'Order User 1', email: `ou1_${Date.now()}@test.com`, password: 'Test@123'
  });
  u1Token = r1.body.token;
  u1Id = r1.body.user.id;

  // Create user 2
  const r2 = await request(app).post('/api/auth/register').send({
    name: 'Order User 2', email: `ou2_${Date.now()}@test.com`, password: 'Test@123'
  });
  u2Token = r2.body.token;
  u2Id = r2.body.user.id;

  // Address for u1
  const aRes = await request(app).post('/api/addresses').set(auth1()).send({
    name: 'Me', phone: '1234567890', address_line: '1', city: 'C', state: 'S', postal_code: '123'
  });
  addressId = aRes.body.address.id;

  // Find variant with stock
  const vRes = await request(app).get('/api/products/1/variants');
  variantId = vRes.body.variants.find(v => v.available_quantity > 0).id;
  
  // Cart id will be fetched during test after adding item
});

afterAll(async () => {
  await pool.query('DELETE FROM outbox_events WHERE aggregate_id IN (SELECT id::text FROM orders WHERE user_id IN ($1, $2))', [u1Id, u2Id]);
  await pool.query('DELETE FROM order_status_history WHERE order_id IN (SELECT id FROM orders WHERE user_id IN ($1, $2))', [u1Id, u2Id]);
  await pool.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN ($1, $2))', [u1Id, u2Id]);
  await pool.query('DELETE FROM payments WHERE user_id IN ($1, $2)', [u1Id, u2Id]);
  await pool.query('DELETE FROM orders WHERE user_id IN ($1, $2)', [u1Id, u2Id]);
  await pool.query('DELETE FROM reservations WHERE user_id IN ($1, $2)', [u1Id, u2Id]);
  await pool.query('DELETE FROM addresses WHERE user_id IN ($1, $2)', [u1Id, u2Id]);
  await pool.query('DELETE FROM carts WHERE user_id IN ($1, $2)', [u1Id, u2Id]);
  await pool.query('DELETE FROM wishlists WHERE user_id IN ($1, $2)', [u1Id, u2Id]);
  await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [u1Id, u2Id]);
  await pool.end();
});

describe('Part 1: Cart Clearing', () => {
  test('Successful checkout clears cart', async () => {
    await request(app).post('/api/cart/items').set(auth1()).send({ product_variant_id: variantId, quantity: 1 });
    
    const { rows: [c] } = await pool.query('SELECT id FROM carts WHERE user_id = $1', [u1Id]);
    cartId = c.id;

    const res = await request(app).post('/api/checkout').set(auth1()).send({ address_id: addressId, payment_method: 'UPI' });
    expect(res.status).toBe(201);
    
    // Cart should be empty
    const { rows: items } = await pool.query('SELECT * FROM cart_items WHERE cart_id = $1', [cartId]);
    expect(items.length).toBe(0);
  });

  test('Failed checkout does not clear cart', async () => {
    await request(app).post('/api/cart/items').set(auth1()).send({ product_variant_id: variantId, quantity: 1 });
    
    const { rows: [c] } = await pool.query('SELECT id FROM carts WHERE user_id = $1', [u1Id]);
    cartId = c.id;

    // Fail by providing bad address
    const res = await request(app).post('/api/checkout').set(auth1()).send({ address_id: 999999, payment_method: 'UPI' });
    expect(res.status).toBe(404);
    
    // Cart should still have the item
    const { rows: items } = await pool.query('SELECT * FROM cart_items WHERE cart_id = $1', [cartId]);
    expect(items.length).toBe(1);
    
    // cleanup
    await request(app).delete('/api/cart').set(auth1());
  });
});

describe('Part 2: Order Lifecycle & API', () => {
  let orderId;

  beforeAll(async () => {
    await request(app).post('/api/cart/items').set(auth1()).send({ product_variant_id: variantId, quantity: 1 });
    const res = await request(app).post('/api/checkout').set(auth1()).send({ address_id: addressId, payment_method: 'UPI' });
    orderId = res.body.order.id;
  });

  test('Customer can retrieve own orders', async () => {
    const res = await request(app).get('/api/orders').set(auth1());
    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBeGreaterThan(0);
  });

  test('Customer can retrieve specific order details', async () => {
    const res = await request(app).get(`/api/orders/${orderId}`).set(auth1());
    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe(orderId);
    expect(res.body.order.items.length).toBe(1);
    expect(res.body.order.shipping_address).toBeDefined();
  });

  test('Customer cannot retrieve another customer\'s order', async () => {
    const res = await request(app).get(`/api/orders/${orderId}`).set(auth2());
    expect(res.status).toBe(404); // Not found (for this user)
  });

  test('Customer can get order status timeline', async () => {
    const res = await request(app).get(`/api/orders/${orderId}/status`).set(auth1());
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PAYMENT_PENDING');
    expect(res.body.timeline.length).toBeGreaterThanOrEqual(2); // CREATED, PAYMENT_PENDING
  });

  test('Admin transitions: PAYMENT_PENDING -> CONFIRMED (simulated through payment or direct)', async () => {
    // In our system, checkout -> PAYMENT_PENDING. Payment success -> CONFIRMED.
    // For test, we use the transition API directly as "admin"
    // To make requireRole('ADMIN') pass in tests without mocking, we can either mock it or just call the service.
    // Since our test creates a regular user, the router requireRole('ADMIN') might block.
    // Let's call the service directly to test the state machine.
    const { transitionOrderStatus } = require('../../src/modules/orders/orderService');
    const { order } = await transitionOrderStatus(orderId, 'CONFIRMED');
    expect(order.status).toBe('CONFIRMED');
  });

  test('Transitions: CONFIRMED -> PROCESSING', async () => {
    const { transitionOrderStatus } = require('../../src/modules/orders/orderService');
    const { order } = await transitionOrderStatus(orderId, 'PROCESSING');
    expect(order.status).toBe('PROCESSING');
  });

  test('Transitions: PROCESSING -> SHIPPED', async () => {
    const { transitionOrderStatus } = require('../../src/modules/orders/orderService');
    const { order } = await transitionOrderStatus(orderId, 'SHIPPED');
    expect(order.status).toBe('SHIPPED');
  });

  test('Transitions: SHIPPED -> OUT_FOR_DELIVERY', async () => {
    const { transitionOrderStatus } = require('../../src/modules/orders/orderService');
    const { order } = await transitionOrderStatus(orderId, 'OUT_FOR_DELIVERY');
    expect(order.status).toBe('OUT_FOR_DELIVERY');
  });

  test('Transitions: OUT_FOR_DELIVERY -> DELIVERED', async () => {
    const { transitionOrderStatus } = require('../../src/modules/orders/orderService');
    const { order } = await transitionOrderStatus(orderId, 'DELIVERED');
    expect(order.status).toBe('DELIVERED');
  });

  test('Invalid transition is rejected', async () => {
    const { transitionOrderStatus } = require('../../src/modules/orders/orderService');
    await expect(transitionOrderStatus(orderId, 'PROCESSING')).rejects.toThrow();
  });

  test('Concurrent state transitions cannot corrupt order', async () => {
    // We will create a new order and try to transition it concurrently
    await request(app).post('/api/cart/items').set(auth1()).send({ product_variant_id: variantId, quantity: 1 });
    const cRes = await request(app).post('/api/checkout').set(auth1()).send({ address_id: addressId, payment_method: 'UPI' });
    const newOrderId = cRes.body.order.id;

    const { transitionOrderStatus } = require('../../src/modules/orders/orderService');
    
    // Simulate payment making it CONFIRMED first
    await transitionOrderStatus(newOrderId, 'CONFIRMED');

    // Attempt to concurrently transition to PROCESSING
    const p1 = transitionOrderStatus(newOrderId, 'PROCESSING');
    const p2 = transitionOrderStatus(newOrderId, 'PROCESSING');
    
    const results = await Promise.allSettled([p1, p2]);
    
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(rejected[0].reason.code).toBe('INVALID_TRANSITION'); // Or duplicate depending on timing
  });
  
  test('Order transition creates appropriate outbox event', async () => {
    const { rows: events } = await pool.query(
      `SELECT * FROM outbox_events WHERE aggregate_id = $1 AND event_type = 'order.shipped'`,
      [String(orderId)]
    );
    expect(events.length).toBe(1);
    expect(events[0].payload.order.status).toBe('SHIPPED');
  });
});
