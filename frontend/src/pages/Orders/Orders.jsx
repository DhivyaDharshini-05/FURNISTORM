import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await api.get('/orders');
        setOrders(response.data.orders);
      } catch (err) {
        setError('Failed to load orders');
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  if (loading) return <div className="loader"></div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      <h1 style={{ marginBottom: '20px' }}>My Orders</h1>
      
      {orders.length === 0 ? (
        <div className="card text-center" style={{ padding: '60px 20px' }}>
          <h3 style={{ marginBottom: '15px' }}>No orders found</h3>
          <p style={{ color: 'var(--light-text)', marginBottom: '25px' }}>You haven't placed any orders yet.</p>
          <Link to="/products" className="btn btn-primary">Start Shopping</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {orders.map(order => (
            <div key={order.id} className="card flex justify-between align-center" style={{ padding: '20px' }}>
              <div>
                <h3 style={{ marginBottom: '5px' }}>Order #{order.id}</h3>
                <p style={{ color: 'var(--light-text)', fontSize: '0.9rem' }}>
                  Placed on: {new Date(order.created_at).toLocaleDateString()}
                </p>
                <div style={{ 
                  display: 'inline-block', 
                  padding: '4px 8px', 
                  backgroundColor: 'var(--bg-color)', 
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  marginTop: '10px'
                }}>
                  {order.status}
                </div>
              </div>
              <div className="text-center">
                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '10px' }}>
                  ${order.total_amount}
                </div>
                {/* We don't have individual order view yet, but could link to it */}
                {/* <Link to={`/orders/${order.id}`} className="btn btn-outline">View Details</Link> */}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Orders;
