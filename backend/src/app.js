require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { pool } = require('./config/database');
const { getRedis } = require('./config/redis');
const { getChannel } = require('./config/rabbitmq');
const authRoutes     = require('./modules/auth/authRoutes');
const categoryRoutes = require('./modules/categories/categoryRoutes');
const productRoutes  = require('./modules/products/productRoutes');
const cartRoutes     = require('./modules/cart/cartRoutes');
const wishlistRoutes = require('./modules/wishlist/wishlistRoutes');
const addressRoutes      = require('./modules/addresses/addressRoutes');
const orderRoutes        = require('./modules/orders/orderRoutes');
const reservationRoutes  = require('./modules/reservations/reservationRoutes');
const checkoutRoutes     = require('./modules/checkout/checkoutRoutes');
const paymentRoutes      = require('./modules/payments/paymentRoutes');
const roomFitRoutes      = require('./modules/room-fit/roomFitRoutes');
const recommendationRoutes = require('./modules/recommendations/recommendationRoutes');
const { reviewRouter }   = require('./modules/reviews/reviewRoutes');
const { installationRouter } = require('./modules/installations/installationRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/auth',       authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products',   productRoutes);
app.use('/api/cart',       cartRoutes);
app.use('/api/wishlist',   wishlistRoutes);
app.use('/api/addresses',    addressRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/checkout',     checkoutRoutes);
app.use('/api/payments',     paymentRoutes);
app.use('/api/orders',       orderRoutes);
app.use('/api/room-fit',     roomFitRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/reviews',      reviewRouter);
app.use('/api/installations', installationRouter);

// Health check
app.get('/api/health', async (req, res, next) => {
  try {
    const status = { postgres: 'down', redis: 'down', rabbitmq: 'down' };

    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      status.postgres = 'up';
    } catch (_) {}

    try {
      await getRedis().ping();
      status.redis = 'up';
    } catch (_) {}

    try {
      if (getChannel()) status.rabbitmq = 'up';
    } catch (_) {}

    res.json({
      success: true,
      message: 'FURNISTORM backend is running',
      services: status,
    });
  } catch (err) {
    next(err);
  }
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
