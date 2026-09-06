'use client';

import { useState, useRef, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { X, Upload, Image as ImageIcon, Trash2, Search, ChevronDown } from 'lucide-react';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_MB = 5;
const MAX_IMAGES = 5;

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddProductModal({ isOpen, onClose, onSuccess }: AddProductModalProps) {
  const [newTitle, setNewTitle] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newMrp, setNewMrp] = useState('');
  const [newMainCategoryId, setNewMainCategoryId] = useState('');
  const [newSubCategoryId, setNewSubCategoryId] = useState('');
  const [newStock, setNewStock] = useState('10');
  const [newWeight, setNewWeight] = useState('0.5');
  const [newLength, setNewLength] = useState('10');
  const [newBreadth, setNewBreadth] = useState('10');
  const [newHeight, setNewHeight] = useState('10');
  const [newDescription, setNewDescription] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [attributes, setAttributes] = useState<{key: string, value: string}[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categoriesConfig, setCategoriesConfig] = useState<{mainCategories: {id: string, name: string}[], subcategories: Record<string, {id: string, name: string}[]>}>({ mainCategories: [], subcategories: {} });
  
  const [isSubCatDropdownOpen, setIsSubCatDropdownOpen] = useState(false);
  const [subCatSearch, setSubCatSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      api.get('/categories').then(res => {
        setCategoriesConfig(res.data);
        if (res.data.mainCategories?.length > 0) {
          setNewMainCategoryId(res.data.mainCategories[0].id);
        }
      }).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    // Reset subcategory if main category changes
    setNewSubCategoryId('');
    setSubCatSearch('');
  }, [newMainCategoryId]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const available = MAX_IMAGES - imageFiles.length;

    if (available <= 0) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed.`);
      return;
    }

    const validated: File[] = [];
    for (const file of selected.slice(0, available)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: only JPG, PNG, WebP allowed.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name}: must be under ${MAX_FILE_SIZE_MB}MB.`);
        continue;
      }
      validated.push(file);
    }

    const newPreviews = validated.map(f => URL.createObjectURL(f));
    setImageFiles(prev => [...prev, ...validated]);
    setImagePreviews(prev => [...prev, ...newPreviews]);

    // Reset file input so same files can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(imagePreviews[idx]);
    setImageFiles(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const resetForm = () => {
    imagePreviews.forEach(url => URL.revokeObjectURL(url));
    setNewTitle(''); setNewBrand(''); setNewPrice(''); setNewMrp(''); setNewStock('10');
    setNewDescription(''); setNewSubCategoryId(''); setSubCatSearch(''); setAttributes([]);
    if (categoriesConfig.mainCategories.length > 0) setNewMainCategoryId(categoriesConfig.mainCategories[0].id);
    setImageFiles([]); setImagePreviews([]);
  };

  const handleClose = () => { resetForm(); onClose(); };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newSubCategoryId) {
      toast.error('Please select a subcategory.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload all images in parallel (order preserved so uploadedUrls[0] stays the thumbnail)
      const uploadedUrls: string[] = await Promise.all(imageFiles.map(async (file) => {
        const formData = new FormData();
        formData.append('image', file);
        const res = await api.post('/upload/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        return res.data.url;
      }));

      // thumbnail = first image
      const thumbnail = uploadedUrls[0] || 'https://via.placeholder.com/200?text=No+Image';

      const payload = {
        title: newTitle,
        brand: newBrand,
        price: parseFloat(newPrice),
        mrp: newMrp ? parseFloat(newMrp) : undefined,
        mainCategoryId: newMainCategoryId,
        subCategoryId: newSubCategoryId || undefined,
        stock: parseInt(newStock) || 0,
        weight: parseFloat(newWeight) || 0.5,
        length: parseFloat(newLength) || 10,
        breadth: parseFloat(newBreadth) || 10,
        height: parseFloat(newHeight) || 10,
        description: newDescription,
        images: uploadedUrls,
        image: thumbnail,   // backwards-compat alias
        thumbnail,
        attributes: attributes.filter(a => a.key.trim() && a.value.trim()),
      };

      await api.post('/products', payload);

      toast.success('Product added successfully!');
      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Add product error:', err);
      const errMsg = err?.response?.data?.error || 'Failed to add product.';
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[640px] overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in duration-200">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900">Add New Product</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 overflow-y-auto flex-1">
          <form id="add-product-form" onSubmit={handleAddProduct} className="flex flex-col gap-5">

            {/* Title & Brand */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Product Title *</label>
                <input
                  type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} required
                  placeholder="e.g., Digital Blood Pressure Monitor"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Brand Name</label>
                <input
                  type="text" value={newBrand} onChange={e => setNewBrand(e.target.value)}
                  placeholder="e.g., Omron, Lakme"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20"
                />
              </div>
            </div>

            {/* Price / MRP / Stock */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Price (₹) *</label>
                <input
                  type="number" min="0" value={newPrice} onChange={e => setNewPrice(e.target.value)} required
                  placeholder="2500"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">MRP (₹)</label>
                <input
                  type="number" min="0" value={newMrp} onChange={e => setNewMrp(e.target.value)}
                  placeholder="3000"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Stock</label>
                <input
                  type="number" min="0" value={newStock} onChange={e => setNewStock(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20"
                />
              </div>
            </div>

            {/* Packaging Details */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Package Details (for Shipping)</label>
              <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Weight (kg)</label>
                  <input
                    type="number" step="0.01" min="0.1" value={newWeight} onChange={e => setNewWeight(e.target.value)} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none transition-all focus:border-gold-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Length (cm)</label>
                  <input
                    type="number" step="0.1" min="1" value={newLength} onChange={e => setNewLength(e.target.value)} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none transition-all focus:border-gold-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Breadth (cm)</label>
                  <input
                    type="number" step="0.1" min="1" value={newBreadth} onChange={e => setNewBreadth(e.target.value)} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none transition-all focus:border-gold-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Height (cm)</label>
                  <input
                    type="number" step="0.1" min="1" value={newHeight} onChange={e => setNewHeight(e.target.value)} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none transition-all focus:border-gold-primary"
                  />
                </div>
              </div>
            </div>

            {/* Custom Attributes */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-bold text-gray-700">Custom Attributes</label>
                <button 
                  type="button" 
                  onClick={() => setAttributes([...attributes, { key: '', value: '' }])}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  + Add Attribute
                </button>
              </div>
              <div className="space-y-2">
                {attributes.map((attr, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input 
                      type="text" placeholder="e.g. Material" value={attr.key}
                      onChange={e => {
                        const newAttrs = [...attributes];
                        newAttrs[idx].key = e.target.value;
                        setAttributes(newAttrs);
                      }}
                      className="w-1/3 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-gold-primary"
                    />
                    <input 
                      type="text" placeholder="e.g. Cotton" value={attr.value}
                      onChange={e => {
                        const newAttrs = [...attributes];
                        newAttrs[idx].value = e.target.value;
                        setAttributes(newAttrs);
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-gold-primary"
                    />
                    <button 
                      type="button" 
                      onClick={() => setAttributes(attributes.filter((_, i) => i !== idx))}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {attributes.length === 0 && (
                  <div className="text-sm text-gray-400 italic">No custom attributes added.</div>
                )}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Category *</label>
              <div className="relative">
                {/* Custom Searchable Dropdown */}
                <div 
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none transition-all bg-white cursor-pointer flex items-center justify-between hover:border-gold-primary"
                  onClick={() => setIsSubCatDropdownOpen(!isSubCatDropdownOpen)}
                >
                  <span className={newMainCategoryId ? "text-gray-900" : "text-gray-400"}>
                    {newMainCategoryId ? (
                      newSubCategoryId 
                        ? (categoriesConfig.subcategories[newMainCategoryId]?.find(s => s.id === newSubCategoryId)?.name || 'Selected Subcategory')
                        : (categoriesConfig.mainCategories.find(c => c.id === newMainCategoryId)?.name || 'Selected Category')
                    ) : '-- Select Category --'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isSubCatDropdownOpen ? 'rotate-180' : ''}`} />
                </div>

                {isSubCatDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-[280px] overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                      <div className="relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search categories..."
                          value={subCatSearch}
                          onChange={(e) => setSubCatSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-gold-primary focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
                      {categoriesConfig.mainCategories.map(mainCat => {
                        const subs = categoriesConfig.subcategories[mainCat.id] || [];
                        const searchLower = subCatSearch.toLowerCase();
                        const matchesMain = mainCat.name.toLowerCase().includes(searchLower);
                        const matchedSubs = subs.filter(sub => sub.name.toLowerCase().includes(searchLower));
                        
                        if (subCatSearch && !matchesMain && matchedSubs.length === 0) return null;

                        return (
                          <div key={mainCat.id} className="mb-2">
                            <div 
                              className="px-3 py-2 text-sm font-bold rounded-lg mb-1 bg-gray-50 text-gray-800"
                            >
                              {mainCat.name}
                            </div>
                            
                            {subs.length > 0 && (
                              <div className="pl-3 border-l-2 border-gray-100 ml-3 space-y-0.5">
                                {(subCatSearch && !matchesMain ? matchedSubs : subs).map(sub => (
                                  <div
                                    key={sub.id}
                                    className={`px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors ${
                                      newSubCategoryId === sub.id 
                                        ? 'bg-gold-primary/10 text-gold-700 font-semibold' 
                                        : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                    onClick={() => { setNewMainCategoryId(mainCat.id); setNewSubCategoryId(sub.id); setIsSubCatDropdownOpen(false); }}
                                  >
                                    {sub.name}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {categoriesConfig.mainCategories.length > 0 && 
                       !categoriesConfig.mainCategories.some(mainCat => {
                         const subs = categoriesConfig.subcategories[mainCat.id] || [];
                         const searchLower = subCatSearch.toLowerCase();
                         return mainCat.name.toLowerCase().includes(searchLower) || subs.some(s => s.name.toLowerCase().includes(searchLower));
                       }) && (
                        <div className="px-3 py-4 text-sm text-gray-400 text-center">No categories found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Description</label>
              <textarea
                value={newDescription} onChange={e => setNewDescription(e.target.value)}
                rows={2} placeholder="Brief product description..."
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20 resize-none"
              />
            </div>

            {/* Multi-image uploader */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                Product Images <span className="text-gray-400 font-normal">({imageFiles.length}/{MAX_IMAGES} · JPG, PNG, WebP · Max 5MB each)</span>
              </label>

              {/* Previews grid */}
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-5 gap-2 mb-3">
                  {imagePreviews.map((url, idx) => (
                    <div key={idx} className="relative group aspect-square">
                      <img src={url} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover rounded-lg border border-gray-200" />
                      {idx === 0 && (
                        <div className="absolute top-1 left-1 bg-gold-primary text-text-main text-[9px] font-bold px-1.5 py-0.5 rounded">
                          MAIN
                        </div>
                      )}
                      <button
                        type="button" onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Drop zone */}
              {imageFiles.length < MAX_IMAGES && (
                <label className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-5 cursor-pointer hover:border-gold-primary hover:bg-gold-primary/5 transition-all">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-700">Click to add images</p>
                    <p className="text-xs text-gray-400 mt-0.5">or drag & drop here</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file" multiple accept=".jpg,.jpeg,.png,.webp"
                    onChange={handleFileChange} className="hidden"
                  />
                </label>
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 flex-shrink-0">
          <button
            type="button" onClick={handleClose}
            className="px-5 py-2.5 bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 font-semibold rounded-xl transition-all text-sm cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit" form="add-product-form" disabled={isSubmitting}
            className="px-6 py-2.5 bg-gold-primary hover:bg-gold-hover text-text-main font-bold rounded-xl transition-all duration-300 shadow-md shadow-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
          >
            <ImageIcon className="w-4 h-4" />
            {isSubmitting ? 'Adding...' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  );
}
