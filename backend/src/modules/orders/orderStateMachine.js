const VALID_TRANSITIONS = {
  CREATED: ['PAYMENT_PENDING', 'CANCELLED'],
  PAYMENT_PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

const canTransition = (currentStatus, nextStatus) => {
  return VALID_TRANSITIONS[currentStatus]?.includes(nextStatus) ?? false;
};

module.exports = {
  VALID_TRANSITIONS,
  canTransition,
};
