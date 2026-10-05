/* eslint-disable camelcase */
exports.up = (pgm) => {
  pgm.createType('reservation_status', [
    'RESERVED',
    'PAYMENT_PENDING',
    'CONFIRMED',
    'PAYMENT_FAILED',
    'TIMEOUT',
    'RELEASED',
    'SOLD',
  ]);

  pgm.createType('payment_status', [
    'PENDING',
    'COMPLETED',
    'FAILED',
    'REFUNDED',
  ]);

  pgm.createType('payment_method', [
    'CREDIT_CARD',
    'DEBIT_CARD',
    'UPI',
    'NET_BANKING',
    'WALLET',
    'COD',
  ]);

  pgm.createType('order_status', [
    'CREATED',
    'PAYMENT_PENDING',
    'CONFIRMED',
    'PROCESSING',
    'SHIPPED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
    'REFUNDED',
  ]);

  pgm.createType('discount_type', ['PERCENTAGE', 'FLAT']);

  pgm.createType('idempotency_status', ['PROCESSING', 'COMPLETED', 'FAILED']);

  pgm.createType('outbox_status', ['PENDING', 'PROCESSED', 'FAILED']);
};

exports.down = (pgm) => {
  pgm.dropType('outbox_status');
  pgm.dropType('idempotency_status');
  pgm.dropType('discount_type');
  pgm.dropType('order_status');
  pgm.dropType('payment_method');
  pgm.dropType('payment_status');
  pgm.dropType('reservation_status');
};
