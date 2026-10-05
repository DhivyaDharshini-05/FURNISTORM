// Exchange & queue names — single source of truth for relay and consumer
const EXCHANGE      = 'furnistorm.events';
const ORDER_QUEUE   = 'order.confirmed';
const PAYMENT_QUEUE = 'payment.events';

// Routing keys published by the outbox relay
const ROUTING_KEYS = {
  'payment.success':     'payment.success',
  'payment.failed':      'payment.failed',
  'payment.timeout':     'payment.timeout',
  'payment.retry':       'payment.retry',
  'payment.reconciled':  'payment.reconciled',
  'checkout.initiated':  'checkout.initiated',
  'reservation.reserved':       'reservation.reserved',
  'reservation.payment_pending': 'reservation.payment_pending',
  'reservation.confirmed':      'reservation.confirmed',
  'reservation.sold':           'reservation.sold',
  'reservation.released':       'reservation.released',
};

const setupTopology = async (channel) => {
  // durable topic exchange
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

  // order confirmed queue — binds to payment.success only
  await channel.assertQueue(ORDER_QUEUE, { durable: true });
  await channel.bindQueue(ORDER_QUEUE, EXCHANGE, 'payment.success');

  // payment events queue — binds to all payment.* events
  await channel.assertQueue(PAYMENT_QUEUE, { durable: true });
  await channel.bindQueue(PAYMENT_QUEUE, EXCHANGE, 'payment.*');
};

module.exports = { EXCHANGE, ORDER_QUEUE, PAYMENT_QUEUE, ROUTING_KEYS, setupTopology };
