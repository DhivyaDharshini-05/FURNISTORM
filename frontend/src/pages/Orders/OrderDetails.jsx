import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, Truck, Package, Clock, ShieldCheck, PenTool } from 'lucide-react';
import api from '../../services/api';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const OrderTimeline = ({ history = [], currentStatus }) => {
  const steps = [
    { key: 'CREATED', label: 'Order Placed' },
    { key: 'PAYMENT_PENDING', label: 'Payment' },
    { key: 'CONFIRMED', label: 'Confirmed' },
    { key: 'PROCESSING', label: 'Processing' },
    { key: 'SHIPPED', label: 'Shipped' },
    { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
    { key: 'DELIVERED', label: 'Delivered' }
  ];

  const currentIndex = steps.findIndex(s => s.key === currentStatus);

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '40px 0', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '15px', left: '0', right: '0', height: '2px', backgroundColor: 'var(--border-color)', zIndex: 0 }}>
        <div style={{ width: `${(Math.max(0, currentIndex) / (steps.length - 1)) * 100}%`, height: '100%', backgroundColor: 'var(--success)', transition: 'width 0.5s ease' }}></div>
      </div>
      
      {steps.map((step, index) => {
        const isCompleted = index <= currentIndex;
        const isCurrent = index === currentIndex;
        const hItem = history.find(h => h.status === step.key);
        
        return (
          <div key={step.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, width: '100px', textAlign: 'center' }}>
            <div style={{ 
              width: '32px', height: '32px', borderRadius: '50%', 
              backgroundColor: isCompleted ? 'var(--success)' : 'white', 
              border: `2px solid ${isCompleted ? 'var(--success)' : 'var(--border-color)'}`,
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              color: isCompleted ? 'white' : 'var(--light-text)',
              marginBottom: '10px'
            }}>
              {isCompleted ? <CheckCircle size={18} /> : (index + 1)}
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: isCurrent ? 'bold' : 'normal', color: isCurrent ? 'var(--text-color)' : 'var(--light-text)' }}>
              {step.label}
            </div>
            {hItem && (
              <div style={{ fontSize: '0.75rem', color: 'var(--light-text)', marginTop: '5px' }}>
                {new Date(hItem.changed_at).toLocaleDateString()}
              </div>
            )}
          </div>
        )
      })}
    </div>
  );
};

const OrderDetails = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [history, setHistory] = useState([]);
  const [installation, setInstallation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrderData = async () => {
      try {
        const [orderRes, statusRes, installRes] = await Promise.all([
          api.get(`/orders/${orderId}`),
          api.get(`/orders/${orderId}/status`),
          api.get(`/orders/${orderId}/installation`).catch(() => ({ data: null }))
        ]);
        
        setOrder(orderRes.data.order);
        setHistory(statusRes.data.history);
        setInstallation(installRes.data?.installation);
      } catch (err) {
        setError('Failed to load order details');
      } finally {
        setLoading(false);
      }
    };
    fetchOrderData();
  }, [orderId]);

  if (loading) return <LoadingSpinner fullScreen />;
  if (error) return <div className="alert alert-error mt-2">{error}</div>;
  if (!order) return null;

  return (
    <div style={{ marginTop: '30px', marginBottom: '80px' }}>
      <div className="flex justify-between align-center mb-2">
        <h1>Order #{order.id}</h1>
        <Link to="/orders" style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}>&larr; Back to Orders</Link>
      </div>
      
      <p style={{ color: 'var(--light-text)', marginBottom: '30px' }}>
        Placed on {new Date(order.created_at).toLocaleString()}
      </p>

      <div className="card" style={{ padding: '30px', marginBottom: '30px', overflowX: 'auto' }}>
        <h3 style={{ marginBottom: '20px' }}>Tracking Status</h3>
        <OrderTimeline history={history} currentStatus={order.status} />
      </div>

      {order.status === 'DELIVERED' && !installation && (
        <div className="card flex justify-between align-center" style={{ padding: '20px', marginBottom: '30px', backgroundColor: 'rgba(230, 126, 34, 0.05)', border: '1px solid rgba(230, 126, 34, 0.2)' }}>
          <div>
            <h3 style={{ color: 'var(--secondary-color)', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
              <PenTool size={20} /> Request Installation
            </h3>
            <p style={{ color: 'var(--text-color)', fontSize: '0.9rem' }}>Your order has been delivered! Need help putting it together?</p>
          </div>
          <Link to={`/orders/${order.id}/installation`} className="btn btn-secondary">Book Service</Link>
        </div>
      )}

      {installation && (
        <div className="card" style={{ padding: '20px', marginBottom: '30px', borderLeft: '4px solid var(--primary-color)' }}>
          <h3 style={{ marginBottom: '10px' }}>Installation Request ({installation.service_type})</h3>
          <p>Status: <strong style={{ color: 'var(--primary-color)' }}>{installation.status}</strong></p>
          {installation.scheduled_date && (
            <p>Scheduled: {new Date(installation.scheduled_date).toLocaleDateString()} {installation.time_slot && `(${installation.time_slot})`}</p>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '30px' }}>
        <div className="card" style={{ padding: '30px' }}>
          <h3 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Items</h3>
          {order.items.map(item => (
            <div key={item.id} className="flex justify-between align-center" style={{ marginBottom: '15px' }}>
              <div className="flex gap-2 align-center">
                <div style={{ width: '60px', height: '60px', backgroundColor: '#f1f2f6', borderRadius: '4px' }}></div>
                <div>
                  <div style={{ fontWeight: '500' }}>
                    <Link to={`/products/${item.product_id}`}>{item.product_name}</Link>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--light-text)' }}>Qty: {item.quantity} x ${item.unit_price}</div>
                </div>
              </div>
              <div style={{ fontWeight: 'bold' }}>
                ${(Number(item.unit_price) * item.quantity).toFixed(2)}
              </div>
            </div>
          ))}
          
          <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
            <div className="flex justify-between mb-2">
              <span style={{ color: 'var(--light-text)' }}>Subtotal</span>
              <span>${order.subtotal}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span style={{ color: 'var(--light-text)' }}>Discount</span>
              <span style={{ color: 'var(--success)' }}>-${order.discount_amount}</span>
            </div>
            <div className="flex justify-between mt-2" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
              <span>Total Paid</span>
              <span>${order.total_amount}</span>
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{ padding: '30px', marginBottom: '30px' }}>
            <h3 style={{ marginBottom: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Delivery Address</h3>
            {order.address_id ? (
              <p style={{ lineHeight: '1.6', color: 'var(--text-color)' }}>
                <strong>{order.address_name}</strong><br/>
                {order.address_line}<br/>
                {order.address_city}, {order.address_state} {order.address_postal_code}<br/>
                Phone: {order.address_phone}
              </p>
            ) : (
              <p style={{ color: 'var(--light-text)' }}>Address details unavailable.</p>
            )}
          </div>
          
          <div className="card" style={{ padding: '30px' }}>
            <h3 style={{ marginBottom: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Need Help?</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <button className="btn btn-outline" style={{ width: '100%' }}>Download Invoice</button>
              <button className="btn btn-outline" style={{ width: '100%' }}>Contact Support</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetails;
