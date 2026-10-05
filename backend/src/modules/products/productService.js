const { pool } = require('../../config/database');
const { cacheGet, cacheSet } = require('../../utils/cache');

const PRODUCT_TTL = 300;
const LIST_TTL    = 60;

const SORT_MAP = {
  price_asc:       'COALESCE(p.discount_price, p.base_price) ASC',
  price_desc:      'COALESCE(p.discount_price, p.base_price) DESC',
  name_asc:        'p.name ASC',
  name_desc:       'p.name DESC',
  created_at_desc: 'p.created_at DESC',
  created_at_asc:  'p.created_at ASC',
};

// builds WHERE clause + params array from query filters
const buildFilters = ({ search, category, brand, style, color, material, min_price, max_price }) => {
  const params     = [];
  const conditions = [];
  const p = (val) => { params.push(val); return `$${params.length}`; };

  if (search) {
    const s = `%${search}%`;
    conditions.push(`(p.name ILIKE ${p(s)} OR p.description ILIKE ${p(s)} OR p.brand ILIKE ${p(s)})`);
  }
  if (category)  conditions.push(`c.id = ${p(parseInt(category))}`);
  if (brand)     conditions.push(`p.brand    ILIKE ${p(`%${brand}%`)}`);
  if (style)     conditions.push(`p.style    ILIKE ${p(`%${style}%`)}`);
  if (color)     conditions.push(`p.color    ILIKE ${p(`%${color}%`)}`);
  if (material)  conditions.push(`p.material ILIKE ${p(`%${material}%`)}`);
  if (min_price) conditions.push(`COALESCE(p.discount_price, p.base_price) >= ${p(parseFloat(min_price))}`);
  if (max_price) conditions.push(`COALESCE(p.discount_price, p.base_price) <= ${p(parseFloat(max_price))}`);

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
};

// ── list: search + filters + sort + pagination ────────────────────────────────
const getAll = async (query) => {
  const {
    search    = '',
    category  = '',
    brand     = '',
    style     = '',
    color     = '',
    material  = '',
    min_price = '',
    max_price = '',
    sort      = 'created_at_desc',
    page      = 1,
    limit     = 12,
  } = query;

  const pageNum  = Math.max(1, parseInt(page)  || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 12));
  const offset   = (pageNum - 1) * limitNum;

  const cacheKey = `products:list:${JSON.stringify({ search, category, brand, style, color, material, min_price, max_price, sort, pageNum, limitNum })}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const { where, params } = buildFilters({ search, category, brand, style, color, material, min_price, max_price });
  const orderBy = SORT_MAP[sort] || SORT_MAP.created_at_desc;

  const joinClause = `FROM products p JOIN categories c ON c.id = p.category_id ${where}`;

  // pagination params appended only for data query
  const dataParams = [...params, limitNum, offset];
  const li = params.length + 1; // LIMIT index
  const oi = params.length + 2; // OFFSET index

  const [dataRes, countRes] = await Promise.all([
    pool.query(
      `SELECT
         p.id, p.name, p.description, p.brand,
         p.base_price, p.discount_price,
         p.material, p.style, p.color,
         p.length, p.width, p.height, p.weight,
         p.installation_available, p.created_at,
         c.id AS category_id, c.name AS category_name
       ${joinClause}
       ORDER BY ${orderBy}
       LIMIT $${li} OFFSET $${oi}`,
      dataParams
    ),
    pool.query(`SELECT COUNT(*) AS total ${joinClause}`, params),
  ]);

  const total      = parseInt(countRes.rows[0].total);
  const totalPages = Math.ceil(total / limitNum);

  const result = {
    products:   dataRes.rows,
    pagination: { total, page: pageNum, limit: limitNum, totalPages },
  };

  await cacheSet(cacheKey, result, LIST_TTL);
  return { ...result, fromCache: false };
};

// ── single product ─────────────────────────────────────────────────────────────
const getById = async (id) => {
  const cacheKey = `products:${id}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return { product: cached, fromCache: true };

  const { rows } = await pool.query(
    `SELECT
       p.id, p.name, p.description, p.brand,
       p.base_price, p.discount_price,
       p.material, p.style, p.color,
       p.length, p.width, p.height, p.weight,
       p.installation_available, p.created_at, p.updated_at,
       c.id AS category_id, c.name AS category_name
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1`,
    [id]
  );

  if (!rows.length) {
    const err = new Error('Product not found');
    err.statusCode = 404;
    err.code = 'PRODUCT_NOT_FOUND';
    throw err;
  }

  await cacheSet(cacheKey, rows[0], PRODUCT_TTL);
  return { product: rows[0], fromCache: false };
};

// ── variants for a product ────────────────────────────────────────────────────
const getVariants = async (productId) => {
  const cacheKey = `products:${productId}:variants`;
  const cached = await cacheGet(cacheKey);
  if (cached) return { variants: cached, fromCache: true };

  const check = await pool.query('SELECT id FROM products WHERE id = $1', [productId]);
  if (!check.rows.length) {
    const err = new Error('Product not found');
    err.statusCode = 404;
    err.code = 'PRODUCT_NOT_FOUND';
    throw err;
  }

  const { rows } = await pool.query(
    `SELECT
       pv.id, pv.sku, pv.size, pv.material, pv.color, pv.leg_type,
       pv.additional_price, pv.created_at,
       i.available_quantity, i.reserved_quantity, i.sold_quantity
     FROM product_variants pv
     LEFT JOIN inventory i ON i.product_variant_id = pv.id
     WHERE pv.product_id = $1
     ORDER BY pv.id ASC`,
    [productId]
  );

  await cacheSet(cacheKey, rows, PRODUCT_TTL);
  return { variants: rows, fromCache: false };
};

// ── filter options for UI dropdowns ──────────────────────────────────────────
const getFilterOptions = async () => {
  const cacheKey = 'products:filters';
  const cached = await cacheGet(cacheKey);
  if (cached) return { filters: cached, fromCache: true };

  const [brands, styles, colors, materials, priceRange] = await Promise.all([
    pool.query('SELECT DISTINCT brand    FROM products WHERE brand    IS NOT NULL ORDER BY brand'),
    pool.query('SELECT DISTINCT style    FROM products WHERE style    IS NOT NULL ORDER BY style'),
    pool.query('SELECT DISTINCT color    FROM products WHERE color    IS NOT NULL ORDER BY color'),
    pool.query('SELECT DISTINCT material FROM products WHERE material IS NOT NULL ORDER BY material'),
    pool.query('SELECT MIN(COALESCE(discount_price, base_price)) AS min_price, MAX(COALESCE(discount_price, base_price)) AS max_price FROM products'),
  ]);

  const filters = {
    brands:    brands.rows.map((r) => r.brand),
    styles:    styles.rows.map((r) => r.style),
    colors:    colors.rows.map((r) => r.color),
    materials: materials.rows.map((r) => r.material),
    price:     priceRange.rows[0],
  };

  await cacheSet(cacheKey, filters, 600);
  return { filters, fromCache: false };
};

module.exports = { getAll, getById, getVariants, getFilterOptions };
