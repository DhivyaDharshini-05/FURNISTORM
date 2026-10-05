import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PenTool, Calendar, Clock, CheckCircle } from 'lucide-react';
import api from '../../services/api';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const Installation = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);
  
  const [form, setForm] = useState({
    service_type: 'Basic',
    scheduled_date: '',
    time_slot: '10:00 AM - 12:00 PM'
  });

  const [existingInstall, setExistingInstall] = useState(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const orderRes = await api.get(`/orders/${orderId}`);
        setOrder(orderRes.data.order);
        
        if (orderRes.data.order.status !== 'DELIVERED') {
          setError('Installation can only be booked for delivered orders.');
        }

        try {
          const instRes = await api.get(`/orders/${orderId}/installation`);
          if (instRes.data.installation) {
            setExistingInstall(instRes.data.installation);
          }
        } catch (e) {
          // No existing installation, which is fine
        }
      } catch (err) {
        setError('Failed to load order details');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await api.post(`/orders/${orderId}/installation`, form);
      navigate(`/orders/${orderId}`);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to book installation');
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner fullScreen />;
  if (!order) return <div className="alert alert-error mt-2">{error || 'Order not found'}</div>;

  if (existingInstall) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }} className="card">
        <CheckCircle size={48} color="var(--success)" style={{ margin: '30px auto 20px' }} />
        <h2>Installation Already Booked</h2>
        <p style={{ margin: '20px 0', color: 'var(--light-text)' }}>
          You have already booked an installation for this order.
        </p>
        <div style={{ backgroundColor: 'var(--bg-color)', padding: '20px', borderRadius: 'var(--border-radius)', marginBottom: '30px', textAlign: 'left' }}>
          <p><strong>Service Type:</strong> {existingInstall.service_type}</p>
          <p><strong>Status:</strong> {existingInstall.status}</p>
          {existingInstall.scheduled_date && (
            <p><strong>Scheduled:</strong> {new Date(existingInstall.scheduled_date).toLocaleDateString()} {existingInstall.time_slot && `(${existingInstall.time_slot})`}</p>
          )}
        </div>
        <button className="btn btn-outline mb-2" onClick={() => navigate(`/orders/${orderId}`)}>Back to Order</button>
      </div>
    );
  }

  if (order.status !== 'DELIVERED') {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }} className="card">
        <h2 style={{ marginTop: '20px', marginBottom: '20px' }}>Installation Unavailable</h2>
        <p style={{ color: 'var(--error)', marginBottom: '30px' }}>{error}</p>
        <button className="btn btn-primary mb-2" onClick={() => navigate(`/orders/${orderId}`)}>Back to Order</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
          <PenTool size={32} color="var(--secondary-color)" /> Book Installation
        </h1>
        <p style={{ color: 'var(--light-text)', marginTop: '10px' }}>Order #{order.id}</p>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ padding: '40px' }}>
        {error && <div className="alert alert-error" style={{ marginBottom: '20px' }}>{error}</div>}
        
        <h3 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>1. Select Service</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '30px' }}>
          {['Basic', 'Full', 'Premium', 'Self-Guided'].map(type => (
            <label key={type} style={{ padding: '15px', border: form.service_type === type ? '2px solid var(--primary-color)' : '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', cursor: 'pointer', textAlign: 'center', backgroundColor: form.service_type === type ? 'rgba(44, 62, 80, 0.05)' : 'white' }}>
              <input 
                type="radio" 
                name="service_type" 
                value={type} 
                checked={form.service_type === type}
                onChange={handleChange}
                style={{ display: 'none' }}
              />
              <span style={{ fontWeight: 'bold' }}>{type}</span>
            </label>
          ))}
        </div>

        <h3 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>2. Schedule Appointment</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Calendar size={16} /> Date</label>
            <input 
              type="date" 
              name="scheduled_date" 
              value={form.scheduled_date} 
              onChange={handleChange} 
              required
              min={new Date().toISOString().split('T')[0]} // Today onwards
            />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Clock size={16} /> Time Slot</label>
            <select name="time_slot" value={form.time_slot} onChange={handleChange} required>
              <option value="08:00 AM - 10:00 AM">08:00 AM - 10:00 AM</option>
              <option value="10:00 AM - 12:00 PM">10:00 AM - 12:00 PM</option>
              <option value="12:00 PM - 02:00 PM">12:00 PM - 02:00 PM</option>
              <option value="02:00 PM - 04:00 PM">02:00 PM - 04:00 PM</option>
              <option value="04:00 PM - 06:00 PM">04:00 PM - 06:00 PM</option>
            </select>
          </div>
        </div>

        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ width: '100%', padding: '15px', fontSize: '1.1rem' }}
          disabled={submitting}
        >
          {submitting ? 'Booking...' : 'Confirm Installation'}
        </button>
      </form>
    </div>
  );
};

export default Installation;
