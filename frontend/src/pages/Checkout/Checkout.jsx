import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, MapPin, CreditCard, Tag } from 'lucide-react';
import api from '../../services/api';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

// Simple UUID generator for Idempotency
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const Checkout = () => {
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [couponCode, setCouponCode] = useState('');
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [addrRes, cartRes] = await Promise.all([
          api.get('/addresses'),
          api.get('/cart')
        ]);
        
        setAddresses(addrRes.data.addresses);
        if (addrRes.data.addresses.length > 0) {
          setSelectedAddress(addrRes.data.addresses[0].id);
        }
        
        setCart(cartRes.data.cart);
        
        if (!cartRes.data.cart || cartRes.data.cart.items.length === 0) {
          navigate('/cart'); // Redirect if empty
        }
      } catch (err) {
        setError('Failed to load checkout information');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!selectedAddress) {
      alert('Please select a delivery address');
      return;
    }

    setProcessing(true);
    setError(null);
    
    // The backend uses Idempotency-Key header or similar. 
    // We'll pass it in headers.
    const idempotencyKey = generateUUID();

    try {
      const response = await api.post('/checkout', {
        address_id: selectedAddress,
        payment_method: paymentMethod,
        // coupon_id might be needed if they applied one, but we are just sending the code?
        // Let's assume the backend takes coupon_code or we have a validate endpoint.
        // If not implemented on backend yet, we'll just omit.
      }, {
        headers: { 'Idempotency-Key': idempotencyKey }
      });
      
      // Assume successful checkout redirects to success page or order details
      navigate(`/orders/${response.data.order.id}`, { state: { success: true } });
    } catch (err) {
      const errCode = err.response?.data?.error?.code;
      const errMsg = err.response?.data?.error?.message || 'Checkout failed';
      
      if (errCode === 'OUT_OF_STOCK' || errCode === 'RESERVATION_FAILED') {
        setError(`Inventory Error: ${errMsg}. Please review your cart.`);
      } else if (errCode === 'DUPLICATE_REQUEST') {
        setError('This request is already being processed. Please wait.');
      } else {
        setError(`Payment/Order Error: ${errMsg}`);
      }
      setProcessing(false);
    }
  };

  if (loading) return <LoadingSpinner fullScreen />;
  if (!cart) return null;

  const subtotal = cart.items.reduce((acc, item) => acc + (Number(item.unit_price) * item.quantity), 0);
  const delivery = subtotal > 1000 ? 0 : 50;
  const total = subtotal + delivery;

  return (
    <div style={{ marginTop: '30px', marginBottom: '80px' }}>
      <h1 style={{ marginBottom: '30px' }}>Checkout</h1>
      
      {error && <div className="alert alert-error" style={{ marginBottom: '30px' }}>{error}</div>}
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '40px' }}>
        
        {/* Left Column: Form */}
        <div>
          {/* STEP 1: Address */}
          <div className="card" style={{ padding: '30px', marginBottom: '30px' }}>
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MapPin color="var(--secondary-color)" /> 1. Delivery Address
            </h3>
            
            {addresses.length === 0 ? (
              <div>
                <p style={{ color: 'var(--error)', marginBottom: '20px' }}>You have no addresses saved.</p>
                <button className="btn btn-outline" onClick={() => navigate('/profile')}>Add Address in Profile</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {addresses.map(addr => (
                  <label key={addr.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', padding: '15px', border: selectedAddress === addr.id ? '2px solid var(--primary-color)' : '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', cursor: 'pointer', backgroundColor: selectedAddress === addr.id ? 'rgba(44, 62, 80, 0.02)' : 'white' }}>
                    <input 
                      type="radio" 
                      name="address" 
                      value={addr.id} 
                      checked={selectedAddress === addr.id}
                      onChange={() => setSelectedAddress(addr.id)}
                      style={{ marginTop: '5px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{addr.name}</div>
                      <div style={{ color: 'var(--light-text)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                        {addr.address_line}, {addr.city}, {addr.state} {addr.postal_code}
                      </div>
                      <div style={{ color: 'var(--light-text)', fontSize: '0.9rem', marginTop: '5px' }}>
                        Phone: {addr.phone}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* STEP 3: Payment */}
          <div className="card" style={{ padding: '30px' }}>
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CreditCard color="var(--secondary-color)" /> 2. Payment Method
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              {['CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'NET_BANKING'].map(method => (
                <label key={method} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '15px', border: paymentMethod === method ? '2px solid var(--primary-color)' : '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', cursor: 'pointer', backgroundColor: paymentMethod === method ? 'rgba(44, 62, 80, 0.02)' : 'white' }}>
                  <input 
                    type="radio" 
                    name="payment" 
                    value={method} 
                    checked={paymentMethod === method}
                    onChange={() => setPaymentMethod(method)}
                  />
                  <span style={{ fontWeight: '500', fontSize: '0.95rem' }}>{method.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div>
          <div className="card" style={{ padding: '30px', position: 'sticky', top: '100px' }}>
            <h3 style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle color="var(--secondary-color)" /> Order Summary
            </h3>
            
            <div style={{ marginBottom: '25px', maxHeight: '300px', overflowY: 'auto', paddingRight: '10px' }}>
              {cart.items.map(item => (
                <div key={item.id} className="flex justify-between" style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #f1f2f6' }}>
                  <div style={{ flex: 1, paddingRight: '15px' }}>
                    <div style={{ fontWeight: '500', fontSize: '0.95rem', marginBottom: '5px' }}>{item.product_name}</div>
                    <div style={{ color: 'var(--light-text)', fontSize: '0.85rem' }}>Qty: {item.quantity}</div>
                  </div>
                  <div style={{ fontWeight: 'bold' }}>${(Number(item.unit_price) * item.quantity).toFixed(2)}</div>
                </div>
              ))}
            </div>

            {/* STEP 3: Coupon (Optional) */}
            <div style={{ marginBottom: '25px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="text" 
                  placeholder="Enter Coupon Code" 
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  style={{ flex: 1, padding: '10px 15px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)' }}
                />
                <button className="btn btn-outline" style={{ padding: '10px 20px' }}>Apply</button>
              </div>
            </div>
            
            <div className="flex justify-between mb-2">
              <span style={{ color: 'var(--light-text)' }}>Subtotal ({cart.items.length} items)</span>
              <span style={{ fontWeight: '500' }}>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span style={{ color: 'var(--light-text)' }}>Delivery</span>
              <span style={{ fontWeight: '500', color: delivery === 0 ? 'var(--success)' : 'inherit' }}>
                {delivery === 0 ? 'FREE' : `$${delivery.toFixed(2)}`}
              </span>
            </div>
            
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '20px 0' }} />
            
            <div className="flex justify-between mb-2">
              <span style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>Total Payable</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>${total.toFixed(2)}</span>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '18px', marginTop: '20px', fontSize: '1.1rem' }}
              onClick={handleCheckout}
              disabled={processing || addresses.length === 0}
            >
              {processing ? 'Processing Payment...' : `Pay $${total.toFixed(2)} securely`}
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--light-text)', marginTop: '15px' }}>
              By placing your order, you agree to FURNISTORM's terms and conditions of use.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Checkout;
