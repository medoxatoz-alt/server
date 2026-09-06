import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';

interface FilterSidebarProps {
  subcategories: { id: string, name: string }[];
  brands: string[];
  availableAttributes?: Record<string, string[]>;
  counts: {
    subcategories: Record<string, number>;
    brands: Record<string, number>;
    attributes?: Record<string, Record<string, number>>;
  };
  filters: {
    subcategories: string[];
    brands: string[];
    priceRange: [number, number];
    attributes?: Record<string, string[]>;
  };
  maxPrice: number;
  onFilterChange: (newFilters: any) => void;
  isMobile?: boolean;
}

export default function FilterSidebar({
  subcategories,
  brands,
  availableAttributes,
  counts,
  filters,
  maxPrice,
  onFilterChange,
  isMobile = false
}: FilterSidebarProps) {
  const [brandSearch, setBrandSearch] = useState('');
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    categories: true,
    brand: true,
    price: true
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSubcategoryToggle = (sub: string) => {
    const newSubs = filters.subcategories.includes(sub)
      ? filters.subcategories.filter(s => s !== sub)
      : [...filters.subcategories, sub];
    onFilterChange({ ...filters, subcategories: newSubs });
  };

  const handleBrandToggle = (brand: string) => {
    const newBrands = filters.brands.includes(brand)
      ? filters.brands.filter(b => b !== brand)
      : [...filters.brands, brand];
    onFilterChange({ ...filters, brands: newBrands });
  };

  const handleAttributeToggle = (key: string, value: string) => {
    const currentAttrFilters = filters.attributes || {};
    const selectedValues = currentAttrFilters[key] || [];
    const newSelectedValues = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    
    onFilterChange({ 
      ...filters, 
      attributes: { ...currentAttrFilters, [key]: newSelectedValues } 
    });
  };

  const filteredBrands = useMemo(() => {
    return brands.filter(b => b.toLowerCase().includes(brandSearch.toLowerCase()));
  }, [brands, brandSearch]);

  const displayedBrands = showAllBrands ? filteredBrands : filteredBrands.slice(0, 8);

  const containerClass = isMobile 
    ? "bg-white p-5 space-y-6" 
    : "bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-8 sticky top-[100px] max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar";

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[15px] font-bold text-gray-900 tracking-widest uppercase">Filters</h2>
        {(filters.subcategories.length > 0 || filters.brands.length > 0 || filters.priceRange[0] > 0 || filters.priceRange[1] < maxPrice || Object.keys(filters.attributes || {}).some(k => filters.attributes![k].length > 0)) && (
          <button 
            onClick={() => onFilterChange({ subcategories: [], brands: [], priceRange: [0, maxPrice], attributes: {} })}
            className="text-xs font-semibold text-red-500 hover:text-red-600 uppercase tracking-wider"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Categories */}
      {subcategories.length > 0 && (
        <div className="border-t border-gray-100 pt-5">
          <div 
            className="flex items-center justify-between cursor-pointer mb-4"
            onClick={() => toggleSection('categories')}
          >
            <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-widest">Categories</h3>
            {expandedSections.categories ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
          
          {expandedSections.categories && (
            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {subcategories.map(sub => (
                <label key={sub.id} className="flex items-center group cursor-pointer">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      className="peer appearance-none w-4 h-4 border border-gray-300 rounded-sm checked:bg-gold-primary checked:border-gold-primary transition-colors cursor-pointer"
                      checked={filters.subcategories.includes(sub.id)}
                      onChange={() => handleSubcategoryToggle(sub.id)}
                    />
                    <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <span className={`ml-3 text-[14px] ${filters.subcategories.includes(sub.id) ? 'font-semibold text-gray-900' : 'text-gray-600 group-hover:text-gray-900'}`}>
                    {sub.name}
                  </span>
                  <span className="ml-1 text-[11px] text-gray-400">({counts.subcategories[sub.id] || 0})</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Brands */}
      {brands.length > 0 && (
        <div className="border-t border-gray-100 pt-5">
          <div 
            className="flex items-center justify-between cursor-pointer mb-4"
            onClick={() => toggleSection('brand')}
          >
            <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-widest">Brand</h3>
            {expandedSections.brand ? (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search" 
                    value={brandSearch}
                    onChange={(e) => setBrandSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 focus:w-[150px] focus:px-3 focus:bg-white focus:border-gold-primary focus:ring-1 focus:ring-gold-primary transition-all duration-300 outline-none text-xs pl-8 text-gray-700"
                  />
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5 pointer-events-none" />
                </div>
                <ChevronUp className="w-4 h-4 text-gray-400" />
              </div>
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
          
          {expandedSections.brand && (
            <div className="space-y-3">
              {displayedBrands.map(brand => (
                <label key={brand} className="flex items-center group cursor-pointer">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      className="peer appearance-none w-4 h-4 border border-gray-300 rounded-sm checked:bg-gold-primary checked:border-gold-primary transition-colors cursor-pointer"
                      checked={filters.brands.includes(brand)}
                      onChange={() => handleBrandToggle(brand)}
                    />
                    <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <span className={`ml-3 text-[14px] ${filters.brands.includes(brand) ? 'font-semibold text-gray-900' : 'text-gray-600 group-hover:text-gray-900'}`}>
                    {brand}
                  </span>
                  <span className="ml-1 text-[11px] text-gray-400">({counts.brands[brand] || 0})</span>
                </label>
              ))}
              
              {filteredBrands.length > 8 && (
                <button 
                  onClick={() => setShowAllBrands(!showAllBrands)}
                  className="text-[13px] font-medium text-gold-primary hover:text-gold-hover mt-2 text-left w-full pl-7"
                >
                  {showAllBrands ? '- Show less' : `+ ${filteredBrands.length - 8} more`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dynamic Attributes */}
      {availableAttributes && Object.keys(availableAttributes).map(attrKey => {
        const values = availableAttributes[attrKey];
        if (!values || values.length === 0) return null;
        
        const sectionKey = `attr_${attrKey}`;
        const isExpanded = expandedSections[sectionKey] !== false; // default true
        const selectedValues = (filters.attributes || {})[attrKey] || [];
        
        return (
          <div key={attrKey} className="border-t border-gray-100 pt-5">
            <div 
              className="flex items-center justify-between cursor-pointer mb-4"
              onClick={() => toggleSection(sectionKey)}
            >
              <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-widest">{attrKey}</h3>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
            
            {isExpanded && (
              <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {values.map((val: string) => (
                  <label key={val} className="flex items-center group cursor-pointer">
                    <div className="relative flex items-center justify-center">
                      <input 
                        type="checkbox" 
                        className="peer appearance-none w-4 h-4 border border-gray-300 rounded-sm checked:bg-gold-primary checked:border-gold-primary transition-colors cursor-pointer"
                        checked={selectedValues.includes(val)}
                        onChange={() => handleAttributeToggle(attrKey, val)}
                      />
                      <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <span className={`ml-3 text-[14px] ${selectedValues.includes(val) ? 'font-semibold text-gray-900' : 'text-gray-600 group-hover:text-gray-900'}`}>
                      {val}
                    </span>
                    <span className="ml-1 text-[11px] text-gray-400">({counts.attributes?.[attrKey]?.[val] || 0})</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {/* Price */}
      {maxPrice > 0 && (
        <div className="border-t border-gray-100 pt-5 pb-5">
          <div 
            className="flex items-center justify-between cursor-pointer mb-6"
            onClick={() => toggleSection('price')}
          >
            <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-widest">Price</h3>
            {expandedSections.price ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
          
          {expandedSections.price && (
            <div className="px-2">
              <input 
                type="range"
                min="0"
                max={maxPrice}
                step="50"
                value={filters.priceRange[1]}
                onChange={(e) => onFilterChange({ ...filters, priceRange: [0, parseInt(e.target.value)] })}
                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gold-primary"
                style={{
                   background: `linear-gradient(to right, #d4af37 ${(filters.priceRange[1] / maxPrice) * 100}%, #e5e7eb ${(filters.priceRange[1] / maxPrice) * 100}%)`
                }}
              />
              <div className="flex items-center justify-between mt-4">
                <div className="px-3 py-1.5 border border-gray-200 rounded text-[13px] text-gray-600 font-medium">
                  ₹0
                </div>
                <div className="text-gray-400 text-xs">to</div>
                <div className="px-3 py-1.5 border border-gray-200 rounded text-[13px] text-gray-900 font-bold">
                  ₹{filters.priceRange[1]}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {!isMobile && (
        <style dangerouslySetInnerHTML={{__html: `
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }
          .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #d1d5db; }
        `}} />
      )}
    </div>
  );
}
