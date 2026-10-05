import React, { useState } from 'react';
import api from '../../services/api';
import { Sparkles } from 'lucide-react';
import ProductCard from '../../components/product/ProductCard';

const Recommendations = () => {
  const [form, setForm] = useState({
    budget: '',
    style: '',
    room: '',
    category: '',
    material: '',
    color: ''
  });
  
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleGetRecommendations = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
    
    try {
      // Clean up empty params
      const params = {};
      Object.keys(form).forEach(k => {
        if (form[k]) params[k] = form[k];
      });

      const response = await api.get('/recommendations', { params });
      setResults(response.data.recommendations || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to get recommendations');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '30px', marginBottom: '80px', maxWidth: '1200px', margin: '30px auto 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ marginBottom: '15px', color: 'var(--primary-color)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
          <Sparkles size={32} color="var(--secondary-color)" /> Personalized Recommendations
        </h1>
        <p style={{ color: 'var(--light-text)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
          Tell us what you're looking for, and our intelligent recommendation engine will find the perfect furniture matches for you.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '40px' }}>
        <div className="card" style={{ padding: '30px', height: 'fit-content', position: 'sticky', top: '100px' }}>
          <h3 style={{ marginBottom: '20px' }}>Your Preferences</h3>
          
          <form onSubmit={handleGetRecommendations}>
            <div className="form-group">
              <label>Max Budget ($)</label>
              <input type="number" name="budget" value={form.budget} onChange={handleChange} placeholder="e.g. 1000" />
            </div>
            
            <div className="form-group">
              <label>Style</label>
              <select name="style" value={form.style} onChange={handleChange}>
                <option value="">Any Style</option>
                <option value="Modern">Modern</option>
                <option value="Contemporary">Contemporary</option>
                <option value="Minimalist">Minimalist</option>
                <option value="Industrial">Industrial</option>
                <option value="Traditional">Traditional</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Room</label>
              <select name="room" value={form.room} onChange={handleChange}>
                <option value="">Any Room</option>
                <option value="Living Room">Living Room</option>
                <option value="Bedroom">Bedroom</option>
                <option value="Dining Room">Dining Room</option>
                <option value="Office">Office</option>
                <option value="Outdoor">Outdoor</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Category</label>
              <select name="category" value={form.category} onChange={handleChange}>
                <option value="">Any Category</option>
                <option value="Sofas">Sofas</option>
                <option value="Beds">Beds</option>
                <option value="Chairs">Chairs</option>
                <option value="Tables">Tables</option>
                <option value="Storage">Storage</option>
              </select>
            </div>

            <div className="form-group">
              <label>Material</label>
              <select name="material" value={form.material} onChange={handleChange}>
                <option value="">Any Material</option>
                <option value="Wood">Wood</option>
                <option value="Metal">Metal</option>
                <option value="Leather">Leather</option>
                <option value="Fabric">Fabric</option>
                <option value="Glass">Glass</option>
              </select>
            </div>

            <div className="form-group">
              <label>Color</label>
              <select name="color" value={form.color} onChange={handleChange}>
                <option value="">Any Color</option>
                <option value="Black">Black</option>
                <option value="White">White</option>
                <option value="Brown">Brown</option>
                <option value="Grey">Grey</option>
                <option value="Blue">Blue</option>
              </select>
            </div>
            
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '15px', marginTop: '10px', fontSize: '1.1rem' }}
              disabled={loading}
            >
              {loading ? 'Finding Matches...' : 'Get Recommendations'}
            </button>
          </form>
        </div>

        <div>
          {error && <div className="alert alert-error" style={{ marginBottom: '20px' }}>{error}</div>}
          
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
              <div className="loader"></div>
            </div>
          ) : results ? (
            results.length > 0 ? (
              <div>
                <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  Top Matches
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                  {results.map((rec, index) => (
                    <div key={rec.id} style={{ position: 'relative' }}>
                      <div style={{ 
                        position: 'absolute', 
                        top: '-10px', 
                        right: '-10px', 
                        backgroundColor: 'var(--success)', 
                        color: 'white', 
                        padding: '8px 12px', 
                        borderRadius: '20px', 
                        fontWeight: 'bold', 
                        zIndex: 10,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                      }}>
                        {rec.score}% Match
                      </div>
                      <ProductCard product={rec} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card text-center" style={{ padding: '60px 20px', backgroundColor: '#f8f9fa' }}>
                <h3 style={{ marginBottom: '15px' }}>No perfect matches found</h3>
                <p style={{ color: 'var(--light-text)' }}>Try adjusting your preferences to see more results.</p>
              </div>
            )
          ) : (
            <div className="card text-center" style={{ padding: '60px 20px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa', border: '2px dashed var(--border-color)', boxShadow: 'none' }}>
              <Sparkles size={48} color="var(--border-color)" style={{ marginBottom: '20px' }} />
              <h3 style={{ color: 'var(--light-text)' }}>Set your preferences on the left to get started</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Recommendations;
