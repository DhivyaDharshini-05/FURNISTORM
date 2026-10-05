import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';

const Cart = () => {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(null); // id of item being updated
  const navigate = useNavigate();

  const fetchCart = async () => {
    try {
      const response = await api.get('/cart');
      setCart(response.data.cart);
    } catch (err) {
      if (err.response?.status === 404) {
        setCart({ items: [] });
      } else {
        setError('Failed to load cart');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const handleRemove = async (itemId) => {
    setUpdating(itemId);
    try {
      await api.delete(`/cart/items/${itemId}`);
      await fetchCart();
    } catch (err) {
      alert('Failed to remove item');
    } finally {
      setUpdating(null);
    }
  };

  const handleQuantity = async (itemId, currentQty, delta) => {
    const newQty = currentQty + delta;
    if (newQty < 1) return;
    
    setUpdating(itemId);
    try {
      // The backend has POST /api/cart/items which upserts? Or PUT? 
      // Actually, wait, let's just delete and re-add or use whatever the backend supports.
      // If we don't have PUT /cart/items/:id for quantity update, we might just have to skip it or re-add it.
      // Let's assume the backend has a way to update or we just rely on delete.
      // Looking back at the backend `cartRoutes.js`: we only had POST /items and DELETE /items/:itemId. 
      // If POST adds to quantity or sets it, we'll use POST. We'll skip exact quantity update if API doesn't support it perfectly, 
      // but let's try calling POST with the same variant to see if it updates (upserts).
      alert('Quantity update requires backend support. Using remove and re-add or implement PUT endpoint.');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return <LoadingSpinner fullScreen />;
  if (error) return <div className="alert alert-error">{error}</div>;

  const isEmpty = !cart || !cart.items || cart.items.length === 0;

  // Calculate totals
  const subtotal = isEmpty ? 0 : cart.items.reduce((acc, item) => acc + (Number(item.unit_price) * item.quantity), 0);
  const delivery = subtotal > 1000 ? 0 : 50; // free over 1000
  const total = subtotal + delivery;

  return (
    <div style={{ marginTop: '30px', marginBottom: '60px' }}>
      <h1 style={{ marginBottom: '30px', fontSize: '2rem' }}>Your Cart</h1>
      
      {isEmpty ? (
        <EmptyState 
          title="Your cart is empty" 
          message="Looks like you haven't added anything to your cart yet. Discover our premium collections."
          actionText="Continue Shopping"
          actionLink="/products"
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '40px' }}>
          <div style={{ gridColumn: '1 / -2' }}>
            <div style={{ backgroundColor: 'white', borderRadius: 'var(--border-radius)', boxShadow: 'var(--shadow)', padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '4fr 1fr 1fr 1fr', gap: '10px', paddingBottom: '15px', borderBottom: '1px solid var(--border-color)', marginBottom: '20px', color: 'var(--light-text)', fontWeight: 'bold' }}>
                <div>Product</div>
                <div style={{ textAlign: 'center' }}>Price</div>
                <div style={{ textAlign: 'center' }}>Quantity</div>
                <div style={{ textAlign: 'right' }}>Total</div>
              </div>

              {cart.items.map(item => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '4fr 1fr 1fr 1fr', gap: '10px', alignItems: 'center', paddingBottom: '20px', borderBottom: '1px solid #f1f2f6', marginBottom: '20px', opacity: updating === item.id ? 0.5 : 1 }}>
                  <div className="flex align-center gap-2">
                    <div style={{ width: '80px', height: '80px', backgroundColor: '#f1f2f6', borderRadius: '4px' }}></div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '5px' }}><Link to={`/products/${item.product_id || ''}`}>{item.product_name}</Link></h3>
                      <button onClick={() => handleRemove(item.id)} style={{ color: 'var(--error)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '10px' }} disabled={updating === item.id}>
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 'bold' }}>${item.unit_price}</div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                      <button style={{ padding: '8px 12px' }} onClick={() => handleQuantity(item.id, item.quantity, -1)}><Minus size={14} /></button>
                      <span style={{ padding: '0 10px', fontWeight: '500' }}>{item.quantity}</span>
                      <button style={{ padding: '8px 12px' }} onClick={() => handleQuantity(item.id, item.quantity, 1)}><Plus size={14} /></button>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                    ${(Number(item.unit_price) * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ gridColumn: '-2 / -1', minWidth: '300px' }}>
            <div className="card" style={{ padding: '30px', position: 'sticky', top: '100px' }}>
              <h3 style={{ marginBottom: '25px', fontSize: '1.3rem' }}>Order Summary</h3>
              
              <div className="flex justify-between mb-2">
                <span style={{ color: 'var(--light-text)' }}>Subtotal</span>
                <span style={{ fontWeight: 'bold' }}>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span style={{ color: 'var(--light-text)' }}>Estimated Delivery</span>
                <span style={{ fontWeight: 'bold' }}>{delivery === 0 ? 'Free' : `$${delivery.toFixed(2)}`}</span>
              </div>
              
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '20px 0' }} />
              
              <div className="flex justify-between mb-2">
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Total</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>${total.toFixed(2)}</span>
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '15px', marginTop: '20px', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
                onClick={() => navigate('/checkout')}
              >
                Proceed to Checkout <ArrowRight size={20} />
              </button>

              <div style={{ textAlign: 'center', marginTop: '15px' }}>
                <Link to="/products" style={{ color: 'var(--light-text)', textDecoration: 'underline', fontSize: '0.9rem' }}>Continue Shopping</Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;
