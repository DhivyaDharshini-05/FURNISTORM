import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, ShoppingCart } from 'lucide-react';
import api from '../../services/api';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';

const Wishlist = () => {
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWishlist = async () => {
    try {
      const response = await api.get('/wishlist');
      setWishlist(response.data.wishlist || response.data.items || []);
    } catch (err) {
      if (err.response?.status === 404) {
        // Backend API doesn't exist yet, that's fine.
        setWishlist([]);
      } else {
        setError('Failed to load wishlist');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlist();
  }, []);

  const handleRemove = async (itemId) => {
    try {
      await api.delete(`/wishlist/${itemId}`);
      setWishlist(wishlist.filter(item => item.id !== itemId));
    } catch (err) {
      alert('Failed to remove from wishlist');
    }
  };

  const handleMoveToCart = async (item) => {
    try {
      await api.post('/cart/items', { product_variant_id: item.product_variant_id, quantity: 1 });
      await handleRemove(item.id);
      alert('Moved to cart!');
    } catch (err) {
      alert('Failed to move to cart. It might be out of stock.');
    }
  };

  if (loading) return <LoadingSpinner fullScreen />;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div style={{ marginTop: '30px', marginBottom: '80px', maxWidth: '1000px', margin: '30px auto' }}>
      <h1 style={{ marginBottom: '30px' }}>My Wishlist</h1>
      
      {wishlist.length === 0 ? (
        <EmptyState 
          title="Your wishlist is empty" 
          message="Save items you love to your wishlist to review them later or track their prices."
          actionText="Explore Furniture"
          actionLink="/products"
        />
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {wishlist.map(item => (
            <div key={item.id} className="card flex justify-between align-center" style={{ padding: '20px' }}>
              <div className="flex align-center gap-2">
                <div style={{ width: '100px', height: '100px', backgroundColor: '#f1f2f6', borderRadius: '4px' }}></div>
                <div>
                  <h3 style={{ marginBottom: '5px' }}>
                    <Link to={`/products/${item.product_id}`}>{item.product_name}</Link>
                  </h3>
                  <p style={{ color: 'var(--light-text)', fontSize: '0.9rem', marginBottom: '10px' }}>{item.category_name}</p>
                  <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--primary-color)' }}>
                    ${item.price}
                  </div>
                </div>
              </div>
              <div className="flex" style={{ flexDirection: 'column', gap: '10px' }}>
                <button 
                  className="btn btn-primary flex align-center justify-center gap-1" 
                  onClick={() => handleMoveToCart(item)}
                >
                  <ShoppingCart size={16} /> Move to Cart
                </button>
                <button 
                  className="btn flex align-center justify-center gap-1" 
                  onClick={() => handleRemove(item.id)}
                  style={{ border: '1px solid var(--border-color)', color: 'var(--error)' }}
                >
                  <Trash2 size={16} /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Wishlist;
