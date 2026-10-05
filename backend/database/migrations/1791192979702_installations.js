exports.up = (pgm) => {
  pgm.createType('installation_service_type', [
    'BASIC',
    'FULL',
    'PREMIUM',
    'SELF_GUIDED'
  ]);

  pgm.createType('installation_status', [
    'INSTALLATION_REQUESTED',
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
  ]);

  pgm.createTable('installations', {
    id:             { type: 'serial', primaryKey: true },
    order_id:       { type: 'integer', notNull: true, unique: true, references: '"orders"', onDelete: 'CASCADE' },
    user_id:        { type: 'integer', notNull: true, references: '"users"', onDelete: 'CASCADE' },
    service_type:   { type: 'installation_service_type', notNull: true },
    status:         { type: 'installation_status', notNull: true, default: 'INSTALLATION_REQUESTED' },
    scheduled_date: { type: 'date' },
    time_slot:      { type: 'varchar(50)' },
    notes:          { type: 'text' },
    created_at:     { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at:     { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('installations', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('installations');
  pgm.dropType('installation_status');
  pgm.dropType('installation_service_type');
};
