import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Shield, Truck, CornerRightDown, Heart, PackageCheck } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import RatingStars from '../../components/ui/RatingStars';

const ProductDetails = () => {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingToCart, setAddingToCart] = useState(false);
  
  // Review form state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProductDetails = async () => {
      setLoading(true);
      try {
        const [productRes, variantsRes, reviewsRes] = await Promise.all([
          api.get(`/products/${productId}`),
          api.get(`/products/${productId}/variants`),
          api.get(`/products/${productId}/reviews`).catch(() => ({ data: { reviews: [] } }))
        ]);
        
        setProduct(productRes.data.product);
        setVariants(variantsRes.data.variants);
        setReviews(reviewsRes.data.reviews || []);
        
        if (variantsRes.data.variants.length > 0) {
          const firstAvailable = variantsRes.data.variants.find(v => v.available_quantity > 0) || variantsRes.data.variants[0];
          setSelectedVariant(firstAvailable.id);
        }
      } catch (err) {
        setError('Failed to load product details. It may have been removed.');
      } finally {
        setLoading(false);
      }
    };
    fetchProductDetails();
  }, [productId]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/products/${productId}` } } });
      return;
    }
    setSubmittingReview(true);
    setReviewError(null);
    try {
      await api.post(`/products/${productId}/reviews`, {
        rating: reviewRating,
        comment: reviewComment
      });
      // Refresh reviews
      const reviewsRes = await api.get(`/products/${productId}/reviews`);
      setReviews(reviewsRes.data.reviews || []);
      setReviewComment('');
      setReviewRating(5);
    } catch (err) {
      setReviewError(err.response?.data?.error?.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/products/${productId}` } } });
      return;
    }
    
    if (!selectedVariant) return;

    setAddingToCart(true);
    try {
      await api.post('/cart/items', { product_variant_id: selectedVariant, quantity });
      navigate('/cart');
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    await handleAddToCart();
    // navigate('/checkout') is done in handleAddToCart indirectly? No, handleAddToCart goes to cart.
    // Buy now should ideally go to checkout, but we don't have a direct checkout API for single items without cart in this backend.
    // The backend uses cart -> checkout. So buy now just goes to cart for now.
  };

  if (loading) return <LoadingSpinner fullScreen />;
  if (error) return <div className="alert alert-error mt-2">{error}</div>;
  if (!product) return <div>Product not found</div>;

  const currentVariant = variants.find(v => v.id === selectedVariant) || variants[0];
  const price = Number(product.discount_price || product.base_price) + Number(currentVariant?.additional_price || 0);
  const outOfStock = currentVariant?.available_quantity <= 0;
  
  // Calculate average rating
  const avgRating = reviews.length > 0 ? (reviews.reduce((acc, rev) => acc + rev.rating, 0) / reviews.length).toFixed(1) : 0;

  return (
    <div style={{ marginTop: '30px', marginBottom: '60px' }}>
      <div className="flex gap-2" style={{ marginBottom: '40px' }}>
        <Link to="/products" style={{ color: 'var(--light-text)' }}>Shop</Link>
        <span style={{ color: 'var(--light-text)' }}>/</span>
        <Link to={`/products?category=${product.category_name}`} style={{ color: 'var(--light-text)' }}>{product.category_name}</Link>
        <span style={{ color: 'var(--light-text)' }}>/</span>
        <span style={{ fontWeight: '500' }}>{product.name}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '50px' }}>
        {/* Left: Images */}
        <div>
          <div style={{ backgroundColor: '#f1f2f6', borderRadius: 'var(--border-radius)', height: '500px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
            <span style={{ color: 'var(--light-text)', fontSize: '1.2rem' }}>Product Image Preview</span>
            <button className="btn" style={{ position: 'absolute', top: '20px', right: '20px', background: 'white', padding: '10px', borderRadius: '50%', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
              <Heart size={24} color="#e74c3c" />
            </button>
          </div>
        </div>
        
        {/* Right: Details */}
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '10px', lineHeight: '1.2' }}>{product.name}</h1>
          <p style={{ color: 'var(--light-text)', fontSize: '1.1rem', marginBottom: '15px' }}>{product.brand}</p>
          
          <div style={{ marginBottom: '25px' }}>
            <RatingStars rating={Number(avgRating)} count={reviews.length} />
          </div>
          
          <div className="flex align-center gap-1" style={{ marginBottom: '25px' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
              ${price}
            </span>
            {product.discount_price && (
              <span style={{ fontSize: '1.2rem', color: 'var(--light-text)', textDecoration: 'line-through', marginLeft: '10px' }}>
                ${Number(product.base_price) + Number(currentVariant?.additional_price || 0)}
              </span>
            )}
          </div>
          
          <p style={{ fontSize: '1.1rem', lineHeight: '1.8', color: 'var(--text-color)', marginBottom: '30px' }}>
            {product.description}
          </p>

          <div style={{ padding: '20px', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--border-radius)', marginBottom: '30px' }}>
            <h4 style={{ marginBottom: '15px' }}>Select Variant</h4>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {variants.map(v => (
                <button 
                  key={v.id}
                  disabled={v.available_quantity <= 0}
                  onClick={() => setSelectedVariant(v.id)}
                  style={{
                    padding: '10px 20px',
                    border: selectedVariant === v.id ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                    borderRadius: '4px',
                    backgroundColor: v.available_quantity <= 0 ? '#f1f2f6' : 'white',
                    color: v.available_quantity <= 0 ? 'var(--light-text)' : 'inherit',
                    cursor: v.available_quantity <= 0 ? 'not-allowed' : 'pointer',
                    fontWeight: selectedVariant === v.id ? 'bold' : 'normal'
                  }}
                >
                  {v.size || v.color || v.sku}
                </button>
              ))}
            </div>
          </div>

          <div className="flex align-center gap-2 mb-2" style={{ marginBottom: '30px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} style={{ padding: '15px', width: '100px', fontWeight: 'bold' }}>
                {[1, 2, 3, 4, 5].map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>
            <button 
              className="btn btn-primary" 
              style={{ flex: 1, padding: '15px', fontSize: '1.1rem' }} 
              onClick={handleAddToCart}
              disabled={addingToCart || outOfStock}
            >
              {addingToCart ? 'Adding...' : outOfStock ? 'Out of Stock' : 'Add to Cart'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', paddingTop: '30px', borderTop: '1px solid var(--border-color)' }}>
            <div className="flex align-center gap-1">
              <Truck color="var(--secondary-color)" />
              <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Free Shipping & Returns</span>
            </div>
            <div className="flex align-center gap-1">
              <Shield color="var(--secondary-color)" />
              <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>2-Year Warranty</span>
            </div>
            <div className="flex align-center gap-1">
              <PackageCheck color="var(--secondary-color)" />
              <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Assembly Included</span>
            </div>
            <div className="flex align-center gap-1">
              <CornerRightDown color="var(--secondary-color)" />
              <Link to="/room-fit" style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--primary-color)', textDecoration: 'underline' }}>
                Try Room Fit Calculator
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div style={{ marginTop: '80px', paddingTop: '40px', borderTop: '1px solid var(--border-color)' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '30px' }}>Customer Reviews</h2>
        {reviews.length === 0 ? (
          <p style={{ color: 'var(--light-text)' }}>No reviews yet. Be the first to review this product!</p>
        ) : (
          <div style={{ display: 'grid', gap: '20px', maxWidth: '800px' }}>
            {reviews.map(review => (
              <div key={review.id} className="card" style={{ padding: '20px' }}>
                <div className="flex justify-between mb-2">
                  <div style={{ fontWeight: 'bold' }}>{review.reviewer_name}</div>
                  <div style={{ color: 'var(--light-text)', fontSize: '0.9rem' }}>
                    {new Date(review.created_at).toLocaleDateString()}
                  </div>
                </div>
                <RatingStars rating={review.rating} />
                <p style={{ marginTop: '15px', color: 'var(--text-color)', lineHeight: '1.6' }}>{review.comment}</p>
              </div>
            ))}
          </div>
        )}

        {/* Write a Review */}
        <div className="card" style={{ padding: '30px', marginTop: '40px', maxWidth: '800px' }}>
          <h3 style={{ marginBottom: '20px' }}>Write a Review</h3>
          {user ? (
            <form onSubmit={handleSubmitReview}>
              {reviewError && <div className="alert alert-error" style={{ marginBottom: '15px' }}>{reviewError}</div>}
              
              <div className="form-group">
                <label>Rating</label>
                <select value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))}>
                  <option value="5">5 - Excellent</option>
                  <option value="4">4 - Very Good</option>
                  <option value="3">3 - Average</option>
                  <option value="2">2 - Poor</option>
                  <option value="1">1 - Terrible</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Comment</label>
                <textarea 
                  value={reviewComment} 
                  onChange={(e) => setReviewComment(e.target.value)} 
                  required
                  rows="4"
                  placeholder="Share your experience with this product..."
                ></textarea>
              </div>
              
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={submittingReview}
              >
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          ) : (
            <p style={{ color: 'var(--light-text)' }}>
              Please <Link to="/login" style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}>log in</Link> to write a review.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;
