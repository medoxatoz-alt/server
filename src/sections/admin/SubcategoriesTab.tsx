'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Loader2, Plus, Trash2, FolderTree, ArrowUp, ArrowDown } from 'lucide-react';

interface SubcategoriesTabProps {
  isFetching: boolean;
  fetchError: boolean;
}

export default function SubcategoriesTab({ isFetching, fetchError }: SubcategoriesTabProps) {
  const [categoriesConfig, setCategoriesConfig] = useState<{mainCategories: {id: string, name: string}[], subcategories: Record<string, {id: string, name: string}[]>, docs: any[]}>({ mainCategories: [], subcategories: {}, docs: [] });
  const [loadingConfig, setLoadingConfig] = useState(true);
  
  const [selectedMainCatId, setSelectedMainCatId] = useState<string>('');
  const [newSubcatName, setNewSubcatName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const fetchCategories = async () => {
    setLoadingConfig(true);
    try {
      const res = await api.get('/categories');
      setCategoriesConfig(res.data);
      if (!selectedMainCatId && res.data.mainCategories.length > 0) {
        setSelectedMainCatId(res.data.mainCategories[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch categories config:', err);
      toast.error('Failed to load subcategories');
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAddSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubcatName.trim() || !selectedMainCatId) return;

    setIsAdding(true);
    try {
      await api.post('/categories/sub', {
        mainCategoryId: selectedMainCatId,
        name: newSubcatName
      });
      const catName = categoriesConfig.mainCategories.find(c => c.id === selectedMainCatId)?.name || selectedMainCatId;
      toast.success(`Added ${newSubcatName} to ${catName}`);
      setNewSubcatName('');
      fetchCategories();
    } catch (err) {
      toast.error('Failed to add subcategory');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteSubcategory = async (docId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    
    try {
      await api.delete(`/categories/sub/${docId}`);
      toast.success('Subcategory deleted');
      fetchCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete subcategory');
    }
  };
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const currentSubcats = categoriesConfig.docs.filter(doc => doc.mainCategoryId === selectedMainCatId);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === currentSubcats.length - 1)) return;

    const newDocs = [...categoriesConfig.docs];
    const catDocs = newDocs.filter(doc => doc.mainCategoryId === selectedMainCatId);
    const otherDocs = newDocs.filter(doc => doc.mainCategoryId !== selectedMainCatId);
    
    // Swap
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = catDocs[index];
    catDocs[index] = catDocs[targetIndex];
    catDocs[targetIndex] = temp;

    // Assign new orders
    catDocs.forEach((doc, i) => {
      doc.order = i;
    });

    setCategoriesConfig({
      ...categoriesConfig,
      docs: [...otherDocs, ...catDocs]
    });

    setHasUnsavedChanges(true);
  };

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    const catDocs = categoriesConfig.docs.filter(doc => doc.mainCategoryId === selectedMainCatId);
    try {
      await api.put('/categories/sub/reorder', {
        items: catDocs.map(d => ({ id: d.id, order: d.order }))
      });
      setHasUnsavedChanges(false);
      toast.success('Order saved successfully');
      fetchCategories();
    } catch (err) {
      toast.error('Failed to save order');
    } finally {
      setIsSavingOrder(false);
    }
  };
  if (isFetching || loadingConfig) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Loading subcategories...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="bg-red-50 text-red-500 p-6 rounded-xl border border-red-100 text-center">
        Failed to load categories. Please try again.
      </div>
    );
  }

  // Filter docs for the selected main category
  const currentSubcats = categoriesConfig.docs.filter(doc => doc.mainCategoryId === selectedMainCatId);
  const selectedCatName = categoriesConfig.mainCategories.find(c => c.id === selectedMainCatId)?.name || selectedMainCatId;

  return (
    <div className="space-y-6">
      
      {/* Header & Main Cat Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
            <FolderTree className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Manage Subcategories</h2>
            <p className="text-sm text-gray-500">Add or remove subcategories for the main collections.</p>
          </div>
        </div>

        <div className="w-full md:w-auto">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Select Main Category</label>
          <select 
            value={selectedMainCatId} 
            onChange={(e) => {
              if (hasUnsavedChanges && !confirm('You have unsaved order changes. Do you want to discard them?')) return;
              setSelectedMainCatId(e.target.value);
              setHasUnsavedChanges(false);
            }}
            className="w-full md:w-[300px] bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-teal-500 focus:border-teal-500 block px-3 py-2.5 outline-none transition-all"
          >
            {Array.isArray(categoriesConfig.mainCategories) && categoriesConfig.mainCategories.map((cat, idx) => {
              const catId = cat && typeof cat === 'object' && cat.id ? String(cat.id) : String(idx);
              const catName = cat && typeof cat === 'object' && cat.name 
                ? (typeof cat.name === 'string' ? cat.name : (cat.name as any).name || JSON.stringify(cat.name)) 
                : 'Unknown';
              return (
                <option key={catId} value={catId}>{catName}</option>
              );
            })}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Add New Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-fit">
          <h3 className="font-bold text-gray-900 mb-4">Add Subcategory</h3>
          <form onSubmit={handleAddSubcategory} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input 
                type="text" 
                value={newSubcatName}
                onChange={e => setNewSubcatName(e.target.value)}
                placeholder="e.g., Face Wash"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <button 
              type="submit"
              disabled={isAdding || !newSubcatName.trim()}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {isAdding ? 'Adding...' : 'Add Subcategory'}
            </button>
          </form>
        </div>

        {/* List of existing */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Subcategories in "{selectedCatName}"</h3>
            {hasUnsavedChanges && (
              <button
                onClick={handleSaveOrder}
                disabled={isSavingOrder}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                {isSavingOrder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {isSavingOrder ? 'Saving...' : 'Save Order'}
              </button>
            )}
          </div>
          
          <div className="p-0">
            {currentSubcats.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No subcategories found in this category.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {currentSubcats.map((doc, idx) => (
                  <li key={doc.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition-colors group">
                    <span className="text-sm font-medium text-gray-900">{doc.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleMove(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move Up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleMove(idx, 'down')}
                        disabled={idx === currentSubcats.length - 1}
                        className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move Down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteSubcategory(doc.id, doc.name)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-2"
                        title="Delete Subcategory"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
