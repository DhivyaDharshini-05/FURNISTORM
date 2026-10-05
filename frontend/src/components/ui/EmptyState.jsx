import React from 'react';
import { Link } from 'react-router-dom';

const EmptyState = ({ title, message, actionText, actionLink }) => {
  return (
    <div className="card text-center" style={{ padding: '60px 20px', maxWidth: '600px', margin: '40px auto' }}>
      <h3 style={{ marginBottom: '15px', color: 'var(--primary-color)' }}>{title}</h3>
      <p style={{ color: 'var(--light-text)', marginBottom: '25px' }}>{message}</p>
      {actionText && actionLink && (
        <Link to={actionLink} className="btn btn-primary">
          {actionText}
        </Link>
      )}
    </div>
  );
};

export default EmptyState;
