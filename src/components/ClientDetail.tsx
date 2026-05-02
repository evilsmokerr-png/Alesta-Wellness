import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, getDocs, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, Plus, History, Package, Zap, StickyNote, Save, CheckCircle2, ChevronDown, ChevronUp, Stethoscope, Trash2, AlertCircle, ShoppingCart, CreditCard, Banknote, Receipt, Percent, Tag as TagIcon, X, Phone, Smartphone, Pencil, RotateCcw, Download, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays, parseISO, differenceInDays, parse } from 'date-fns';
import { safeToDate, safeFormat } from '../lib/dateUtils';
import { Client, Treatment } from '../types';
import { handleFirestoreError } from '../lib/errorHandlers';

interface ClientDetailProps {
  userId: string;
  userRole?: 'admin' | 'staff';
  client: Client;
  onBack: () => void;
  onUpdate: (client: Client) => void;
  masterTreatments?: string[];
  masterProducts?: string[];
  onRequestDeleteClient?: (id: string) => void;
  onRequestDeleteTreatment?: (clientId: string, treatmentId: string) => void;
  initialAddTreatment?: boolean;
}

const PLACEHOLDER_DATE = new Date();

export default function ClientDetail({ 
  userId, 
  userRole = 'admin', 
  client, 
  onBack, 
  onUpdate, 
  masterTreatments = [], 
  masterProducts = [],
  onRequestDeleteClient,
  onRequestDeleteTreatment,
  initialAddTreatment = false
}: ClientDetailProps) {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [isAddingTreatment, setIsAddingTreatment] = useState(initialAddTreatment);
  const [isLogging, setIsLogging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmingTreatmentId, setConfirmingTreatmentId] = useState<string | null>(null);
  const [editingTreatmentId, setEditingTreatmentId] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileData, setEditProfileData] = useState({ name: client.name, phone: client.phone, address: client.address || '' });
  const [splitPayments, setSplitPayments] = useState<{method: 'Cash' | 'PhonePe' | 'POS' | 'POS QR Code', amount: number}[]>([]);

  // Suggestion states
  const [treatmentSuggestions, setTreatmentSuggestions] = useState<string[]>([]);
  const [productSuggestions, setProductSuggestions] = useState<string[]>([]);
  const [activeSuggestionField, setActiveSuggestionField] = useState<'treatment' | 'product' | null>(null);

    const [newTreatment, setNewTreatment] = useState({
    treatmentName: '',
    productUsage: '',
    doctorName: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    followUpDate: '',
    followUpDays: '',
    notes: '',
    paidAmount: 0,
    paymentMethod: 'Cash' as 'Cash' | 'PhonePe' | 'POS' | 'POS QR Code',
    serviceMRP: 0,
    serviceDiscount: 0,
    serviceDiscountType: 'percentage' as 'percentage' | 'fixed',
  });

  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);

  const [productList, setProductList] = useState<{name: string, qty: number, mrp: number, discount: number, discountType: 'percentage' | 'fixed'}[]>([]);
  const [servicesList, setServicesList] = useState<{name: string, mrp: number, discount: number, discountType: 'percentage' | 'fixed', productUsage: string}[]>([]);
  const [currentProduct, setCurrentProduct] = useState({ name: '', qty: 1, mrp: 0, discount: 0, discountType: 'percentage' as 'percentage' | 'fixed' });

  const addService = () => {
    if (!newTreatment.treatmentName.trim()) return;
    setServicesList([...servicesList, {
      name: newTreatment.treatmentName.trim(),
      mrp: newTreatment.serviceMRP || 0,
      discount: newTreatment.serviceDiscount || 0,
      discountType: newTreatment.serviceDiscountType || 'percentage',
      productUsage: newTreatment.productUsage || ''
    }]);
    setNewTreatment({
      ...newTreatment,
      treatmentName: '',
      serviceMRP: 0,
      serviceDiscount: 0,
      serviceDiscountType: 'percentage',
      productUsage: ''
    });
  };

  const removeService = (index: number) => {
    setServicesList(servicesList.filter((_, i) => i !== index));
  };

  const addProduct = () => {
    if (!currentProduct.name) return;
    setProductList([...productList, { 
      ...currentProduct,
      mrp: currentProduct.mrp || 0,
      discount: currentProduct.discount || 0
    }]);
    setCurrentProduct({ name: '', qty: 1, mrp: 0, discount: 0, discountType: 'percentage' });
  };

  const removeProduct = (index: number) => {
    setProductList(productList.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    const productsTotal = productList.reduce((acc, p) => {
      const price = p.mrp * p.qty;
      const disc = p.discountType === 'percentage' ? (price * p.discount / 100) : p.discount;
      return acc + (price - disc);
    }, 0);

    const servicesTotalFromList = servicesList.reduce((acc, s) => {
      const disc = s.discountType === 'percentage' ? (s.mrp * s.discount / 100) : s.discount;
      return acc + (s.mrp - disc);
    }, 0);

    // Support for the "current" service if not yet explicitly added to list
    let currentServiceTotal = 0;
    // Don't count current service if we're editing and have a services list (already in the list)
    if (newTreatment.treatmentName.trim()) {
      const sMRP = newTreatment.serviceMRP || 0;
      const sDisc = newTreatment.serviceDiscount || 0;
      currentServiceTotal = newTreatment.serviceDiscountType === 'percentage' 
        ? sMRP - (sMRP * sDisc / 100) 
        : sMRP - sDisc;
    }

    return productsTotal + servicesTotalFromList + currentServiceTotal;
  };

  const totalAmount = calculateTotal();

  const handleEditTreatment = (t: Treatment) => {
    setEditingTreatmentId(t.id || null);
    const loadedServices = t.services || [];
    setProductList(t.products || []);
    setSplitPayments(t.splitPayments || []);
    
    const staffArray = t.doctorName ? t.doctorName.split(', ') : [];
    setSelectedStaff(staffArray);

    const fDate = t.followUpDate ? safeToDate(t.followUpDate) : null;
    const tDate = safeToDate(t.date);
    const days = fDate ? differenceInDays(fDate, tDate).toString() : '';

    // If it's a single service, pull it into the primary form state for easier editing
    let initialName = t.treatmentName;
    let initialUsage = t.productUsage || '';
    let initialMRP = t.serviceMRP || 0;
    let initialDisc = t.serviceDiscount || 0;
    let initialDiscType = t.serviceDiscountType || 'percentage';
    let remainingServices = loadedServices;

    if (loadedServices.length === 1) {
      const s = loadedServices[0];
      initialName = s.name;
      initialUsage = s.productUsage || '';
      initialMRP = s.mrp !== undefined ? s.mrp : (t.serviceMRP || 0);
      initialDisc = s.discount !== undefined ? s.discount : (t.serviceDiscount || 0);
      initialDiscType = s.discountType || (t.serviceDiscountType || 'percentage');
      remainingServices = []; // Move it to the main inputs
    } else if (loadedServices.length > 1) {
      // Multi-service case: keep chips, keep main input empty for adding more
      initialName = '';
      initialUsage = '';
      initialMRP = 0;
      initialDisc = 0;
      initialDiscType = 'percentage';
    }

    setServicesList(remainingServices);

    setNewTreatment({
      treatmentName: initialName,
      productUsage: initialUsage,
      doctorName: t.doctorName || '',
      date: format(tDate, 'yyyy-MM-dd'),
      followUpDate: fDate ? format(fDate, 'yyyy-MM-dd') : '',
      followUpDays: days,
      notes: t.notes || '',
      paidAmount: t.paidAmount || 0,
      paymentMethod: t.paymentMethod || 'Cash',
      serviceMRP: initialMRP,
      serviceDiscount: initialDisc,
      serviceDiscountType: initialDiscType,
    });
    
    setIsAddingTreatment(true);
    setShowHistory(false); // Scroll up to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingTreatmentId(null);
    setServicesList([]);
    setSplitPayments([]);
    setSelectedStaff([]);
    setNewTreatment({
      treatmentName: '',
      productUsage: '',
      doctorName: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      followUpDate: '',
      followUpDays: '',
      notes: '',
      paidAmount: 0,
      paymentMethod: 'Cash',
      serviceMRP: 0,
      serviceDiscount: 0,
      serviceDiscountType: 'percentage',
    });
    setProductList([]);
  };

  useEffect(() => {
    if (!userId || !client.id) return;

    const q = query(
      collection(db, 'clients', client.id, 'treatments'),
      where('ownerId', '==', userId),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTreatments(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) } as Treatment)));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching treatments:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [client.id, userId]);

  const handleLogTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!client.id) {
      alert("Error: Client ID is missing. Cannot save record.");
      return;
    }

    // Determine final list of services - avoid duplicates from the "current" input
    const finalServices = [...servicesList];
    if (newTreatment.treatmentName.trim()) {
      // Check if this service is already in the list to prevent duplicates
      const isDuplicate = finalServices.some(s => 
        s.name.toLowerCase() === newTreatment.treatmentName.trim().toLowerCase() && 
        s.productUsage === newTreatment.productUsage
      );
      
      if (!isDuplicate) {
        finalServices.push({
          name: newTreatment.treatmentName.trim(),
          mrp: newTreatment.serviceMRP || 0,
          discount: newTreatment.serviceDiscount || 0,
          discountType: newTreatment.serviceDiscountType || 'percentage',
          productUsage: newTreatment.productUsage || ''
        });
      }
    }

    if (finalServices.length === 0 && productList.length === 0) {
      alert("Please add at least one treatment service or product");
      return;
    }

    if (selectedStaff.length === 0) {
      alert("IMPORTANT: Please select the doctor or staff who performed the treatment from the list above.");
      return;
    }

    setIsLogging(true);
    try {
      const displayTreatmentName = finalServices.length > 0 
        ? finalServices.map(s => s.name).join(' + ')
        : (productList.length > 0 ? "Product Purchase Only" : "Clinical Visit");

      const displayProductUsage = finalServices.map(s => s.productUsage).filter(Boolean).join(' | ');

      const isTodayRecord = newTreatment.date === format(new Date(), 'yyyy-MM-dd');
      const recordDate = isTodayRecord ? new Date() : parse(newTreatment.date, 'yyyy-MM-dd', new Date());

      const calculatedPaidAmount = splitPayments.length > 0 
        ? splitPayments.reduce((acc, p) => acc + p.amount, 0) 
        : (newTreatment.paidAmount || 0);

      const treatmentData = {
        doctorName: selectedStaff.join(', '),
        treatmentName: displayTreatmentName,
        productUsage: displayProductUsage,
        notes: newTreatment.notes?.trim() || '',
        ownerId: userId,
        clientName: client.name,
        clientPhone: client.phone,
        date: recordDate,
        followUpDate: newTreatment.followUpDate ? new Date(newTreatment.followUpDate) : null,
        products: productList,
        services: finalServices,
        splitPayments: splitPayments,
        totalAmount: userRole === 'admin' ? totalAmount : 0,
        paidAmount: userRole === 'admin' ? calculatedPaidAmount : 0,
        balanceAmount: userRole === 'admin' ? Math.max(0, totalAmount - calculatedPaidAmount) : 0,
        paymentPending: userRole === 'admin' ? (totalAmount > calculatedPaidAmount) : (servicesList.length > 0 || productList.length > 0),
        addedByRole: userRole,
        updatedAt: serverTimestamp(),
      };

      console.log("Saving treatment record:", treatmentData);

      if (editingTreatmentId) {
        await updateDoc(doc(db, 'clients', client.id, 'treatments', editingTreatmentId), treatmentData);
        alert("Visit record updated successfully");
      } else {
        await addDoc(collection(db, 'clients', client.id, 'treatments'), {
          ...treatmentData,
          createdAt: serverTimestamp(),
        });
        alert("Clinical visit saved successfully");
      }
      
      await updateDoc(doc(db, 'clients', client.id), {
        updatedAt: serverTimestamp()
      });

      resetForm();
      setIsAddingTreatment(false);
      setShowHistory(true);
      if (onUpdate) onUpdate({ ...client, updatedAt: new Date() } as any);
    } catch (error) {
      console.error("Critical error in handleLogTreatment:", error);
      const msg = handleFirestoreError(error, editingTreatmentId ? 'update' : 'create', `clients/${client.id}/treatments`);
      alert(msg);
    } finally {
      setIsLogging(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client.id) return;
    
    try {
      await updateDoc(doc(db, 'clients', client.id), {
        ...editProfileData,
        updatedAt: serverTimestamp()
      });
      onUpdate({ ...client, ...editProfileData });
      setIsEditingProfile(false);
      alert("Patient profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile");
    }
  };

  const handleDeleteClient = () => {
    if (!client.id || !onRequestDeleteClient) return;
    onRequestDeleteClient(client.id);
  };

  const handleDeleteTreatment = (treatmentId: string) => {
    if (!client.id || !onRequestDeleteTreatment) return;
    onRequestDeleteTreatment(client.id, treatmentId);
    setConfirmingTreatmentId(null);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-brand-muted hover:text-brand-primary transition-colors font-semibold text-sm group"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div className="h-4 w-[1px] bg-brand-border hidden sm:block"></div>
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => {
                if (isAddingTreatment) {
                  resetForm();
                  setIsAddingTreatment(false);
                } else {
                  setIsAddingTreatment(true);
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg ${
                isAddingTreatment 
                  ? 'bg-slate-100 text-brand-secondary border border-brand-border' 
                  : 'bg-brand-primary text-white shadow-brand-primary/20 hover:scale-105 active:scale-95'
              }`}
            >
              {isAddingTreatment ? (
                <><X size={14} /> Cancel Entry</>
              ) : (
                <><Plus size={14} /> Add New Treatment</>
              )}
            </button>

            {!isAddingTreatment && (
              <button 
                onClick={() => {
                  import('../lib/exportUtils').then(m => {
                    const data = m.prepareTreatmentDataForExport(treatments, { [client.id!]: client });
                    m.exportToExcel([{ data, name: 'Medical History' }], `History_${client.name.replace(/\s+/g, '_')}`);
                  });
                }}
                className="px-4 py-2 bg-white border border-brand-border rounded-xl text-xs font-bold text-brand-secondary hover:bg-slate-50 transition-all flex items-center gap-2"
                title="Export History to Excel"
              >
                <Download size={14} className="text-emerald-500" />
                History
              </button>
            )}
          </div>
        </div>

        <button 
          onClick={handleDeleteClient}
          className="flex items-center gap-2 text-[10px] font-bold text-red-100 hover:text-red-600 bg-red-600/10 hover:bg-red-50 uppercase tracking-widest transition-colors px-3 py-1.5 rounded-lg border border-red-100/50"
        >
          <Trash2 size={12} />
          Delete Patient Record
        </button>
      </div>

      {/* Client Profile Card */}
      <div className="section-card">
        <div className="section-title flex justify-between items-center">
          <span>Patient Profile</span>
          {!isEditingProfile && (
            <button 
              onClick={() => {
                setEditProfileData({ name: client.name, phone: client.phone, address: client.address || '' });
                setIsEditingProfile(true);
              }}
              className="px-3 py-1 bg-white border border-brand-border rounded-lg text-[10px] font-bold text-brand-primary hover:bg-brand-primary hover:text-white transition-all flex items-center gap-1.5"
            >
              <Pencil size={12} />
              Edit Profile
            </button>
          )}
        </div>
        <div className="p-5 sm:p-8">
          {isEditingProfile ? (
            <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest block ml-1">Full Name</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-brand-border rounded-xl text-sm focus:border-brand-primary outline-none font-bold text-brand-secondary"
                  value={editProfileData.name}
                  onChange={(e) => setEditProfileData({ ...editProfileData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest block ml-1">Phone Number</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-brand-border rounded-xl text-sm focus:border-brand-primary outline-none font-medium text-brand-secondary"
                  value={editProfileData.phone}
                  onChange={(e) => setEditProfileData({ ...editProfileData, phone: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest block ml-1">Home Address</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-brand-border rounded-xl text-sm focus:border-brand-primary outline-none font-medium text-brand-secondary"
                  value={editProfileData.address}
                  onChange={(e) => setEditProfileData({ ...editProfileData, address: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <button 
                  type="submit"
                  className="flex-1 py-2 bg-brand-primary text-white rounded-xl text-[10px] font-bold hover:bg-brand-primary/90 transition-all shadow-md"
                >
                  Save Changes
                </button>
                <button 
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="px-4 py-2 bg-slate-100 text-brand-muted rounded-xl text-[10px] font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-muted uppercase tracking-wider block">Full Name</label>
                <span className="text-sm sm:text-base font-bold text-brand-secondary">{client.name}</span>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-muted uppercase tracking-wider block">Phone Number</label>
                <span className="mono text-xs sm:text-sm text-brand-secondary font-medium">{client.phone}</span>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-muted uppercase tracking-wider block">Home Address</label>
                <span className="text-xs sm:text-sm font-medium text-brand-secondary truncate block">{client.address || 'N/A'}</span>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-muted uppercase tracking-wider block">Member Since</label>
                <span className="text-xs sm:text-sm font-medium text-brand-secondary block">
                  {client.createdAt ? safeFormat(client.createdAt, 'MMM d, yyyy') : 'Recent'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Treatment Form Card (Conditional) */}
      <AnimatePresence>
        {isAddingTreatment && (
          <motion.div 
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            className="overflow-hidden"
          >
            <div className="section-card mt-2">
              <div className="section-title bg-brand-primary/5 border-b border-brand-primary/10 text-brand-primary">
                {editingTreatmentId ? 'Modify Treatment Record' : 'New Treatment Entry'}
              </div>
              <form onSubmit={handleLogTreatment} className="space-y-0">
                <div className="p-5 sm:p-8 space-y-6">
                  {/* ... form content continues below ... */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 items-start">
              <div className="sm:col-span-1 lg:col-span-1 space-y-1.5 relative">
                <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest block ml-1">Treatment Name</label>
                <input
                  type="text"
                  placeholder="Laser Resurfacing"
                  autoComplete="off"
                  className="w-full px-4 py-2.5 bg-white border border-brand-border rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none"
                  value={newTreatment.treatmentName}
                  onFocus={() => setActiveSuggestionField('treatment')}
                  onBlur={() => setTimeout(() => setActiveSuggestionField(null), 200)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewTreatment({ ...newTreatment, treatmentName: val });
                    if (val.length > 0) {
                      const matches = masterTreatments.filter(t => t.toLowerCase().includes(val.toLowerCase())).slice(0, 5);
                      setTreatmentSuggestions(matches);
                    } else {
                      setTreatmentSuggestions([]);
                    }
                  }}
                />
                <AnimatePresence>
                  {activeSuggestionField === 'treatment' && treatmentSuggestions.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute z-[60] left-0 right-0 top-full mt-1 bg-white border border-brand-border rounded-xl shadow-xl overflow-hidden"
                    >
                      {treatmentSuggestions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setNewTreatment({ ...newTreatment, treatmentName: s });
                            setTreatmentSuggestions([]);
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs font-bold text-brand-secondary hover:bg-brand-primary/5 hover:text-brand-primary transition-colors border-b border-slate-50 last:border-0"
                        >
                          {s}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex flex-wrap gap-1.5 mt-1.5 px-0.5">
                  {['Doctor Consultation', 'Laser Treatment', 'HydraFacial', 'Chemical Peel'].map(name => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setNewTreatment(prev => ({ ...prev, treatmentName: name }))}
                      className="text-[9px] font-bold px-2 py-1 rounded-lg border border-brand-border bg-white text-brand-muted hover:border-brand-primary hover:text-brand-primary transition-all uppercase tracking-tighter"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

            <div className="space-y-1.5 relative">
              <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest block ml-1">Intensity / Level</label>
              <input
                type="text"
                placeholder="30J / Hydro-Gel"
                autoComplete="off"
                className="w-full px-4 py-2.5 bg-white border border-brand-border rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none"
                value={newTreatment.productUsage}
                onFocus={() => setActiveSuggestionField('product')}
                onBlur={() => setTimeout(() => setActiveSuggestionField(null), 200)}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewTreatment({ ...newTreatment, productUsage: val });
                  if (val.length > 0) {
                    const matches = masterProducts.filter(p => p.toLowerCase().includes(val.toLowerCase())).slice(0, 5);
                    setProductSuggestions(matches);
                  } else {
                    setProductSuggestions([]);
                  }
                }}
              />
              <AnimatePresence>
                {activeSuggestionField === 'product' && productSuggestions.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute z-[60] left-0 right-0 top-full mt-1 bg-white border border-brand-border rounded-xl shadow-xl overflow-hidden"
                  >
                    {productSuggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setNewTreatment({ ...newTreatment, productUsage: s });
                          setProductSuggestions([]);
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs font-bold text-brand-secondary hover:bg-brand-primary/5 hover:text-brand-primary transition-colors border-b border-slate-50 last:border-0"
                      >
                        {s}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest block ml-1">Follow-up (After Days)</label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="e.g. 4"
                  className="w-full px-4 py-2.5 bg-white border border-brand-border rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none"
                  value={newTreatment.followUpDays}
                  onChange={(e) => {
                    const days = e.target.value;
                    const daysNum = parseInt(days);
                    let computedDate = '';
                    if (!isNaN(daysNum)) {
                      computedDate = format(addDays(parseISO(newTreatment.date), daysNum), 'yyyy-MM-dd');
                    }
                    setNewTreatment({ ...newTreatment, followUpDays: days, followUpDate: computedDate });
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest block ml-1">Treatment Date</label>
              <input
                type="date"
                className="w-full px-4 py-2.5 bg-white border border-brand-border rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none font-bold text-brand-secondary"
                value={newTreatment.date}
                onChange={(e) => {
                  const newDate = e.target.value;
                  let followUpDate = newTreatment.followUpDate;
                  if (newTreatment.followUpDays) {
                    const daysNum = parseInt(newTreatment.followUpDays);
                    if (!isNaN(daysNum)) {
                      followUpDate = format(addDays(parseISO(newDate), daysNum), 'yyyy-MM-dd');
                    }
                  }
                  setNewTreatment({ ...newTreatment, date: newDate, followUpDate });
                }}
              />
            </div>

            <div className="space-y-1.5 lg:col-span-2">
              <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest block ml-1">Select Doctor / Staff (Multiple allowed)</label>
              <div className="flex flex-wrap gap-2">
                {[
                  'Dr. Debahuti Pattnaik', 
                  'Dr. Sweta Sucharita', 
                  'Dr. Manoranjan',
                  'Amisha',
                  'Subhalaxmi',
                  'Namita'
                ].map((doc) => {
                  const isSelected = selectedStaff.includes(doc);
                  return (
                    <button
                      key={doc}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedStaff(selectedStaff.filter(s => s !== doc));
                        } else {
                          setSelectedStaff([...selectedStaff, doc]);
                        }
                      }}
                      className={`px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all border ${
                        isSelected 
                          ? 'bg-brand-primary text-white border-brand-primary shadow-sm shadow-brand-primary/20' 
                          : 'bg-white text-brand-muted border-brand-border hover:border-brand-primary/30'
                      }`}
                    >
                      {doc.includes('.') ? doc.split('. ')[1].split(' ')[0] : doc}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 space-y-6">
            <div className="flex items-center gap-2 mb-4 px-5 sm:px-8">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-brand-primary flex items-center justify-center">
                <Plus size={16} />
              </div>
              <h4 className="text-xs font-bold text-brand-secondary uppercase tracking-widest">Visit Items (Treatments & Products)</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-5 sm:px-8">
              {/* Service Entry */}
              <div className="bg-indigo-50/30 p-5 rounded-2xl border border-indigo-100/50 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={14} className="text-brand-primary" />
                  <span className="text-[10px] font-bold text-brand-secondary uppercase tracking-widest">Add Treatment Service</span>
                </div>
                
                <div className="space-y-4">
                  <div className="relative">
                    <label className="text-[9px] font-bold text-brand-muted uppercase tracking-widest block ml-1 mb-1">Service Name</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 bg-white border border-brand-border rounded-xl text-sm outline-none focus:border-brand-primary"
                      placeholder="e.g. Laser Hair Removal"
                      value={newTreatment.treatmentName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewTreatment({ ...newTreatment, treatmentName: val });
                        if (val.length > 0) {
                          const matches = masterTreatments.filter(t => t.toLowerCase().includes(val.toLowerCase())).slice(0, 5);
                          setTreatmentSuggestions(matches);
                        } else {
                          setTreatmentSuggestions([]);
                        }
                      }}
                      onFocus={() => setActiveSuggestionField('treatment')}
                      onBlur={() => setTimeout(() => setActiveSuggestionField(null), 200)}
                    />
                    <AnimatePresence>
                      {activeSuggestionField === 'treatment' && treatmentSuggestions.length > 0 && (
                        <motion.div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-brand-border rounded-xl shadow-xl overflow-hidden">
                          {treatmentSuggestions.map((s, i) => (
                            <button key={i} type="button" onClick={() => setNewTreatment({ ...newTreatment, treatmentName: s })} className="w-full text-left px-4 py-2 text-xs font-bold text-brand-secondary hover:bg-brand-primary/5 transition-colors">
                              {s}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-bold text-brand-muted uppercase tracking-widest block ml-1 mb-1">Intensity / Level</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 bg-white border border-brand-border rounded-xl text-sm outline-none focus:border-brand-primary"
                        placeholder="30J / Med"
                        value={newTreatment.productUsage}
                        onChange={(e) => setNewTreatment({ ...newTreatment, productUsage: e.target.value })}
                      />
                    </div>
                    {userRole === 'admin' && (
                      <div>
                        <label className="text-[9px] font-bold text-brand-muted uppercase tracking-widest block ml-1 mb-1">MRP (Fees)</label>
                        <input
                          type="number"
                          className="w-full px-4 py-2.5 bg-white border border-brand-border rounded-xl text-sm outline-none focus:border-brand-primary font-mono"
                          value={newTreatment.serviceMRP || ''}
                          onChange={(e) => setNewTreatment({ ...newTreatment, serviceMRP: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    )}
                  </div>

                  {userRole === 'admin' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-bold text-brand-muted uppercase tracking-widest block ml-1 mb-1">Disc Type</label>
                        <select 
                          className="w-full px-3 py-2 bg-white border border-brand-border rounded-xl text-xs outline-none"
                          value={newTreatment.serviceDiscountType}
                          onChange={(e) => setNewTreatment({ ...newTreatment, serviceDiscountType: e.target.value as any })}
                        >
                          <option value="percentage">%</option>
                          <option value="fixed">Fixed</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-brand-muted uppercase tracking-widest block ml-1 mb-1">Disc Value</label>
                        <input
                          type="number"
                          className="w-full px-4 py-2.5 bg-white border border-brand-border rounded-xl text-sm outline-none focus:border-brand-primary font-mono"
                          value={newTreatment.serviceDiscount || ''}
                          onChange={(e) => setNewTreatment({ ...newTreatment, serviceDiscount: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={addService}
                    className="w-full py-2.5 bg-brand-primary text-white rounded-xl text-xs font-bold shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Add Service to List
                  </button>
                </div>
              </div>

              {/* Product Entry */}
              <div className="bg-emerald-50/30 p-5 rounded-2xl border border-emerald-100/50 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Package size={14} className="text-emerald-600" />
                  <span className="text-[10px] font-bold text-brand-secondary uppercase tracking-widest">Add Product (Home Care)</span>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <label className="text-[9px] font-bold text-brand-muted uppercase tracking-widest block ml-1 mb-1">Product Name</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 bg-white border border-brand-border rounded-xl text-sm outline-none focus:border-brand-primary"
                      placeholder="e.g. SPF 50 Cream"
                      value={currentProduct.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCurrentProduct({ ...currentProduct, name: val });
                        if (val.length > 0) {
                          const matches = masterProducts.filter(p => p.toLowerCase().includes(val.toLowerCase())).slice(0, 5);
                          setProductSuggestions(matches);
                        } else {
                          setProductSuggestions([]);
                        }
                      }}
                      onFocus={() => setActiveSuggestionField('product')}
                      onBlur={() => setTimeout(() => setActiveSuggestionField(null), 200)}
                    />
                    <AnimatePresence>
                      {activeSuggestionField === 'product' && productSuggestions.length > 0 && (
                        <motion.div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-brand-border rounded-xl shadow-xl overflow-hidden">
                          {productSuggestions.map((s, i) => (
                            <button key={i} type="button" onClick={() => setCurrentProduct({ ...currentProduct, name: s })} className="w-full text-left px-4 py-2 text-xs font-bold text-brand-secondary hover:bg-brand-primary/5 transition-colors">
                              {s}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-bold text-brand-muted uppercase tracking-widest block ml-1 mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        className="w-full px-4 py-2.5 bg-white border border-brand-border rounded-xl text-sm outline-none focus:border-brand-primary"
                        value={currentProduct.qty}
                        onChange={(e) => setCurrentProduct({ ...currentProduct, qty: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                    {userRole === 'admin' && (
                      <div>
                        <label className="text-[9px] font-bold text-brand-muted uppercase tracking-widest block ml-1 mb-1">MRP</label>
                        <input
                          type="number"
                          className="w-full px-4 py-2.5 bg-white border border-brand-border rounded-xl text-sm outline-none focus:border-brand-primary font-mono"
                          value={currentProduct.mrp || ''}
                          onChange={(e) => setCurrentProduct({ ...currentProduct, mrp: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    )}
                  </div>

                  {userRole === 'admin' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-bold text-brand-muted uppercase tracking-widest block ml-1 mb-1">Disc Type</label>
                        <select 
                          className="w-full px-3 py-2 bg-white border border-brand-border rounded-xl text-xs outline-none"
                          value={currentProduct.discountType}
                          onChange={(e) => setCurrentProduct({ ...currentProduct, discountType: e.target.value as any })}
                        >
                          <option value="percentage">%</option>
                          <option value="fixed">Fixed</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-brand-muted uppercase tracking-widest block ml-1 mb-1">Disc Value</label>
                        <input
                          type="number"
                          className="w-full px-4 py-2.5 bg-white border border-brand-border rounded-xl text-sm outline-none focus:border-brand-primary font-mono"
                          value={currentProduct.discount || ''}
                          onChange={(e) => setCurrentProduct({ ...currentProduct, discount: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={addProduct}
                    className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Add Product to List
                  </button>
                </div>
              </div>
            </div>

            {/* Current Session Summary */}
            {(servicesList.length > 0 || productList.length > 0) && (
              <div className="mx-5 sm:mx-8 bg-slate-50 p-6 rounded-3xl border border-slate-200/50 space-y-4">
                <h5 className="text-[10px] font-black text-brand-muted uppercase tracking-widest mb-4">Items in this visit</h5>
                <div className="space-y-3">
                  {servicesList.map((s, idx) => (
                    <div key={`s-${idx}`} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100 shadow-sm group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-brand-primary flex items-center justify-center">
                          <Zap size={14} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-brand-secondary uppercase">{s.name}</div>
                          {s.productUsage && <div className="text-[9px] font-bold text-brand-muted uppercase tracking-tighter">Intensity: {s.productUsage}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {userRole === 'admin' && (
                          <div className="text-xs font-bold text-brand-secondary font-mono">
                            ₹{(s.mrp - (s.discountType === 'percentage' ? (s.mrp * s.discount / 100) : s.discount)).toFixed(0)}
                          </div>
                        )}
                        <button type="button" onClick={() => removeService(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {productList.map((p, idx) => (
                    <div key={`p-${idx}`} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <Package size={14} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-brand-secondary uppercase">{p.name} (x{p.qty})</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {userRole === 'admin' && (
                          <div className="text-xs font-bold text-brand-secondary font-mono">
                             ₹{((p.mrp * p.qty) - (p.discountType === 'percentage' ? ((p.mrp * p.qty) * p.discount / 100) : p.discount)).toFixed(0)}
                          </div>
                        )}
                        <button type="button" onClick={() => removeProduct(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100">
            {userRole === 'admin' ? (
              <div className="px-5 sm:px-8 pb-8 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Summary & Note */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest block ml-1">Visit Notes (Clinical & General)</label>
                      <textarea
                        className="w-full px-4 py-3 bg-white border border-brand-border rounded-2xl text-sm focus:border-brand-primary outline-none transition-all resize-none h-32"
                        placeholder="Add details about the visit, clinical observations, or specific results observed..."
                        value={newTreatment.notes}
                        onChange={(e) => setNewTreatment({ ...newTreatment, notes: e.target.value })}
                      ></textarea>
                    </div>
                  </div>

                  {/* Billing Side Column */}
                  <div className="bg-white p-6 rounded-3xl border border-brand-border shadow-md space-y-6">
                    <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                      <span className="text-xs font-bold text-brand-muted uppercase tracking-widest">Total Billable</span>
                      <span className="text-xl font-black text-brand-secondary font-mono">₹{totalAmount.toFixed(2)}</span>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest ml-1">Payment Modes</label>
                        <button 
                          type="button" 
                          onClick={() => setSplitPayments([...splitPayments, { method: 'Cash', amount: 0 }])}
                          className="text-[9px] font-bold text-brand-primary bg-blue-50 px-2 py-0.5 rounded border border-brand-primary/10"
                        >
                          Add Split
                        </button>
                      </div>

                      {splitPayments.length > 0 ? (
                        <div className="space-y-2">
                          {splitPayments.map((p, idx) => (
                            <div key={idx} className="flex gap-1.5">
                              <select className="flex-1 bg-slate-50 border border-brand-border rounded-xl text-[10px] px-2 py-2" value={p.method} onChange={(e) => {
                                const next = [...splitPayments];
                                next[idx].method = e.target.value as any;
                                setSplitPayments(next);
                              }}>
                                <option value="Cash">Cash</option>
                                <option value="PhonePe">PhonePe</option>
                                <option value="POS">POS</option>
                                <option value="POS QR Code">POS QR Code</option>
                              </select>
                              <input type="number" className="w-20 px-2 py-2 bg-white border border-brand-border rounded-xl text-xs font-mono" value={p.amount} onChange={(e) => {
                                const next = [...splitPayments];
                                next[idx].amount = parseFloat(e.target.value) || 0;
                                setSplitPayments(next);
                              }} />
                              <button type="button" onClick={() => setSplitPayments(splitPayments.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500"><X size={14}/></button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {['Cash', 'PhonePe', 'POS', 'POS QR Code'].map(m => (
                            <button key={m} type="button" onClick={() => setNewTreatment({...newTreatment, paymentMethod: m as any})} className={`py-2 px-1 text-[9px] font-bold border rounded-xl transition-all ${newTreatment.paymentMethod === m ? 'bg-brand-primary text-white' : 'bg-white text-brand-muted hover:border-brand-primary'}`}>{m}</button>
                          ))}
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest ml-1">Paid Amount</label>
                        <input
                          readOnly={splitPayments.length > 0}
                          type="number"
                          className="w-full px-4 py-2 border border-brand-border rounded-xl text-lg font-black text-brand-secondary outline-none font-mono"
                          value={splitPayments.length > 0 ? splitPayments.reduce((acc, p) => acc + p.amount, 0) : newTreatment.paidAmount}
                          onChange={(e) => !splitPayments.length && setNewTreatment({ ...newTreatment, paidAmount: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      
                      <div className="pt-2 flex justify-between items-center text-red-500">
                        <span className="text-[9px] font-bold uppercase">Balance</span>
                        <span className="text-xs font-black font-mono">₹{(totalAmount - (splitPayments.length > 0 ? splitPayments.reduce((acc, p) => acc + p.amount, 0) : newTreatment.paidAmount)).toFixed(2)}</span>
                      </div>
                    </div>

                    <button
                      disabled={isLogging}
                      type="submit"
                      className="w-full py-4 bg-brand-primary text-white rounded-2xl text-sm font-bold shadow-lg shadow-brand-primary/20 hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
                    >
                      <Save size={18} />
                      {isLogging ? 'Saving...' : (editingTreatmentId ? 'Update Visit' : 'Finalize Visit')}
                    </button>
                    
                    {selectedStaff.length === 0 && (
                      <p className="text-[9px] text-red-500 font-bold italic animate-pulse text-center">
                        * Please choose staff members above before saving
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-5 sm:mx-8 pb-8">
                <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl flex items-start gap-4">
                  <div className="w-10 h-10 bg-white rounded-2xl shadow-sm border border-blue-100 flex items-center justify-center text-brand-primary shrink-0"><AlertCircle size={20} /></div>
                  <div className="flex-1 space-y-3">
                    <p className="text-xs font-bold text-brand-secondary uppercase tracking-widest">
                      Clinical Mode: {servicesList.length + (newTreatment.treatmentName.trim() ? 1 : 0) + productList.length} Items listed
                    </p>
                    <textarea
                        className="w-full px-4 py-3 bg-white border border-brand-border rounded-2xl text-sm focus:border-brand-primary outline-none transition-all resize-none h-24"
                        placeholder="Add clinical observations, next steps, or specific instructions..."
                        value={newTreatment.notes}
                        onChange={(e) => setNewTreatment({ ...newTreatment, notes: e.target.value })}
                      ></textarea>
                    
                    <button
                      disabled={isLogging || selectedStaff.length === 0}
                      type="submit"
                      className={`px-10 py-3 rounded-2xl text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${
                        selectedStaff.length > 0 
                          ? 'bg-brand-primary text-white shadow-brand-primary/20 hover:scale-[1.02]' 
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Save size={18} />
                      {isLogging ? 'Saving...' : 'Save Clinical Visit'}
                    </button>
                    {selectedStaff.length === 0 && (
                      <p className="text-[9px] text-red-500 font-bold italic mt-1 ml-1 animate-pulse">
                        * Please choose staff members above before saving
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Table Card */}
      <div className="section-card">
        <div className="section-title flex justify-between items-center px-4 sm:px-8">
          Clinical History
          <span className="text-[9px] sm:text-[10px] bg-slate-100 px-2 py-0.5 rounded text-brand-muted font-bold tracking-widest uppercase">{treatments.length} Records</span>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left border-collapse min-w-[600px] sm:min-w-0">
            <thead>
              <tr className="bg-slate-50/30">
                <th className="px-5 sm:px-8 py-3 sm:py-4 text-[10px] font-bold text-brand-muted uppercase tracking-wider border-b border-brand-border">Date</th>
                <th className="px-5 sm:px-8 py-3 sm:py-4 text-[10px] font-bold text-brand-muted uppercase tracking-wider border-b border-brand-border">Treatments</th>
                <th className="px-5 sm:px-8 py-3 sm:py-4 text-[10px] font-bold text-brand-muted uppercase tracking-wider border-b border-brand-border">Products</th>
                {userRole === 'admin' && <th className="px-5 sm:px-8 py-3 sm:py-4 text-[10px] font-bold text-brand-muted uppercase tracking-wider border-b border-brand-border">Billing</th>}
                <th className="px-5 sm:px-8 py-3 sm:py-4 text-[10px] font-bold text-brand-muted uppercase tracking-wider border-b border-brand-border text-right">Doctor</th>
                <th className="px-5 sm:px-8 py-3 sm:py-4 text-[10px] font-bold text-brand-muted uppercase tracking-wider border-b border-brand-border text-right">Follow-up</th>
                <th className="px-5 sm:px-8 py-3 sm:py-4 text-[10px] font-bold text-brand-muted uppercase tracking-wider border-b border-brand-border text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {treatments.map((t) => (
                <tr key={t.id} className="hover:bg-brand-row-hover transition-colors group">
                  <td className="px-5 sm:px-8 py-3 sm:py-4 mono text-[11px] sm:text-xs text-brand-muted">
                    {safeFormat(t.date, 'dd-MMM-yyyy')}
                  </td>
                  <td className="px-5 sm:px-8 py-3 sm:py-4">
                    <div className="flex flex-col gap-1.5">
                      {t.services && t.services.length > 0 ? (
                        t.services.map((s, si) => (
                          <div key={si} className="flex flex-col gap-0.5">
                             <span className="px-2 py-1 bg-blue-50 text-brand-primary text-[10px] sm:text-[11px] font-bold rounded-lg w-fit">
                              {s.name}
                            </span>
                            {s.productUsage && (
                              <span className="text-[9px] font-bold text-brand-muted px-1">Intensity: {s.productUsage}</span>
                            )}
                          </div>
                        ))
                      ) : (
                        <span className="px-2 py-1 bg-blue-50 text-brand-primary text-[10px] sm:text-[11px] font-bold rounded-lg w-fit">
                          {t.treatmentName}
                        </span>
                      )}
                      {userRole === 'admin' && t.paymentPending && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-50 text-orange-600 text-[8px] font-black uppercase rounded border border-orange-100 animate-pulse w-fit mt-1">
                          <AlertCircle size={8} /> Pending Pay
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 sm:px-8 py-3 sm:py-4 font-bold">
                    <div className="space-y-1">
                      {t.products && t.products.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {t.products.map((p, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[10px] text-brand-secondary bg-slate-50/50 p-1 rounded-lg border border-slate-100/50">
                              <Package size={10} className="text-emerald-500" />
                              <span>{p.name}</span>
                              <span className="bg-white px-1 rounded shadow-sm text-brand-primary font-mono font-black">x{p.qty}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-brand-muted font-medium italic">No products</span>
                      )}
                    </div>
                  </td>
                  {userRole === 'admin' && (
                    <td className="px-5 sm:px-8 py-3 sm:py-4">
                      <div className="space-y-0.5">
                        <div className="text-[11px] font-black text-brand-secondary font-mono">₹{(t.totalAmount || 0).toFixed(0)}</div>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600">
                            <CheckCircle2 size={8} /> Paid: ₹{(t.paidAmount || 0).toFixed(0)}
                          </div>
                          {(t.balanceAmount || 0) > 0 && (
                            <div className="flex items-center gap-1 text-[9px] font-bold text-red-500">
                              <AlertCircle size={8} /> Bal: ₹{(t.balanceAmount || 0).toFixed(0)}
                            </div>
                          )}
                          <div className="text-[8px] font-bold text-brand-muted uppercase tracking-tighter bg-slate-50 w-fit px-1 rounded">
                            {t.splitPayments && t.splitPayments.length > 0 ? (
                              <div className="flex flex-col gap-0.5">
                                {t.splitPayments.map((p, pi) => (
                                  <div key={pi} className="flex justify-between gap-2 min-w-[70px]">
                                    <span>{p.method}:</span>
                                    <span>₹{p.amount}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              t.paymentMethod || 'Cash'
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  )}
                  <td className="px-5 sm:px-8 py-3 sm:py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Stethoscope size={12} className="text-brand-muted" />
                      <span className="text-[11px] font-bold text-brand-secondary">{t.doctorName || '--'}</span>
                    </div>
                  </td>
                  <td className="px-5 sm:px-8 py-3 sm:py-4 text-[11px] sm:text-sm font-medium text-brand-muted italic text-right whitespace-nowrap">
                    {t.followUpDate ? safeFormat(t.followUpDate, 'dd-MMM-yy') : '--'}
                  </td>
                  <td className="px-5 sm:px-8 py-3 sm:py-4 text-right">
                    <AnimatePresence mode="wait">
                      {confirmingTreatmentId === t.id ? (
                        <motion.div 
                          initial={{ x: 10, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          exit={{ x: 10, opacity: 0 }}
                          className="flex items-center justify-end gap-1.5"
                        >
                          <button
                            onClick={() => handleDeleteTreatment(t.id!)}
                            className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded transition-colors border border-red-100"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmingTreatmentId(null)}
                            className="text-[10px] font-bold text-brand-muted hover:text-brand-secondary px-2 py-0.5"
                          >
                            Cancel
                          </button>
                        </motion.div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => handleEditTreatment(t)}
                            className="p-2 text-brand-muted hover:text-brand-primary transition-colors"
                            title="Edit Record"
                          >
                            <Pencil size={14} />
                          </button>
                          <button 
                            onClick={() => setConfirmingTreatmentId(t.id!)}
                            className="p-2 text-brand-muted hover:text-red-500 transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </AnimatePresence>
                  </td>
                </tr>
              ))}
              {treatments.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-8 py-16 text-center text-brand-muted font-medium">
                    No clinical history recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
