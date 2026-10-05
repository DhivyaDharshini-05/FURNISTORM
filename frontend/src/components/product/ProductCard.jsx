import React from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';

const ProductCard = ({ product }) => {
  return (
    <div className="card" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ height: '220px', backgroundColor: '#f1f2f6', position: 'relative' }}>
        {/* Placeholder for real image */}
        <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'white', padding: '6px', borderRadius: '50%', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
          <Heart size={18} color="#e74c3c" />
        </div>
        {product.discount_price && (
          <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'var(--error)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
            Sale
          </div>
        )}
      </div>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <p style={{ color: 'var(--light-text)', fontSize: '0.85rem', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {product.category_name}
        </p>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', lineHeight: '1.4' }}>
          <Link to={`/products/${product.id}`}>{product.name}</Link>
        </h3>
        
        <div style={{ marginTop: 'auto' }}>
          <div className="flex align-center gap-1 mb-2">
            <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--primary-color)' }}>
              ${product.discount_price || product.base_price}
            </span>
            {product.discount_price && (
              <span style={{ textDecoration: 'line-through', color: 'var(--light-text)', fontSize: '0.9rem' }}>
                ${product.base_price}
              </span>
            )}
          </div>
          <Link to={`/products/${product.id}`} className="btn btn-primary" style={{ width: '100%', padding: '10px' }}>
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
