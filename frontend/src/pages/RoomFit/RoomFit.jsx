import React, { useState } from 'react';
import api from '../../services/api';
import { Ruler, Maximize, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

const RoomFit = () => {
  const [form, setForm] = useState({
    roomWidth: '',
    roomLength: '',
    furnitureWidth: '',
    furnitureDepth: '',
    clearance: ''
  });
  
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCalculate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await api.post('/room-fit/validate', {
        room_width: Number(form.roomWidth),
        room_length: Number(form.roomLength),
        furniture_width: Number(form.furnitureWidth),
        furniture_depth: Number(form.furnitureDepth),
        minimum_clearance: Number(form.clearance)
      });
      setResult(response.data);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        // Fallback if endpoint is different
        try {
          const res2 = await api.post('/room-fit', form);
          setResult(res2.data);
        } catch (e2) {
          setError('Failed to calculate room fit. ' + (e2.response?.data?.error?.message || ''));
        }
      } else {
        setError(err.response?.data?.error?.message || 'Failed to calculate room fit');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'FITS_WELL': return <CheckCircle size={40} color="var(--success)" />;
      case 'TIGHT_FIT': return <AlertTriangle size={40} color="#f39c12" />;
      case 'DOES_NOT_FIT': return <XCircle size={40} color="var(--error)" />;
      default: return null;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'FITS_WELL': return 'Fits Well';
      case 'TIGHT_FIT': return 'Tight Fit';
      case 'DOES_NOT_FIT': return 'Does Not Fit';
      default: return 'Unknown';
    }
  };

  return (
    <div style={{ marginTop: '30px', marginBottom: '80px', maxWidth: '1000px', margin: '30px auto 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ marginBottom: '15px', color: 'var(--primary-color)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
          <Maximize size={32} color="var(--secondary-color)" /> Room Fit Calculator
        </h1>
        <p style={{ color: 'var(--light-text)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
          Ensure your new furniture fits perfectly in your space. Enter the dimensions below to get an instant physical fit analysis.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '40px' }}>
        <div className="card" style={{ padding: '30px' }}>
          <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Ruler size={20} color="var(--secondary-color)" /> Enter Dimensions
          </h3>
          
          <form onSubmit={handleCalculate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label>Room Width (cm/inches)</label>
                <input type="number" name="roomWidth" value={form.roomWidth} onChange={handleChange} required min="1" />
              </div>
              <div className="form-group">
                <label>Room Length (cm/inches)</label>
                <input type="number" name="roomLength" value={form.roomLength} onChange={handleChange} required min="1" />
              </div>
              <div className="form-group">
                <label>Furniture Width (cm/inches)</label>
                <input type="number" name="furnitureWidth" value={form.furnitureWidth} onChange={handleChange} required min="1" />
              </div>
              <div className="form-group">
                <label>Furniture Depth (cm/inches)</label>
                <input type="number" name="furnitureDepth" value={form.furnitureDepth} onChange={handleChange} required min="1" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Minimum Walkway Clearance (cm/inches)</label>
                <input type="number" name="clearance" value={form.clearance} onChange={handleChange} required min="0" placeholder="e.g., 90 for standard walkway" />
              </div>
            </div>
            
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '15px', marginTop: '10px', fontSize: '1.1rem' }}
              disabled={loading}
            >
              {loading ? 'Calculating...' : 'Calculate Fit'}
            </button>
          </form>
          {error && <div className="alert alert-error" style={{ marginTop: '20px' }}>{error}</div>}
        </div>

        <div>
          {result ? (
            <div className="card" style={{ padding: '40px 30px', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ marginBottom: '20px' }}>
                {getStatusIcon(result.fit_status || result.status)}
              </div>
              <h2 style={{ marginBottom: '15px', fontSize: '2rem' }}>
                {getStatusText(result.fit_status || result.status)}
              </h2>
              
              <div style={{ backgroundColor: 'var(--bg-color)', borderRadius: 'var(--border-radius)', padding: '20px', margin: '20px 0', textAlign: 'left' }}>
                <div className="flex justify-between mb-2">
                  <span style={{ color: 'var(--light-text)' }}>Room Area:</span>
                  <span style={{ fontWeight: 'bold' }}>{result.room_area} sq units</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span style={{ color: 'var(--light-text)' }}>Furniture Area:</span>
                  <span style={{ fontWeight: 'bold' }}>{result.furniture_area} sq units</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--light-text)' }}>Space Utilization:</span>
                  <span style={{ fontWeight: 'bold' }}>{result.utilization_percentage}%</span>
                </div>
              </div>

              {result.warnings && result.warnings.length > 0 && (
                <div className="alert alert-error" style={{ textAlign: 'left' }}>
                  <ul style={{ paddingLeft: '20px' }}>
                    {result.warnings.map((w, i) => <li key={i} style={{ marginBottom: '5px' }}>{w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ padding: '30px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa', border: '2px dashed var(--border-color)', boxShadow: 'none' }}>
              <Maximize size={48} color="var(--border-color)" style={{ marginBottom: '20px' }} />
              <p style={{ color: 'var(--light-text)', textAlign: 'center' }}>Enter dimensions and click calculate to see the fit analysis.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomFit;
