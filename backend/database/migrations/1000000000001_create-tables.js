/* eslint-disable camelcase */
exports.up = (pgm) => {
  // ── users ──────────────────────────────────────────────────────────────────
  pgm.createTable('users', {
    id:            { type: 'serial', primaryKey: true },
    name:          { type: 'varchar(150)', notNull: true },
    email:         { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    phone:         { type: 'varchar(20)' },
    created_at:    { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at:    { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('users', 'email');

  // ── categories ─────────────────────────────────────────────────────────────
  pgm.createTable('categories', {
    id:          { type: 'serial', primaryKey: true },
    name:        { type: 'varchar(100)', notNull: true, unique: true },
    description: { type: 'text' },
    created_at:  { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // ── products ───────────────────────────────────────────────────────────────
  pgm.createTable('products', {
    id:                     { type: 'serial', primaryKey: true },
    category_id:            { type: 'integer', notNull: true, references: '"categories"', onDelete: 'RESTRICT' },
    name:                   { type: 'varchar(255)', notNull: true },
    description:            { type: 'text' },
    brand:                  { type: 'varchar(100)' },
    base_price:             { type: 'numeric(12,2)', notNull: true },
    discount_price:         { type: 'numeric(12,2)' },
    material:               { type: 'varchar(100)' },
    style:                  { type: 'varchar(100)' },
    color:                  { type: 'varchar(50)' },
    length:                 { type: 'numeric(8,2)' },
    width:                  { type: 'numeric(8,2)' },
    height:                 { type: 'numeric(8,2)' },
    weight:                 { type: 'numeric(8,2)' },
    installation_available: { type: 'boolean', notNull: true, default: false },
    created_at:             { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at:             { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('products', 'category_id');
  pgm.createIndex('products', 'name');

  // ── product_variants ───────────────────────────────────────────────────────
  pgm.createTable('product_variants', {
    id:               { type: 'serial', primaryKey: true },
    product_id:       { type: 'integer', notNull: true, references: '"products"', onDelete: 'CASCADE' },
    sku:              { type: 'varchar(100)', notNull: true, unique: true },
    size:             { type: 'varchar(50)' },
    material:         { type: 'varchar(100)' },
    color:            { type: 'varchar(50)' },
    leg_type:         { type: 'varchar(50)' },
    additional_price: { type: 'numeric(12,2)', notNull: true, default: 0 },
    created_at:       { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('product_variants', 'sku');
  pgm.createIndex('product_variants', 'product_id');

  // ── inventory ──────────────────────────────────────────────────────────────
  pgm.createTable('inventory', {
    id:                  { type: 'serial', primaryKey: true },
    product_variant_id:  { type: 'integer', notNull: true, references: '"product_variants"', onDelete: 'CASCADE' },
    available_quantity:  { type: 'integer', notNull: true, default: 0 },
    reserved_quantity:   { type: 'integer', notNull: true, default: 0 },
    sold_quantity:       { type: 'integer', notNull: true, default: 0 },
    version:             { type: 'integer', notNull: true, default: 0 },
    updated_at:          { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('inventory', 'inventory_product_variant_id_unique', 'UNIQUE (product_variant_id)');
  pgm.addConstraint('inventory', 'inventory_available_quantity_check', 'CHECK (available_quantity >= 0)');
  pgm.addConstraint('inventory', 'inventory_reserved_quantity_check',  'CHECK (reserved_quantity >= 0)');
  pgm.addConstraint('inventory', 'inventory_sold_quantity_check',      'CHECK (sold_quantity >= 0)');
  pgm.createIndex('inventory', 'product_variant_id');

  // ── addresses ──────────────────────────────────────────────────────────────
  pgm.createTable('addresses', {
    id:           { type: 'serial', primaryKey: true },
    user_id:      { type: 'integer', notNull: true, references: '"users"', onDelete: 'CASCADE' },
    name:         { type: 'varchar(150)', notNull: true },
    phone:        { type: 'varchar(20)', notNull: true },
    address_line: { type: 'text', notNull: true },
    city:         { type: 'varchar(100)', notNull: true },
    state:        { type: 'varchar(100)', notNull: true },
    postal_code:  { type: 'varchar(20)', notNull: true },
    country:      { type: 'varchar(100)', notNull: true, default: 'India' },
    created_at:   { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at:   { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('addresses', 'user_id');

  // ── carts ──────────────────────────────────────────────────────────────────
  pgm.createTable('carts', {
    id:         { type: 'serial', primaryKey: true },
    user_id:    { type: 'integer', notNull: true, references: '"users"', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  // one active cart per user
  pgm.addConstraint('carts', 'carts_user_id_unique', 'UNIQUE (user_id)');

  pgm.createTable('cart_items', {
    id:                 { type: 'serial', primaryKey: true },
    cart_id:            { type: 'integer', notNull: true, references: '"carts"', onDelete: 'CASCADE' },
    product_variant_id: { type: 'integer', notNull: true, references: '"product_variants"', onDelete: 'CASCADE' },
    quantity:           { type: 'integer', notNull: true, default: 1 },
    created_at:         { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at:         { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('cart_items', 'cart_items_cart_variant_unique', 'UNIQUE (cart_id, product_variant_id)');
  pgm.addConstraint('cart_items', 'cart_items_quantity_check', 'CHECK (quantity > 0)');

  // ── wishlists ──────────────────────────────────────────────────────────────
  pgm.createTable('wishlists', {
    id:         { type: 'serial', primaryKey: true },
    user_id:    { type: 'integer', notNull: true, references: '"users"', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('wishlists', 'wishlists_user_id_unique', 'UNIQUE (user_id)');

  pgm.createTable('wishlist_items', {
    id:                 { type: 'serial', primaryKey: true },
    wishlist_id:        { type: 'integer', notNull: true, references: '"wishlists"', onDelete: 'CASCADE' },
    product_variant_id: { type: 'integer', notNull: true, references: '"product_variants"', onDelete: 'CASCADE' },
    created_at:         { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('wishlist_items', 'wishlist_items_wishlist_variant_unique', 'UNIQUE (wishlist_id, product_variant_id)');

  // ── coupons ────────────────────────────────────────────────────────────────
  pgm.createTable('coupons', {
    id:                   { type: 'serial', primaryKey: true },
    code:                 { type: 'varchar(50)', notNull: true, unique: true },
    discount_type:        { type: 'discount_type', notNull: true },
    discount_value:       { type: 'numeric(10,2)', notNull: true },
    minimum_order_amount: { type: 'numeric(12,2)', notNull: true, default: 0 },
    maximum_discount:     { type: 'numeric(12,2)' },
    usage_limit:          { type: 'integer' },
    used_count:           { type: 'integer', notNull: true, default: 0 },
    start_date:           { type: 'timestamptz', notNull: true },
    expiry_date:          { type: 'timestamptz', notNull: true },
    active:               { type: 'boolean', notNull: true, default: true },
    created_at:           { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('coupons', 'code');

  // ── reservations ───────────────────────────────────────────────────────────
  pgm.createTable('reservations', {
    id:                 { type: 'serial', primaryKey: true },
    user_id:            { type: 'integer', notNull: true, references: '"users"', onDelete: 'RESTRICT' },
    product_variant_id: { type: 'integer', notNull: true, references: '"product_variants"', onDelete: 'RESTRICT' },
    quantity:           { type: 'integer', notNull: true },
    status:             { type: 'reservation_status', notNull: true, default: 'RESERVED' },
    idempotency_key:    { type: 'varchar(255)', unique: true },
    expires_at:         { type: 'timestamptz', notNull: true },
    created_at:         { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at:         { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('reservations', 'reservations_quantity_check', 'CHECK (quantity > 0)');
  pgm.createIndex('reservations', 'user_id');
  pgm.createIndex('reservations', 'status');
  pgm.createIndex('reservations', 'expires_at');

  // ── orders ─────────────────────────────────────────────────────────────────
  pgm.createTable('orders', {
    id:              { type: 'serial', primaryKey: true },
    user_id:         { type: 'integer', notNull: true, references: '"users"', onDelete: 'RESTRICT' },
    address_id:      { type: 'integer', references: '"addresses"', onDelete: 'SET NULL' },
    coupon_id:       { type: 'integer', references: '"coupons"', onDelete: 'SET NULL' },
    status:          { type: 'order_status', notNull: true, default: 'CREATED' },
    subtotal:        { type: 'numeric(12,2)', notNull: true },
    discount_amount: { type: 'numeric(12,2)', notNull: true, default: 0 },
    total_amount:    { type: 'numeric(12,2)', notNull: true },
    created_at:      { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at:      { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('orders', 'user_id');

  pgm.createTable('order_items', {
    id:                 { type: 'serial', primaryKey: true },
    order_id:           { type: 'integer', notNull: true, references: '"orders"', onDelete: 'CASCADE' },
    product_variant_id: { type: 'integer', notNull: true, references: '"product_variants"', onDelete: 'RESTRICT' },
    reservation_id:     { type: 'integer', references: '"reservations"', onDelete: 'SET NULL' },
    quantity:           { type: 'integer', notNull: true },
    unit_price:         { type: 'numeric(12,2)', notNull: true },
    created_at:         { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('order_items', 'order_items_quantity_check', 'CHECK (quantity > 0)');

  // ── payments ───────────────────────────────────────────────────────────────
  pgm.createTable('payments', {
    id:                    { type: 'serial', primaryKey: true },
    user_id:               { type: 'integer', notNull: true, references: '"users"', onDelete: 'RESTRICT' },
    order_id:              { type: 'integer', references: '"orders"', onDelete: 'SET NULL' },
    reservation_id:        { type: 'integer', references: '"reservations"', onDelete: 'SET NULL' },
    amount:                { type: 'numeric(12,2)', notNull: true },
    payment_method:        { type: 'payment_method', notNull: true },
    transaction_reference: { type: 'varchar(255)', unique: true },
    status:                { type: 'payment_status', notNull: true, default: 'PENDING' },
    idempotency_key:       { type: 'varchar(255)' },
    created_at:            { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at:            { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('payments', 'transaction_reference');

  // ── reviews ────────────────────────────────────────────────────────────────
  pgm.createTable('reviews', {
    id:         { type: 'serial', primaryKey: true },
    user_id:    { type: 'integer', notNull: true, references: '"users"', onDelete: 'CASCADE' },
    product_id: { type: 'integer', notNull: true, references: '"products"', onDelete: 'CASCADE' },
    order_id:   { type: 'integer', references: '"orders"', onDelete: 'SET NULL' },
    rating:     { type: 'smallint', notNull: true },
    comment:    { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('reviews', 'reviews_rating_check', 'CHECK (rating BETWEEN 1 AND 5)');
  pgm.addConstraint('reviews', 'reviews_user_product_unique', 'UNIQUE (user_id, product_id)');
  pgm.createIndex('reviews', 'product_id');

  // ── idempotency_keys ───────────────────────────────────────────────────────
  pgm.createTable('idempotency_keys', {
    id:           { type: 'serial', primaryKey: true },
    key:          { type: 'varchar(255)', notNull: true, unique: true },
    user_id:      { type: 'integer', references: '"users"', onDelete: 'SET NULL' },
    operation:    { type: 'varchar(100)', notNull: true },
    request_hash: { type: 'varchar(64)' },
    status:       { type: 'idempotency_status', notNull: true, default: 'PROCESSING' },
    response:     { type: 'jsonb' },
    created_at:   { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at:   { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('idempotency_keys', 'key');
  pgm.createIndex('idempotency_keys', ['user_id', 'operation']);

  // ── outbox_events ──────────────────────────────────────────────────────────
  pgm.createTable('outbox_events', {
    id:             { type: 'serial', primaryKey: true },
    event_type:     { type: 'varchar(100)', notNull: true },
    aggregate_type: { type: 'varchar(100)', notNull: true },
    aggregate_id:   { type: 'varchar(100)', notNull: true },
    payload:        { type: 'jsonb', notNull: true },
    status:         { type: 'outbox_status', notNull: true, default: 'PENDING' },
    created_at:     { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    processed_at:   { type: 'timestamptz' },
  });
  pgm.createIndex('outbox_events', 'status');
};

exports.down = (pgm) => {
  pgm.dropTable('outbox_events');
  pgm.dropTable('idempotency_keys');
  pgm.dropTable('reviews');
  pgm.dropTable('payments');
  pgm.dropTable('order_items');
  pgm.dropTable('orders');
  pgm.dropTable('reservations');
  pgm.dropTable('coupons');
  pgm.dropTable('wishlist_items');
  pgm.dropTable('wishlists');
  pgm.dropTable('cart_items');
  pgm.dropTable('carts');
  pgm.dropTable('addresses');
  pgm.dropTable('inventory');
  pgm.dropTable('product_variants');
  pgm.dropTable('products');
  pgm.dropTable('categories');
  pgm.dropTable('users');
};
