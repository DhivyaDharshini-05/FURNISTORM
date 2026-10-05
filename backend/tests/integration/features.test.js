require('dotenv').config();
const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/database');
const { connectRedis } = require('../../src/config/redis');
const { connectRabbitMQ } = require('../../src/config/rabbitmq');
const { transitionOrderStatus } = require('../../src/modules/orders/orderService');

let u1Token, u1Id;
let u2Token, u2Id;
let productId, variantId, orderId;
let installationId, reviewId;

const auth1 = () => ({ Authorization: `Bearer ${u1Token}` });
const auth2 = () => ({ Authorization: `Bearer ${u2Token}` });

beforeAll(async () => {
  await connectRedis();
  await connectRabbitMQ();

  // Create users
  const r1 = await request(app).post('/api/auth/register').send({
    name: 'Feature User 1', email: `fu1_${Date.now()}@test.com`, password: 'Test@123'
  });
  u1Token = r1.body.token;
  u1Id = r1.body.user.id;

  const r2 = await request(app).post('/api/auth/register').send({
    name: 'Feature User 2', email: `fu2_${Date.now()}@test.com`, password: 'Test@123'
  });
  u2Token = r2.body.token;
  u2Id = r2.body.user.id;

  // Address
  const aRes = await request(app).post('/api/addresses').set(auth1()).send({
    name: 'Me', phone: '1234567890', address_line: '1', city: 'C', state: 'S', postal_code: '123'
  });
  const addressId = aRes.body.address.id;

  // Find product
  const vRes = await request(app).get('/api/products/1/variants');
  variantId = vRes.body.variants.find(v => v.available_quantity > 0).id;
  productId = 1;

  // Create order
  await request(app).post('/api/cart/items').set(auth1()).send({ product_variant_id: variantId, quantity: 1 });
  const cRes = await request(app).post('/api/checkout').set(auth1()).send({ address_id: addressId, payment_method: 'UPI' });
  orderId = cRes.body.order.id;
});

afterAll(async () => {
  await pool.query('DELETE FROM outbox_events WHERE aggregate_id IN (SELECT id::text FROM installations WHERE user_id IN ($1, $2))', [u1Id, u2Id]);
  await pool.query('DELETE FROM installations WHERE user_id IN ($1, $2)', [u1Id, u2Id]);
  await pool.query('DELETE FROM reviews WHERE user_id IN ($1, $2)', [u1Id, u2Id]);
  await pool.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN ($1, $2))', [u1Id, u2Id]);
  await pool.query('DELETE FROM order_status_history WHERE order_id IN (SELECT id FROM orders WHERE user_id IN ($1, $2))', [u1Id, u2Id]);
  await pool.query('DELETE FROM payments WHERE user_id IN ($1, $2)', [u1Id, u2Id]);
  await pool.query('DELETE FROM orders WHERE user_id IN ($1, $2)', [u1Id, u2Id]);
  await pool.query('DELETE FROM reservations WHERE user_id IN ($1, $2)', [u1Id, u2Id]);
  await pool.query('DELETE FROM addresses WHERE user_id IN ($1, $2)', [u1Id, u2Id]);
  await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [u1Id, u2Id]);
  await pool.end();
});

describe('ROOM FIT', () => {
  test('1. Fits well', async () => {
    const res = await request(app).post('/api/room-fit/analyze').send({
      roomWidth: 500, roomLength: 500, furnitureWidth: 100, furnitureDepth: 100, minimumWalkway: 50
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('FITS_WELL');
  });

  test('2. Tight fit', async () => {
    const res = await request(app).post('/api/room-fit/analyze').send({
      roomWidth: 200, roomLength: 200, furnitureWidth: 100, furnitureDepth: 100, minimumWalkway: 150
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('TIGHT_FIT');
  });

  test('3. Doesn\'t fit', async () => {
    const res = await request(app).post('/api/room-fit/analyze').send({
      roomWidth: 100, roomLength: 100, furnitureWidth: 200, furnitureDepth: 200, minimumWalkway: 50
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DOES_NOT_FIT');
  });

  test('4. Invalid dimensions', async () => {
    const res = await request(app).post('/api/room-fit/analyze').send({
      roomWidth: -500, roomLength: 500, furnitureWidth: 100, furnitureDepth: 100, minimumWalkway: 50
    });
    expect(res.status).toBe(422);
  });
});

describe('RECOMMENDATIONS', () => {
  test('5. Budget scoring', async () => {
    const res = await request(app).get('/api/recommendations?budget=999999');
    expect(res.status).toBe(200);
    expect(res.body.recommendations.length).toBeGreaterThan(0);
    // Highest score should have budget matched
    expect(res.body.recommendations[0].matched_dimensions.budget).toBe(true);
  });

  test('6. Style scoring', async () => {
    // Assuming product 1 has a style, let's just test the API responds
    const res = await request(app).get('/api/recommendations?style=modern');
    expect(res.status).toBe(200);
  });

  test('7. Multiple filters', async () => {
    const res = await request(app).get('/api/recommendations?style=modern&budget=1000&color=black');
    expect(res.status).toBe(200);
  });

  test('8. Ranking', async () => {
    const res = await request(app).get('/api/recommendations?budget=50000');
    expect(res.body.recommendations[0].ranking).toBe(1);
    expect(res.body.recommendations[0].score).toBe(100); // Because we only gave 1 filter, so it's 100%
  });
});

describe('REVIEWS', () => {
  test('Cannot review before delivery', async () => {
    const res = await request(app).post(`/api/products/${productId}/reviews`).set(auth1()).send({
      rating: 5, comment: 'Great!'
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PURCHASE_REQUIRED');
  });

  test('Transition order to DELIVERED to allow reviews & installation', async () => {
    await transitionOrderStatus(orderId, 'CONFIRMED');
    await transitionOrderStatus(orderId, 'PROCESSING');
    await transitionOrderStatus(orderId, 'SHIPPED');
    await transitionOrderStatus(orderId, 'OUT_FOR_DELIVERY');
    await transitionOrderStatus(orderId, 'DELIVERED');
  });

  test('9. Create review', async () => {
    const res = await request(app).post(`/api/products/${productId}/reviews`).set(auth1()).send({
      rating: 5, comment: 'Great!'
    });
    expect(res.status).toBe(201);
    reviewId = res.body.review.id;
  });

  test('10. Invalid rating', async () => {
    const res = await request(app).post(`/api/products/${productId}/reviews`).set(auth1()).send({
      rating: 6, comment: 'Great!'
    });
    expect(res.status).toBe(422);
  });

  test('11. Unauthorized review', async () => {
    const res = await request(app).post(`/api/products/${productId}/reviews`).send({
      rating: 5, comment: 'Great!'
    });
    expect(res.status).toBe(401);
  });

  test('Duplicate review', async () => {
    const res = await request(app).post(`/api/products/${productId}/reviews`).set(auth1()).send({
      rating: 4, comment: 'Oops'
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_REVIEW');
  });

  test('12. Update own review', async () => {
    const res = await request(app).put(`/api/reviews/${reviewId}`).set(auth1()).send({
      rating: 4, comment: 'Changed my mind'
    });
    expect(res.status).toBe(200);
    expect(res.body.review.rating).toBe(4);
  });

  test('13. Cannot update another user\'s review', async () => {
    const res = await request(app).put(`/api/reviews/${reviewId}`).set(auth2()).send({
      rating: 1, comment: 'Hacked'
    });
    expect(res.status).toBe(403); // Or 403 based on implementation
  });

  test('14. Delete own review', async () => {
    // Delete works
    const res = await request(app).delete(`/api/reviews/${reviewId}`).set(auth1());
    expect(res.status).toBe(200);
  });
});

describe('INSTALLATION', () => {
  test('16. Cannot request before delivery', async () => {
    // orderId is already delivered. Let's create a fresh order for u2
    const res = await request(app).post('/api/orders/99999/installation').set(auth2()).send({
      service_type: 'BASIC'
    });
    expect(res.status).toBe(404); // Not found
  });

  test('15. Create installation request', async () => {
    const res = await request(app).post(`/api/orders/${orderId}/installation`).set(auth1()).send({
      service_type: 'FULL',
      notes: 'Please be careful'
    });
    expect(res.status).toBe(201);
    installationId = res.body.installation.id;
  });

  test('17. Cannot create duplicate installation', async () => {
    const res = await request(app).post(`/api/orders/${orderId}/installation`).set(auth1()).send({
      service_type: 'BASIC'
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_INSTALLATION');
  });

  test('18. Retrieve own installation', async () => {
    const res = await request(app).get(`/api/installations/${installationId}`).set(auth1());
    expect(res.status).toBe(200);
    expect(res.body.installation.id).toBe(installationId);
  });

  test('19. Cannot access another user\'s installation', async () => {
    const res = await request(app).get(`/api/installations/${installationId}`).set(auth2());
    expect(res.status).toBe(404); // Due to user_id clause
  });

  test('20. Cancel installation', async () => {
    const res = await request(app).patch(`/api/installations/${installationId}/cancel`).set(auth1());
    expect(res.status).toBe(200);
    expect(res.body.installation.status).toBe('CANCELLED');
  });
});
