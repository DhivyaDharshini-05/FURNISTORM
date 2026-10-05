import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Truck, Wrench, Award } from 'lucide-react';
import api from '../../services/api';
import ProductCard from '../../components/product/ProductCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const Home = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await api.get('/products');
        setProducts(response.data.products.slice(0, 4));
      } catch (err) {
        setError('Failed to load featured products');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const features = [
    { icon: <ShieldCheck size={32} />, title: 'Secure Payment', desc: '100% secure checkout' },
    { icon: <Truck size={32} />, title: 'Reliable Delivery', desc: 'Fast & safe shipping' },
    { icon: <Wrench size={32} />, title: 'Easy Installation', desc: 'Professional service' },
    { icon: <Award size={32} />, title: 'Verified Products', desc: 'Premium quality assured' },
  ];

  return (
    <div>
      {/* Hero Banner */}
      <div style={{ 
        background: 'linear-gradient(135deg, var(--primary-color) 0%, #34495e 100%)', 
        color: 'white', 
        padding: '80px 20px', 
        borderRadius: 'var(--border-radius)', 
        marginBottom: '60px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: '3.5rem', marginBottom: '20px', fontWeight: '800' }}>Design Your Dream Space</h1>
          <p style={{ fontSize: '1.2rem', marginBottom: '40px', maxWidth: '600px', margin: '0 auto 40px', opacity: 0.9 }}>
            Discover our exclusive collection of premium furniture designed for modern living. Elevate your home today.
          </p>
          <div className="flex justify-center gap-2">
            <Link to="/products" className="btn btn-secondary" style={{ fontSize: '1.1rem', padding: '15px 35px' }}>
              Shop Now
            </Link>
            <Link to="/recommendations" className="btn btn-outline" style={{ fontSize: '1.1rem', padding: '15px 35px', borderColor: 'rgba(255,255,255,0.5)', color: 'white' }}>
              Find My Style
            </Link>
          </div>
        </div>
      </div>

      {/* Smart Tools Section */}
      <div style={{ marginBottom: '60px' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '30px', textAlign: 'center', color: 'var(--primary-color)' }}>Smart Furniture Tools</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
          <div className="card text-center" style={{ padding: '40px 20px' }}>
            <h3 style={{ marginBottom: '15px', color: 'var(--secondary-color)' }}>Room Fit</h3>
            <p style={{ color: 'var(--light-text)', marginBottom: '20px' }}>Will it fit? Use our calculator to ensure perfect placement.</p>
            <Link to="/room-fit" className="btn btn-outline">Check Room Fit</Link>
          </div>
          <div className="card text-center" style={{ padding: '40px 20px' }}>
            <h3 style={{ marginBottom: '15px', color: 'var(--secondary-color)' }}>Personalized Recommendations</h3>
            <p style={{ color: 'var(--light-text)', marginBottom: '20px' }}>Get curated furniture suggestions based on your budget & style.</p>
            <Link to="/recommendations" className="btn btn-outline">Get Recommended</Link>
          </div>
        </div>
      </div>

      {/* Featured Products */}
      <div style={{ marginBottom: '60px' }}>
        <div className="flex justify-between align-center" style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '2rem', color: 'var(--primary-color)' }}>Trending Products</h2>
          <Link to="/products" style={{ color: 'var(--secondary-color)', fontWeight: '600' }}>View All &rarr;</Link>
        </div>
        
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px' }}>
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>

      {/* Why Furnistorm */}
      <div style={{ backgroundColor: '#fff', padding: '60px 40px', borderRadius: 'var(--border-radius)', marginBottom: '60px' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '40px', textAlign: 'center', color: 'var(--primary-color)' }}>Why FURNISTORM</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '40px', textAlign: 'center' }}>
          {features.map((feature, idx) => (
            <div key={idx} className="flex" style={{ flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ color: 'var(--secondary-color)', marginBottom: '15px' }}>{feature.icon}</div>
              <h3 style={{ marginBottom: '10px', fontSize: '1.2rem' }}>{feature.title}</h3>
              <p style={{ color: 'var(--light-text)' }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
