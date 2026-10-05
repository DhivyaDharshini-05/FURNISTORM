import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Heart, User, LogOut, Package, Search, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import styles from './Navbar.module.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setMobileMenuOpen(false);
    }
  };

  return (
    <nav className={styles.navbar}>
      <div className={`container ${styles.navContainer}`}>
        <Link to="/" className={styles.logo}>
          FURNI<span>STORM</span>
        </Link>
        
        <div className={`${styles.navCenter} ${mobileMenuOpen ? styles.mobileOpen : ''}`}>
          <div className={styles.navLinks}>
            <Link to="/" onClick={() => setMobileMenuOpen(false)}>Home</Link>
            <Link to="/products" onClick={() => setMobileMenuOpen(false)}>Shop</Link>
            <Link to="/recommendations" onClick={() => setMobileMenuOpen(false)}>Recommendations</Link>
            <Link to="/room-fit" onClick={() => setMobileMenuOpen(false)}>Room Fit</Link>
          </div>
          
          <form className={styles.searchForm} onSubmit={handleSearch}>
            <input 
              type="text" 
              placeholder="Search furniture..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            <button type="submit" className={styles.searchBtn}>
              <Search size={18} />
            </button>
          </form>
        </div>

        <div className={styles.navIcons}>
          <Link to="/wishlist" className={styles.iconLink} title="Wishlist">
            <Heart size={22} />
          </Link>
          <Link to="/cart" className={styles.iconLink} title="Cart">
            <ShoppingCart size={22} />
          </Link>

          {user ? (
            <div className={styles.userMenu}>
              <Link to="/orders" className={styles.iconLink} title="My Orders">
                <Package size={22} />
              </Link>
              <Link to="/profile" className={styles.iconLink} title="Profile">
                <User size={22} />
              </Link>
              <button onClick={handleLogout} className={styles.iconLink} title="Logout">
                <LogOut size={22} />
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
              Login
            </Link>
          )}

          <button 
            className={styles.mobileToggle} 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
