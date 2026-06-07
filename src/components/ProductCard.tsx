import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

interface Product {
  id: string;
  title: string;
  category: string;
  price: number | string;
  mrp?: number | string;
  image: string | string[];
}

interface ProductCardProps {
  product: Product;
  /** Callback fired when the user clicks the add to cart button */
  onAddToCart?: (product: Product) => void;
}

// ----------------------------------------------------------------------
// Helper Functions (Extracted to keep the component lightweight)
// ----------------------------------------------------------------------

const parseImages = (imageProp: string | string[]): string[] => {
  if (Array.isArray(imageProp)) return imageProp;
  if (typeof imageProp !== 'string') return ['https://via.placeholder.com/200?text=No+Image'];

  const trimmed = imageProp.trim();
  
  // Handle JSON array strings
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      return JSON.parse(trimmed) as string[];
    } catch {
      // Silently fall back to standard parsing on failure
    }
  }
  
  // Handle comma-separated strings
  if (trimmed.includes(',')) {
    return trimmed.split(',').map((img) => img.trim());
  }
  
  return trimmed ? [trimmed] : ['https://via.placeholder.com/200?text=No+Image'];
};

const parsePrice = (val: number | string | undefined): number => {
  if (!val) return 0;
  return typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : Number(val);
};

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

export default function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  if (!product) {
    return null;
  }

  // Parse data
  const images = useMemo(() => parseImages(product.image), [product.image]);
  const price = useMemo(() => parsePrice(product.price), [product.price]);
  const mrp = useMemo(() => parsePrice(product.mrp), [product.mrp]);

  const discountPercentage = useMemo(() => {
    if (mrp && mrp > price) {
      return Math.round(((mrp - price) / mrp) * 100);
    }
    return 0;
  }, [price, mrp]);

  // Cycle through images on hover
  useEffect(() => {
    if (!isHovered || images.length <= 1) {
      setCurrentImageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 1500);

    return () => clearInterval(interval);
  }, [isHovered, images.length]);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAddToCart) {
      onAddToCart(product);
    } else {
      console.warn('onAddToCart prop is not provided for ProductCard');
    }
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="bg-white p-3 sm:p-5 rounded-lg flex flex-col justify-between relative border border-gray-200 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-gold-primary/50 active:scale-[0.98] sm:active:scale-100 focus-within:ring-2 focus-within:ring-gold-primary group"
    >
      {/* Dynamic Discount Badge */}
      {discountPercentage > 0 && (
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-20 bg-red-600 text-white text-[9px] sm:text-[11px] uppercase tracking-wider font-bold px-1.5 py-0.5 sm:px-2 sm:py-1 rounded shadow-sm">
          {discountPercentage}% OFF
        </div>
      )}

      {/* Image Frame - Independently Wrapped in Link */}
      <Link 
        href={`/product/${product.id}`} 
        className="block outline-none" 
        aria-label={`View details for ${product.title}`}
      >
        <div className="h-[140px] sm:h-[240px] w-full flex items-center justify-center mb-3 sm:mb-4 overflow-hidden bg-white relative rounded-md">
          {images.map((imgUrl, idx) => (
            <img
              key={idx}
              src={imgUrl}
              alt={`${product.title} - view ${idx + 1}`}
              loading={idx === 0 ? "eager" : "lazy"}
              className={`absolute max-w-full max-h-full object-contain p-1 transition-all duration-500 ease-in-out ${
                idx === currentImageIndex
                  ? 'opacity-100 scale-100'
                  : 'opacity-0 scale-95 pointer-events-none'
              } group-hover:scale-105`}
            />
          ))}

          {/* Dots Indicator Overlay */}
          {images.length > 1 && isHovered && (
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1.5 z-10 bg-black/50 px-2.5 py-1.5 rounded-full backdrop-blur-sm">
              {images.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentImageIndex ? 'bg-gold-primary scale-125' : 'bg-white/60'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </Link>

      {/* Details Section */}
      <div className="p-0 flex-1 flex flex-col">
        
        {/* Title - Independently Wrapped in Link */}
        <Link 
          href={`/product/${product.id}`} 
          className="outline-none group-hover:text-gold-primary transition-colors duration-200"
        >
          <h3 className="text-xs sm:text-[15px] font-medium leading-normal text-text-main mb-1.5 sm:mb-2 h-[36px] sm:h-[42px] overflow-hidden line-clamp-2">
            {product.title}
          </h3>
        </Link>

        {/* Price & Add to Cart Section */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-transparent group-hover:border-gray-100 transition-colors duration-300">
          
          {/* Pricing */}
          <div className="flex flex-col gap-0.5">
            {mrp > price && (
              <span className="text-[10px] sm:text-[13px] font-semibold text-gray-400 line-through decoration-gray-300 leading-none">
                ₹{mrp.toLocaleString('en-IN')}
              </span>
            )}
            <span className="text-base sm:text-xl font-extrabold text-gray-900 group-hover:text-gold-primary transition-colors duration-200 leading-none mt-0.5 sm:mt-1">
              ₹{price.toLocaleString('en-IN')}
            </span>
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            className="relative z-10 px-2.5 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-[13px] font-bold text-[#2b3036] bg-gold-primary hover:bg-gold-hover rounded-full transition-all duration-200 active:scale-95 shadow-md shadow-amber-500/10 flex items-center gap-1 cursor-pointer"
            aria-label={`Add ${product.title} to cart`}
          >
            <span>Add</span>
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
          </button>

        </div>
      </div>
    </div>
  );
}