import React from 'react';

const Footer = () => {
  return (
    <footer style={{ backgroundColor: '#2c3e50', color: '#fff', padding: '40px 0', marginTop: '60px' }}>
      <div className="container flex justify-between">
        <div>
          <h3 style={{ marginBottom: '15px' }}>FURNISTORM</h3>
          <p style={{ color: '#aaa', maxWidth: '300px' }}>
            Elevating your living spaces with premium furniture.
          </p>
        </div>
        <div>
          <h4 style={{ marginBottom: '15px' }}>Quick Links</h4>
          <ul style={{ color: '#aaa', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <li>Home</li>
            <li>Shop</li>
            <li>About Us</li>
            <li>Contact</li>
          </ul>
        </div>
      </div>
      <div className="container text-center" style={{ borderTop: '1px solid #444', marginTop: '30px', paddingTop: '20px', color: '#aaa', fontSize: '0.9rem' }}>
        &copy; {new Date().getFullYear()} Furnistorm. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
