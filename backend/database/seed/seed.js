'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── helpers ──────────────────────────────────────────────────────────────────
const q = (text, values) => pool.query(text, values);

async function insertCategory(name, description) {
  const { rows } = await q(
    `INSERT INTO categories (name, description)
     VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
     RETURNING id`,
    [name, description]
  );
  return rows[0].id;
}

async function insertProduct(p) {
  const { rows } = await q(
    `INSERT INTO products
       (category_id, name, description, brand, base_price, discount_price,
        material, style, color, length, width, height, weight, installation_available)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      p.category_id, p.name, p.description, p.brand,
      p.base_price, p.discount_price ?? null,
      p.material, p.style, p.color,
      p.length ?? null, p.width ?? null, p.height ?? null, p.weight ?? null,
      p.installation_available ?? false,
    ]
  );
  if (rows.length) return rows[0].id;
  const { rows: ex } = await q('SELECT id FROM products WHERE name=$1', [p.name]);
  return ex[0].id;
}

async function insertVariant(v) {
  const { rows } = await q(
    `INSERT INTO product_variants
       (product_id, sku, size, material, color, leg_type, additional_price)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (sku) DO NOTHING
     RETURNING id`,
    [v.product_id, v.sku, v.size ?? null, v.material ?? null,
     v.color ?? null, v.leg_type ?? null, v.additional_price ?? 0]
  );
  if (rows.length) return rows[0].id;
  const { rows: ex } = await q('SELECT id FROM product_variants WHERE sku=$1', [v.sku]);
  return ex[0].id;
}

async function insertInventory(variantId, available, reserved = 0, sold = 0) {
  await q(
    `INSERT INTO inventory (product_variant_id, available_quantity, reserved_quantity, sold_quantity)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (product_variant_id) DO UPDATE
       SET available_quantity = EXCLUDED.available_quantity,
           reserved_quantity  = EXCLUDED.reserved_quantity,
           sold_quantity      = EXCLUDED.sold_quantity`,
    [variantId, available, reserved, sold]
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('🌱  Seeding FURNISTORM database…');

  // ── categories ──────────────────────────────────────────────────────────────
  const catIds = {};
  const categories = [
    ['Sofas & Sectionals',  'Comfortable sofas, loveseats, and sectional sets'],
    ['Beds & Bedroom',      'Bed frames, headboards, and bedroom furniture'],
    ['Dining',              'Dining tables, chairs, and buffets'],
    ['Office & Study',      'Desks, office chairs, and bookshelves'],
    ['Storage & Shelving',  'Wardrobes, cabinets, and shelving units'],
    ['Outdoor & Garden',    'Patio furniture, garden chairs, and outdoor tables'],
    ['Kids & Youth',        'Bunk beds, study tables, and kids chairs'],
    ['Accent & Decor',      'Coffee tables, side tables, and accent chairs'],
  ];
  for (const [name, desc] of categories) {
    catIds[name] = await insertCategory(name, desc);
  }
  console.log('  ✔ categories');

  // ── products + variants + inventory ─────────────────────────────────────────
  const products = [
    // Sofas & Sectionals (6)
    { category: 'Sofas & Sectionals', name: 'Luxe 3-Seater Sofa',       brand: 'ComfortCraft', base_price: 45000, discount_price: 38000, material: 'Fabric',  style: 'Modern',      color: 'Grey',   installation_available: true,  length: 210, width: 90, height: 85, weight: 45 },
    { category: 'Sofas & Sectionals', name: 'Royal Chesterfield Sofa',  brand: 'HeritageFurn', base_price: 72000, discount_price: null,  material: 'Leather', style: 'Classic',     color: 'Brown',  installation_available: true,  length: 220, width: 95, height: 90, weight: 60 },
    { category: 'Sofas & Sectionals', name: 'Urban L-Shape Sectional',  brand: 'ComfortCraft', base_price: 89000, discount_price: 75000, material: 'Fabric',  style: 'Contemporary',color: 'Beige',  installation_available: true,  length: 280, width: 160,height: 85, weight: 90 },
    { category: 'Sofas & Sectionals', name: 'Compact 2-Seater Loveseat',brand: 'SpaceSaver',   base_price: 22000, discount_price: 18500, material: 'Velvet',  style: 'Modern',      color: 'Teal',   installation_available: false, length: 150, width: 80, height: 80, weight: 28 },
    { category: 'Sofas & Sectionals', name: 'Scandinavian Fabric Sofa', brand: 'NordicHome',   base_price: 38000, discount_price: 32000, material: 'Fabric',  style: 'Scandinavian',color: 'Cream',  installation_available: true,  length: 200, width: 88, height: 82, weight: 40 },
    { category: 'Sofas & Sectionals', name: 'Recliner Sofa Set',        brand: 'RelaxZone',    base_price: 95000, discount_price: 82000, material: 'Leather', style: 'Modern',      color: 'Black',  installation_available: true,  length: 240, width: 100,height: 100,weight: 80 },

    // Beds & Bedroom (6)
    { category: 'Beds & Bedroom', name: 'King Platform Bed',         brand: 'DreamSleep',   base_price: 35000, discount_price: 29000, material: 'Engineered Wood', style: 'Modern',   color: 'Walnut', installation_available: true,  length: 210, width: 195,height: 45, weight: 70 },
    { category: 'Beds & Bedroom', name: 'Queen Upholstered Bed',     brand: 'LuxeRest',     base_price: 28000, discount_price: null,  material: 'Fabric',          style: 'Classic',  color: 'Grey',   installation_available: true,  length: 215, width: 165,height: 120,weight: 55 },
    { category: 'Beds & Bedroom', name: 'Solid Wood Bed Frame',      brand: 'WoodCraft',    base_price: 42000, discount_price: 36000, material: 'Solid Wood',      style: 'Rustic',   color: 'Oak',    installation_available: true,  length: 215, width: 195,height: 50, weight: 85 },
    { category: 'Beds & Bedroom', name: 'Storage Bed with Drawers',  brand: 'SpaceSaver',   base_price: 48000, discount_price: 41000, material: 'Engineered Wood', style: 'Modern',   color: 'White',  installation_available: true,  length: 215, width: 165,height: 50, weight: 75 },
    { category: 'Beds & Bedroom', name: '6-Door Wardrobe',           brand: 'StoreMaster',  base_price: 55000, discount_price: 47000, material: 'Engineered Wood', style: 'Modern',   color: 'White',  installation_available: true,  length: 240, width: 60, height: 210,weight: 120 },
    { category: 'Beds & Bedroom', name: 'Bedside Table Set of 2',    brand: 'DreamSleep',   base_price: 8500,  discount_price: 7200,  material: 'Engineered Wood', style: 'Modern',   color: 'Walnut', installation_available: false, length: 45,  width: 40, height: 55, weight: 12 },

    // Dining (5)
    { category: 'Dining', name: '6-Seater Dining Table Set',   brand: 'TableCraft',   base_price: 52000, discount_price: 44000, material: 'Solid Wood',      style: 'Classic',  color: 'Teak',   installation_available: true,  length: 180, width: 90, height: 76, weight: 65 },
    { category: 'Dining', name: '4-Seater Glass Dining Set',   brand: 'ModernDine',   base_price: 32000, discount_price: 27000, material: 'Glass & Metal',   style: 'Modern',   color: 'Clear',  installation_available: true,  length: 140, width: 80, height: 76, weight: 40 },
    { category: 'Dining', name: 'Extendable Dining Table',     brand: 'TableCraft',   base_price: 38000, discount_price: null,  material: 'Engineered Wood', style: 'Modern',   color: 'White',  installation_available: true,  length: 160, width: 90, height: 76, weight: 50 },
    { category: 'Dining', name: 'Dining Chair Set of 4',       brand: 'SeatWell',     base_price: 14000, discount_price: 11500, material: 'Fabric & Wood',   style: 'Classic',  color: 'Beige',  installation_available: false, length: 45,  width: 50, height: 90, weight: 20 },
    { category: 'Dining', name: 'Bar Stool Set of 2',          brand: 'ModernDine',   base_price: 9500,  discount_price: 8000,  material: 'Metal & Leather', style: 'Industrial',color: 'Black', installation_available: false, length: 40,  width: 40, height: 75, weight: 10 },

    // Office & Study (4)
    { category: 'Office & Study', name: 'Executive Office Desk',    brand: 'WorkSpace',    base_price: 28000, discount_price: 23000, material: 'Engineered Wood', style: 'Modern',   color: 'Walnut', installation_available: true,  length: 160, width: 75, height: 76, weight: 45 },
    { category: 'Office & Study', name: 'Ergonomic Office Chair',   brand: 'ErgoSeat',     base_price: 18000, discount_price: 15000, material: 'Mesh & Nylon',    style: 'Modern',   color: 'Black',  installation_available: false, length: 65,  width: 65, height: 120,weight: 15 },
    { category: 'Office & Study', name: '5-Shelf Bookcase',         brand: 'WorkSpace',    base_price: 12000, discount_price: 9800,  material: 'Engineered Wood', style: 'Modern',   color: 'White',  installation_available: false, length: 80,  width: 30, height: 180,weight: 30 },
    { category: 'Office & Study', name: 'L-Shape Corner Desk',      brand: 'WorkSpace',    base_price: 22000, discount_price: 18500, material: 'Engineered Wood', style: 'Modern',   color: 'Oak',    installation_available: true,  length: 150, width: 150,height: 76, weight: 50 },

    // Storage & Shelving (3)
    { category: 'Storage & Shelving', name: 'Sliding Door Wardrobe',  brand: 'StoreMaster',  base_price: 62000, discount_price: 54000, material: 'Engineered Wood', style: 'Modern',   color: 'White',  installation_available: true,  length: 200, width: 60, height: 210,weight: 130 },
    { category: 'Storage & Shelving', name: 'Floating Wall Shelves',  brand: 'WallWise',     base_price: 4500,  discount_price: 3800,  material: 'MDF',             style: 'Minimalist',color: 'White', installation_available: true,  length: 90,  width: 20, height: 4,  weight: 3 },
    { category: 'Storage & Shelving', name: 'TV Unit with Storage',   brand: 'MediaHome',    base_price: 18000, discount_price: 15000, material: 'Engineered Wood', style: 'Modern',   color: 'Walnut', installation_available: false, length: 180, width: 40, height: 55, weight: 35 },

    // Outdoor & Garden (2)
    { category: 'Outdoor & Garden', name: '4-Seater Outdoor Dining Set', brand: 'OutdoorLux', base_price: 35000, discount_price: 29000, material: 'Teak Wood',  style: 'Classic',  color: 'Natural',installation_available: false, length: 120, width: 120,height: 76, weight: 40 },
    { category: 'Outdoor & Garden', name: 'Rattan Garden Sofa Set',      brand: 'OutdoorLux', base_price: 42000, discount_price: 36000, material: 'Rattan',     style: 'Tropical', color: 'Brown',  installation_available: false, length: 200, width: 80, height: 80, weight: 30 },

    // Kids & Youth (2)
    { category: 'Kids & Youth', name: 'Bunk Bed with Slide',    brand: 'KidZone',  base_price: 32000, discount_price: 27000, material: 'Solid Wood',      style: 'Playful',  color: 'Blue',   installation_available: true,  length: 200, width: 100,height: 160,weight: 60 },
    { category: 'Kids & Youth', name: 'Kids Study Table & Chair',brand: 'KidZone',  base_price: 8500,  discount_price: 7200,  material: 'Engineered Wood', style: 'Playful',  color: 'Yellow', installation_available: false, length: 90,  width: 55, height: 76, weight: 18 },

    // Accent & Decor (4)
    { category: 'Accent & Decor', name: 'Round Marble Coffee Table',  brand: 'AccentPlus',  base_price: 22000, discount_price: 18500, material: 'Marble & Metal', style: 'Luxury',   color: 'White',  installation_available: false, length: 90,  width: 90, height: 45, weight: 25 },
    { category: 'Accent & Decor', name: 'Accent Armchair',            brand: 'ComfortCraft',base_price: 16000, discount_price: 13500, material: 'Velvet',         style: 'Modern',   color: 'Mustard',installation_available: false, length: 80,  width: 80, height: 85, weight: 20 },
    { category: 'Accent & Decor', name: 'Nesting Side Tables Set',    brand: 'AccentPlus',  base_price: 7500,  discount_price: 6200,  material: 'Metal & Glass',  style: 'Modern',   color: 'Gold',   installation_available: false, length: 50,  width: 50, height: 55, weight: 8 },
    { category: 'Accent & Decor', name: 'Entryway Console Table',     brand: 'AccentPlus',  base_price: 12000, discount_price: 9800,  material: 'Solid Wood',     style: 'Rustic',   color: 'Oak',    installation_available: false, length: 120, width: 35, height: 80, weight: 15 },
  ];

  // track the flash-sale variant id for reporting
  let flashSaleVariantId = null;

  for (const p of products) {
    const productId = await insertProduct({ ...p, category_id: catIds[p.category] });

    // generate 2 variants per product
    const variants = [
      { product_id: productId, sku: `${p.name.replace(/\s+/g,'').toUpperCase().slice(0,10)}-STD`, size: 'Standard', material: p.material, color: p.color, leg_type: 'Wooden', additional_price: 0 },
      { product_id: productId, sku: `${p.name.replace(/\s+/g,'').toUpperCase().slice(0,10)}-PRE`, size: 'Premium',  material: p.material, color: p.color, leg_type: 'Metal',  additional_price: 2000 },
    ];

    for (const v of variants) {
      const variantId = await insertVariant(v);
      const isFlashSale = p.name === 'Luxe 3-Seater Sofa' && v.sku.endsWith('-STD');
      if (isFlashSale) {
        await insertInventory(variantId, 100, 0, 0);
        flashSaleVariantId = variantId;
      } else {
        const available = Math.floor(Math.random() * 40) + 10;
        await insertInventory(variantId, available, 0, Math.floor(Math.random() * 20));
      }
    }
  }
  console.log(`  ✔ products, variants, inventory  (flash-sale variant id: ${flashSaleVariantId})`);

  // ── test customer ────────────────────────────────────────────────────────────
  // password_hash is bcrypt of "Test@1234" — stored as placeholder (auth not implemented yet)
  await q(
    `INSERT INTO users (name, email, password_hash, phone)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (email) DO NOTHING`,
    ['Test Customer', 'test@furnistorm.com', '$2b$10$PLACEHOLDER_HASH_FOR_TEST_ACCOUNT_ONLY', '+91-9000000001']
  );
  console.log('  ✔ test user  (test@furnistorm.com)');

  // ── coupons ──────────────────────────────────────────────────────────────────
  const now = new Date();
  const future = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  const coupons = [
    { code: 'WELCOME10',  discount_type: 'PERCENTAGE', discount_value: 10, minimum_order_amount: 5000,  maximum_discount: 2000,  usage_limit: 1000 },
    { code: 'FLAT500',    discount_type: 'FLAT',        discount_value: 500,minimum_order_amount: 3000,  maximum_discount: null,  usage_limit: 500  },
    { code: 'SUMMER20',   discount_type: 'PERCENTAGE', discount_value: 20, minimum_order_amount: 10000, maximum_discount: 5000,  usage_limit: 200  },
    { code: 'FLASH15',    discount_type: 'PERCENTAGE', discount_value: 15, minimum_order_amount: 8000,  maximum_discount: 3000,  usage_limit: 100  },
    { code: 'NEWUSER25',  discount_type: 'PERCENTAGE', discount_value: 25, minimum_order_amount: 15000, maximum_discount: 8000,  usage_limit: 50   },
  ];
  for (const c of coupons) {
    await q(
      `INSERT INTO coupons
         (code, discount_type, discount_value, minimum_order_amount, maximum_discount, usage_limit, start_date, expiry_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (code) DO NOTHING`,
      [c.code, c.discount_type, c.discount_value, c.minimum_order_amount,
       c.maximum_discount, c.usage_limit, now, future]
    );
  }
  console.log('  ✔ coupons');

  console.log('\n✅  Seed complete.');
}

seed()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => pool.end());
