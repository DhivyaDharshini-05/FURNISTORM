require('dotenv').config();
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const { pool } = require('../../src/config/database');

const TEST_USER = {
  name: 'Test User',
  email: `test_${Date.now()}@furnistorm.com`,
  password: 'Test@1234',
  phone: '+91-9000000099',
};

let authToken;

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = $1', [TEST_USER.email]);
  await pool.end();
});

// ── 1. Successful registration ────────────────────────────────────────────────
test('POST /api/auth/register — success', async () => {
  const res = await request(app).post('/api/auth/register').send(TEST_USER);
  expect(res.status).toBe(201);
  expect(res.body.success).toBe(true);
  expect(res.body.token).toBeDefined();
  expect(res.body.user.email).toBe(TEST_USER.email);
  expect(res.body.user.password_hash).toBeUndefined();
});

// ── 2. Duplicate email ────────────────────────────────────────────────────────
test('POST /api/auth/register — duplicate email', async () => {
  const res = await request(app).post('/api/auth/register').send(TEST_USER);
  expect(res.status).toBe(409);
  expect(res.body.error.code).toBe('EMAIL_TAKEN');
});

// ── 3. Invalid email ──────────────────────────────────────────────────────────
test('POST /api/auth/register — invalid email', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ ...TEST_USER, email: 'not-an-email' });
  expect(res.status).toBe(422);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
});

// ── 4. Weak password ──────────────────────────────────────────────────────────
test('POST /api/auth/register — weak password', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ ...TEST_USER, email: 'other@furnistorm.com', password: 'weak' });
  expect(res.status).toBe(422);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
});

// ── 5. Successful login ───────────────────────────────────────────────────────
test('POST /api/auth/login — success', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: TEST_USER.email, password: TEST_USER.password });
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  expect(res.body.token).toBeDefined();
  expect(res.body.user.password_hash).toBeUndefined();
  authToken = res.body.token;
});

// ── 6. Wrong password ─────────────────────────────────────────────────────────
test('POST /api/auth/login — wrong password', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: TEST_USER.email, password: 'WrongPass@99' });
  expect(res.status).toBe(401);
  expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
});

// ── 7. Missing token ──────────────────────────────────────────────────────────
test('GET /api/auth/me — missing token', async () => {
  const res = await request(app).get('/api/auth/me');
  expect(res.status).toBe(401);
  expect(res.body.error.code).toBe('TOKEN_MISSING');
});

// ── 8. Invalid token ──────────────────────────────────────────────────────────
test('GET /api/auth/me — invalid token', async () => {
  const res = await request(app)
    .get('/api/auth/me')
    .set('Authorization', 'Bearer this.is.invalid');
  expect(res.status).toBe(401);
  expect(res.body.error.code).toBe('TOKEN_INVALID');
});

// ── 9. Expired token ──────────────────────────────────────────────────────────
test('GET /api/auth/me — expired token', async () => {
  const expired = jwt.sign(
    { id: 999, email: 'x@x.com' },
    process.env.JWT_SECRET,
    { expiresIn: '1ms' }
  );
  await new Promise((r) => setTimeout(r, 10));
  const res = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${expired}`);
  expect(res.status).toBe(401);
  expect(res.body.error.code).toBe('TOKEN_EXPIRED');
});

// ── 10. GET /api/auth/me — success ────────────────────────────────────────────
test('GET /api/auth/me — success', async () => {
  const res = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${authToken}`);
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  expect(res.body.user.email).toBe(TEST_USER.email);
  expect(res.body.user.password_hash).toBeUndefined();
});
