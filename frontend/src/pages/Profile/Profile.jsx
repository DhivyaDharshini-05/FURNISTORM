import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const Profile = () => {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);

  // For adding a quick fake address
  const handleAddDemoAddress = async () => {
    try {
      await api.post('/addresses', {
        name: user.name || 'Home',
        phone: '1234567890',
        address_line: '123 Demo Street',
        city: 'Demo City',
        state: 'Demo State',
        postal_code: '123456'
      });
      fetchAddresses();
    } catch (err) {
      alert('Failed to add address');
    }
  };

  const fetchAddresses = async () => {
    try {
      const response = await api.get('/addresses');
      setAddresses(response.data.addresses);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px' }}>My Profile</h1>
      
      <div className="card" style={{ padding: '30px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '80px', height: '80px', backgroundColor: 'var(--primary-color)', color: 'white', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2rem', fontWeight: 'bold' }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 style={{ marginBottom: '5px' }}>{user?.name}</h2>
            <p style={{ color: 'var(--light-text)' }}>{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between align-center mb-2">
        <h2>Saved Addresses</h2>
        <button onClick={handleAddDemoAddress} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.9rem' }}>
          + Add Demo Address
        </button>
      </div>
      
      {loading ? (
        <div className="loader"></div>
      ) : addresses.length === 0 ? (
        <div className="card text-center" style={{ padding: '40px 20px', color: 'var(--light-text)' }}>
          No addresses saved yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {addresses.map(addr => (
            <div key={addr.id} className="card" style={{ padding: '20px' }}>
              <h3 style={{ marginBottom: '10px' }}>{addr.name}</h3>
              <p style={{ color: 'var(--light-text)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                {addr.address_line}<br/>
                {addr.city}, {addr.state} {addr.postal_code}<br/>
                {addr.country}<br/>
                Phone: {addr.phone}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Profile;
