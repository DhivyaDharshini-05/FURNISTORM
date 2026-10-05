import React from 'react';
import { Star, StarHalf } from 'lucide-react';

const RatingStars = ({ rating = 0, count }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = Math.max(0, 5 - fullStars - (hasHalfStar ? 1 : 0));

  return (
    <div className="flex align-center gap-1" style={{ color: '#f39c12' }}>
      {[...Array(fullStars)].map((_, i) => <Star key={`full-${i}`} size={16} fill="currentColor" />)}
      {hasHalfStar && <StarHalf size={16} fill="currentColor" />}
      {[...Array(emptyStars)].map((_, i) => <Star key={`empty-${i}`} size={16} />)}
      {count !== undefined && (
        <span style={{ color: 'var(--light-text)', fontSize: '0.85rem', marginLeft: '5px' }}>
          ({count})
        </span>
      )}
    </div>
  );
};

export default RatingStars;
