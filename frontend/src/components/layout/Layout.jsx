import React from 'react';
import Navbar from '../navbar/Navbar';
import Footer from './Footer';

const Layout = ({ children }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <main style={{ flex: 1 }} className="container">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
