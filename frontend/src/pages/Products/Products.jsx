import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import ProductCard from '../../components/product/ProductCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';

  // Filters state
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [maxPrice, setMaxPrice] = useState(5000);
  const [sortOption, setSortOption] = useState('');

  useEffect(() => {
    // We could fetch filter options from backend if it supports it, 
    // but we can also just fetch all products and extract categories.
    const fetchProductsAndCategories = async () => {
      setLoading(true);
      try {
        const response = await api.get('/products');
        let data = response.data.products;
        
        // Extract unique categories
        const uniqueCategories = [...new Set(data.map(p => p.category_name))].filter(Boolean);
        setCategories(uniqueCategories);

        // Apply client-side search/filters if backend doesn't support them completely
        // Backend supports filters? Based on earlier code, we didn't add advanced search, 
        // so we filter client-side for simplicity.
        if (searchQuery) {
          data = data.filter(p => 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (p.category_name && p.category_name.toLowerCase().includes(searchQuery.toLowerCase()))
          );
        }

        if (selectedCategory) {
          data = data.filter(p => p.category_name === selectedCategory);
        }

        if (maxPrice) {
          data = data.filter(p => (p.discount_price || p.base_price) <= maxPrice);
        }

        if (sortOption === 'price-low') {
          data.sort((a, b) => (a.discount_price || a.base_price) - (b.discount_price || b.base_price));
        } else if (sortOption === 'price-high') {
          data.sort((a, b) => (b.discount_price || b.base_price) - (a.discount_price || a.base_price));
        } else if (sortOption === 'newest') {
          data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        setProducts(data);
      } catch (err) {
        setError('Failed to load products');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProductsAndCategories();
  }, [searchQuery, selectedCategory, maxPrice, sortOption]);

  const handleClearFilters = () => {
    setSelectedCategory('');
    setMaxPrice(5000);
    setSortOption('');
    if (searchQuery) {
      searchParams.delete('search');
      setSearchParams(searchParams);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '30px', marginTop: '30px' }}>
      {/* Sidebar Filters */}
      <div style={{ width: '250px', flexShrink: 0 }} className="desktop-filters">
        <div className="card" style={{ padding: '20px' }}>
          <div className="flex justify-between align-center mb-2">
            <h3 style={{ margin: 0 }}>Filters</h3>
            <button onClick={handleClearFilters} style={{ color: 'var(--primary-color)', fontSize: '0.85rem', textDecoration: 'underline' }}>Clear</button>
          </div>

          <div className="form-group mt-2">
            <label>Category</label>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="form-group mt-2">
            <label>Max Price: ${maxPrice}</label>
            <input 
              type="range" 
              min="0" 
              max="5000" 
              step="50"
              value={maxPrice} 
              onChange={(e) => setMaxPrice(Number(e.target.value))} 
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1 }}>
        <div className="flex justify-between align-center mb-2">
          <h2>
            {searchQuery ? `Search Results for "${searchQuery}"` : 'All Products'} 
            <span style={{ fontSize: '1rem', color: 'var(--light-text)', marginLeft: '10px' }}>
              ({products.length} {products.length === 1 ? 'item' : 'items'})
            </span>
          </h2>

          <div className="form-group" style={{ marginBottom: 0, width: '200px' }}>
            <select value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
              <option value="">Sort By: Relevance</option>
              <option value="newest">Newest Arrivals</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : products.length === 0 ? (
          <EmptyState 
            title="No products found" 
            message="Try adjusting your filters or search query to find what you're looking for."
            actionText="Clear Filters"
            actionLink="#"
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>

      {/* Basic Mobile Responsive style via inline block for sidebar */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-filters {
            display: none; /* In a real app, this would be a collapsible drawer */
          }
        }
      `}</style>
    </div>
  );
};

export default Products;
