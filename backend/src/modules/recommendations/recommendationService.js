const { pool } = require('../../config/database');

const WEIGHTS = {
  budget: 25,
  style: 20,
  room: 18,
  category: 17,
  material: 12,
  color: 8
};

const getRecommendations = async (filters) => {
  const { budget, style, room, category, material, color } = filters;

  // We fetch all products + their variants to score them
  const { rows: products } = await pool.query(
    `SELECT p.*, c.name as category_name,
            (SELECT MIN(base_price + additional_price) 
             FROM product_variants pv WHERE pv.product_id = p.id) as lowest_price
     FROM products p
     JOIN categories c ON c.id = p.category_id`
  );

  const scoredProducts = products.map(product => {
    let score = 0;
    
    // Budget (budget filter is a max budget)
    if (budget && product.lowest_price <= budget) {
      score += WEIGHTS.budget;
    }
    
    // Style (case-insensitive match)
    if (style && product.style && product.style.toLowerCase() === style.toLowerCase()) {
      score += WEIGHTS.style;
    }
    
    // Room - this might not exist as a column in products, maybe derived from category or name? 
    // Wait, let's assume 'room' might be embedded in category or style, or maybe there's no room column in products.
    // If room is missing in DB schema, we might match it against category name or description.
    // In our migration, products has category_id, name, description, brand, style, material, color. No 'room'.
    // Let's do a substring match on category_name, name, description.
    if (room && (
      (product.category_name && product.category_name.toLowerCase().includes(room.toLowerCase())) ||
      (product.name && product.name.toLowerCase().includes(room.toLowerCase())) ||
      (product.description && product.description.toLowerCase().includes(room.toLowerCase()))
    )) {
      score += WEIGHTS.room;
    }

    // Category
    if (category && product.category_name && product.category_name.toLowerCase() === category.toLowerCase()) {
      score += WEIGHTS.category;
    }
    
    // Material
    if (material && product.material && product.material.toLowerCase() === material.toLowerCase()) {
      score += WEIGHTS.material;
    }
    
    // Color
    if (color && product.color && product.color.toLowerCase() === color.toLowerCase()) {
      score += WEIGHTS.color;
    }

    return {
      product,
      score,
      matched_dimensions: {
        budget: budget && product.lowest_price <= budget,
        style: style && product.style && product.style.toLowerCase() === style.toLowerCase(),
        room: Boolean(room && ((product.category_name && product.category_name.toLowerCase().includes(room.toLowerCase())) || (product.name && product.name.toLowerCase().includes(room.toLowerCase())) || (product.description && product.description.toLowerCase().includes(room.toLowerCase())))),
        category: category && product.category_name && product.category_name.toLowerCase() === category.toLowerCase(),
        material: material && product.material && product.material.toLowerCase() === material.toLowerCase(),
        color: color && product.color && product.color.toLowerCase() === color.toLowerCase()
      }
    };
  });

  // Sort descending by score
  scoredProducts.sort((a, b) => b.score - a.score);

  // Assign ranking and normalize (normalize means out of 100, which it already is if max score is 100)
  // Actually, what if no filters are provided? 
  // Then score is 0.
  // The max possible score based on provided filters is sum of weights of provided filters.
  const providedWeightsSum = (budget ? WEIGHTS.budget : 0) + 
                             (style ? WEIGHTS.style : 0) + 
                             (room ? WEIGHTS.room : 0) + 
                             (category ? WEIGHTS.category : 0) + 
                             (material ? WEIGHTS.material : 0) + 
                             (color ? WEIGHTS.color : 0);

  const results = scoredProducts.map((p, index) => {
    // normalized score: if they only gave 'budget' and got it, they get 100%. 
    // Or just absolute score out of 100? The user said "normalized recommendation score from 0-100".
    // Absolute is fine. Let's just return score as is, up to 100.
    const normalizedScore = providedWeightsSum === 0 ? 0 : Math.round((p.score / providedWeightsSum) * 100);
    
    return {
      product: p.product,
      score: normalizedScore,
      matched_dimensions: p.matched_dimensions,
      ranking: index + 1
    };
  });

  return { recommendations: results };
};

module.exports = {
  getRecommendations
};
