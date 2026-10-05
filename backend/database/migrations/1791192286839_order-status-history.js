exports.up = (pgm) => {
  pgm.createTable('order_status_history', {
    id:         { type: 'serial', primaryKey: true },
    order_id:   { type: 'integer', notNull: true, references: '"orders"', onDelete: 'CASCADE' },
    status:     { type: 'order_status', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('order_status_history', 'order_id');
};

exports.down = (pgm) => {
  pgm.dropTable('order_status_history');
};
