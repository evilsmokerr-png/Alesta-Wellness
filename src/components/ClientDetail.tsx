import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, getDocs, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ArrowLeft, Plus, History, Package, Zap, StickyNote, Save, CheckCircle2, ChevronDown, ChevronUp, Stethoscope, Trash2, AlertCircle, ShoppingCart, CreditCard, Banknote, Receipt, Percent, Tag as TagIcon, X, Phone, Smartphone, Pencil, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays, parseISO, differenceInDays } from 'date-fns';
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
}

export default function ClientDetail({ userId, userRole = 'admin', client, onBack, onUpdate, masterTreatments = [], masterProducts = [] }: ClientDetailProps) {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [isAddingTreatment, setIsAddingTreatment] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmingTreatmentId, setConfirmingTreatmentId] = useState<string | null>(null);
  const [editingTreatmentId, setEditingTreatmentId] = useState<string | null>(null);
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
    setProductList([...productList, { ...currentProduct }]);
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
    setServicesList(loadedServices);
    setProductList(t.products || []);
    setSplitPayments(t.splitPayments || []);
    
    // Fix for double billing: If services list exists, don't populate the specific service fields
    // to avoid adding them twice in calculateTotal
    const fDate = t.followUpDate ? (t.followUpDate instanceof Date ? t.followUpDate : t.followUpDate.toDate()) : null;
    const tDate = t.date instanceof Date ? t.date : t.date.toDate();
    const days = fDate ? differenceInDays(fDate, tDate).toString() : '';

    setNewTreatment({
      treatmentName: loadedServices.length > 0 ? '' : t.treatmentName,
      productUsage: loadedServices.length > 0 ? '' : (t.productUsage || ''),
      doctorName: t.doctorName || '',
      date: format(tDate, 'yyyy-MM-dd'),
      followUpDate: fDate ? format(fDate, 'yyyy-MM-dd') : '',
      followUpDays: days,
      notes: t.notes || '',
      paidAmount: t.paidAmount || 0,
      paymentMethod: t.paymentMethod || 'Cash',
      serviceMRP: loadedServices.length > 0 ? 0 : (t.serviceMRP || 0),
      serviceDiscount: loadedServices.length > 0 ? 0 : (t.serviceDiscount || 0),
      serviceDiscountType: loadedServices.length > 0 ? 'percentage' : (t.serviceDiscountType || 'percentage'),
    });
    
    setIsAddingTreatment(true);
    setShowHistory(false); // Scroll up to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingTreatmentId(null);
    setServicesList([]);
    setSplitPayments([]);
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
    const fetchTreatments = async () => {
      try {
        const q = query(
          collection(db, 'clients', client.id!, 'treatments'),
          where('ownerId', '==', userId),
          orderBy('date', 'desc')
        );
        const snapshot = await getDocs(q);
        setTreatments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Treatment)));
      } catch (error) {
        console.error("Error fetching treatments:", error);
      } finally {
        setLoading(false);
      }
    };
    if (userId && client.id) fetchTreatments();
  }, [client.id, userId]);

  const handleLogTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalServices = [...servicesList];
    if (newTreatment.treatmentName.trim()) {
      finalServices.push({
        name: newTreatment.treatmentName.trim(),
        mrp: newTreatment.serviceMRP || 0,
        discount: newTreatment.serviceDiscount || 0,
        discountType: newTreatment.serviceDiscountType || 'percentage',
        productUsage: newTreatment.productUsage || ''
      });
    }

    if (finalServices.length === 0) {
      alert("Please add at least one treatment service");
      return;
    }

    if (!newTreatment.doctorName) {
      alert("Please select the doctor who performed the treatment");
      return;
    }

    setIsLogging(true);
    try {
      const displayTreatmentName = finalServices.length > 1 
        ? finalServices.map(s => s.name).join(' + ')
        : finalServices[0].name;

      const displayProductUsage = finalServices.map(s => s.productUsage).filter(Boolean).join(' | ');

      const treatmentData = {
        ...newTreatment,
        treatmentName: displayTreatmentName,
        productUsage: displayProductUsage,
        notes: newTreatment.notes?.trim(),
        ownerId: userId,
        clientName: client.name,
        clientPhone: client.phone,
        date: new Date(newTreatment.date),
        followUpDate: newTreatment.followUpDate ? new Date(newTreatment.followUpDate) : null,
        products: productList,
        services: finalServices,
        splitPayments: splitPayments,
        totalAmount: userRole === 'staff' ? 0 : totalAmount,
        paidAmount: userRole === 'staff' ? 0 : (splitPayments.length > 0 ? splitPayments.reduce((acc, p) => acc + p.amount, 0) : newTreatment.paidAmount),
        balanceAmount: userRole === 'staff' ? 0 : (totalAmount - (splitPayments.length > 0 ? splitPayments.reduce((acc, p) => acc + p.amount, 0) : (newTreatment.paidAmount || 0))),
        paymentPending: userRole === 'staff' || (totalAmount > 0 && (totalAmount - (splitPayments.length > 0 ? splitPayments.reduce((acc, p) => acc + p.amount, 0) : (newTreatment.paidAmount || 0))) > 0),
        addedByRole: userRole,
        updatedAt: serverTimestamp(),
      };

      if (editingTreatmentId) {
        await updateDoc(doc(db, 'clients', client.id!, 'treatments', editingTreatmentId), treatmentData);
        setTreatments(treatments.map(t => t.id === editingTreatmentId ? { ...t, ...treatmentData, date: treatmentData.date, followUpDate: treatmentData.followUpDate, updatedAt: new Date() } as any : t));
        alert("Treatment record updated");
      } else {
        const treatmentRef = await addDoc(collection(db, 'clients', client.id!, 'treatments'), {
          ...treatmentData,
          createdAt: serverTimestamp(),
        });
        
        const localTreatment = {
          id: treatmentRef.id,
          ...treatmentData,
          createdAt: new Date(),
          updatedAt: new Date(),
          date: treatmentData.date,
          followUpDate: treatmentData.followUpDate
        };
        setTreatments([localTreatment as any, ...treatments]);
        alert("Treatment successfully logged");
      }
      
      // Update client's updatedAt
      await updateDoc(doc(db, 'clients', client.id!), {
        updatedAt: serverTimestamp()
      });

      resetForm();
      setIsAddingTreatment(false);
      setShowHistory(true);
      onUpdate({ ...client, updatedAt: new Date() } as any);
    } catch (error) {
      const msg = handleFirestoreError(error, editingTreatmentId ? 'update' : 'create', `clients/${client.id}/treatments`);
      alert(msg);
    } finally {
      setIsLogging(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!client.id) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'clients', client.id));
      onBack();
    } catch (error) {
      console.error("Error deleting client:", error);
      alert("Failed to delete patient record. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteTreatment = async (treatmentId: string) => {
    if (!client.id) return;
    
    try {
      await deleteDoc(doc(db, 'clients', client.id, 'treatments', treatmentId));
      setTreatments(treatments.filter(t => t.id !== treatmentId));
      setConfirmingTreatmentId(null);
      // Update client's updatedAt to reflect change in records
      await updateDoc(doc(db, 'clients', client.id), {
        updatedAt: serverTimestamp()
      });
      onUpdate({ ...client, updatedAt: new Date() } as any);
    } catch (error) {
      const msg = handleFirestoreError(error, 'delete', `clients/${client.id}/treatments/${treatmentId}`);
      alert(msg);
    }
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
        </div>

        {!showDeleteConfirm ? (
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-widest transition-colors px-3 py-1.5 rounded-lg border border-red-50 hover:bg-red-50"
          >
            <Trash2 size={12} />
            Delete Patient Record
          </button>
        ) : (
          <div className="flex items-center gap-3 bg-red-50 p-2 rounded-xl border border-red-100 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="flex items-center gap-2 px-2 text-red-600 font-bold text-[10px] uppercase tracking-widest">
              <AlertCircle size={14} />
              Confirm Deletion?
            </div>
            <div className="flex gap-1.5">
              <button 
                onClick={handleDeleteClient}
                disabled={isDeleting}
                className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 transition-all shadow-sm"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="bg-white text-brand-muted px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Client Profile Card */}
      <div className="section-card">
        <div className="section-title">Patient Profile</div>
        <div className="p-5 sm:p-8">
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
                {client.createdAt?.toDate ? format(client.createdAt.toDate(), 'MMM d, yyyy') : 'Recent'}
              </span>
            </div>
          </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
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
                {newTreatment.followUpDate && (
                  <div className="mt-1 ml-1 text-[9px] font-bold text-brand-primary">
                    Calculated Date: {format(parseISO(newTreatment.followUpDate), 'dd-MMM-yyyy')}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest block ml-1">Select Doctor</label>
              <div className="flex gap-2">
                {['Dr. Debahuti Pattnaik', 'Dr. Sweta Sucharita', 'Dr. Manoranjan'].map((doc) => (
                  <button
                    key={doc}
                    type="button"
                    onClick={() => setNewTreatment({ ...newTreatment, doctorName: doc })}
                    className={`flex-1 sm:flex-none px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all border ${
                      newTreatment.doctorName === doc 
                        ? 'bg-brand-primary text-white border-brand-primary shadow-sm shadow-brand-primary/20' 
                        : 'bg-white text-brand-muted border-brand-border hover:border-brand-primary/30'
                    }`}
                  >
                    {doc.split('. ')[1].split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

            {userRole === 'admin' && (
              <div className="flex flex-col sm:flex-row gap-6 items-start pt-4 border-t border-slate-50">
                <div className="w-full sm:w-[180px] space-y-1.5">
                  <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest block ml-1">Service MRP (Fees)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-brand-muted">₹</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      className="w-full pl-7 pr-4 py-2 bg-white border border-brand-border rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none font-mono"
                      value={newTreatment.serviceMRP || ''}
                      onChange={(e) => setNewTreatment({ ...newTreatment, serviceMRP: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="w-full sm:w-[220px] space-y-1.5">
                  <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest block ml-1">Discount Type & Value</label>
                  <div className="flex gap-2">
                    <div className="flex bg-slate-100 p-1 rounded-xl w-[90px]">
                      <button
                        type="button"
                        onClick={() => setNewTreatment({ ...newTreatment, serviceDiscountType: 'percentage' })}
                        className={`flex-1 flex items-center justify-center rounded-lg py-1.5 text-[10px] font-black transition-all ${
                          newTreatment.serviceDiscountType === 'percentage' 
                            ? 'bg-blue-600 text-white shadow-sm' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewTreatment({ ...newTreatment, serviceDiscountType: 'fixed' })}
                        className={`flex-1 flex items-center justify-center rounded-lg py-1.5 text-[10px] font-black transition-all ${
                          newTreatment.serviceDiscountType === 'fixed' 
                            ? 'bg-emerald-600 text-white shadow-sm' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        INR
                      </button>
                    </div>
                    <div className="flex-1 flex bg-white border border-brand-border rounded-xl overflow-hidden focus-within:border-brand-primary transition-all">
                      <span className="pl-3 py-2 text-[10px] font-bold text-brand-muted flex items-center">{newTreatment.serviceDiscountType === 'percentage' ? '%' : '₹'}</span>
                      <input
                        type="number"
                        placeholder="0"
                        className="w-full px-2 py-2 text-base sm:text-sm outline-none font-mono"
                        value={newTreatment.serviceDiscount || ''}
                        onChange={(e) => setNewTreatment({ ...newTreatment, serviceDiscount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={addService}
                    className="w-full sm:w-auto sm:mt-[21px] px-6 py-2.5 bg-brand-primary/10 text-brand-primary rounded-xl text-[11px] font-bold hover:bg-brand-primary hover:text-white transition-all flex items-center justify-center gap-2 group border border-brand-primary/20 shadow-sm"
                  >
                    <Plus size={14} className="group-hover:rotate-90 transition-transform duration-300" />
                    Add Service to Bill
                  </button>
                </div>
              </div>
            )}

            {servicesList.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-50">
                {servicesList.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-indigo-50/50 text-brand-secondary border border-indigo-100 px-3 py-1.5 rounded-xl animate-in zoom-in duration-300">
                    <Zap size={12} className="text-brand-primary" />
                    <span className="text-[11px] font-bold uppercase tracking-tight">{s.name}</span>
                    <span className="text-[11px] font-mono text-brand-muted">
                      (₹{s.mrp}{s.discount > 0 && ` - ${s.discountType === 'percentage' ? s.discount + '%' : '₹' + s.discount}`})
                    </span>
                    <button 
                      type="button"
                      onClick={() => removeService(idx)} 
                      className="ml-1 p-0.5 hover:bg-red-50 hover:text-red-500 rounded transition-all"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        {/* Product Inventory & Billing Selection */}
        {userRole === 'admin' ? (
          <div className="px-5 sm:px-8 pb-8 space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShoppingCart size={16} />
              </div>
              <h4 className="text-xs font-bold text-brand-secondary uppercase tracking-widest">Inventory & Sales</h4>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Product Entry Form */}
              <div className="lg:col-span-2 bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest ml-1">Product Name</label>
                    <input
                      type="text"
                      placeholder="Skin Serum..."
                      className="w-full px-4 py-2 bg-white border border-brand-border rounded-xl text-sm outline-none focus:border-brand-primary transition-all"
                      value={currentProduct.name}
                      onChange={(e) => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest ml-1">Qty</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full px-4 py-2 bg-white border border-brand-border rounded-xl text-sm outline-none focus:border-brand-primary transition-all"
                      value={currentProduct.qty}
                      onChange={(e) => setCurrentProduct({ ...currentProduct, qty: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest ml-1">MRP</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-brand-muted">₹</span>
                      <input
                        type="number"
                        className="w-full pl-7 pr-4 py-2 bg-white border border-brand-border rounded-xl text-sm outline-none focus:border-brand-primary transition-all font-mono"
                        value={currentProduct.mrp}
                        onChange={(e) => setCurrentProduct({ ...currentProduct, mrp: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-1 space-y-1.5">
                    <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest ml-1">Discount Value</label>
                    <div className="flex gap-1.5">
                      <div className="flex-1 flex bg-white border border-brand-border rounded-xl overflow-hidden focus-within:border-brand-primary h-[38px]">
                        <span className="pl-3 flex items-center text-[10px] font-bold text-brand-muted">{currentProduct.discountType === 'percentage' ? '%' : '₹'}</span>
                        <input
                          type="number"
                          className="flex-1 px-2 text-sm outline-none font-mono"
                          value={currentProduct.discount}
                          onChange={(e) => setCurrentProduct({ ...currentProduct, discount: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="flex bg-slate-100 p-1 rounded-xl h-[38px] w-[80px]">
                        <button
                          type="button"
                          onClick={() => setCurrentProduct({ ...currentProduct, discountType: 'percentage' })}
                          className={`flex-1 flex items-center justify-center rounded-lg text-[9px] font-black transition-all ${
                            currentProduct.discountType === 'percentage' 
                              ? 'bg-blue-600 text-white shadow-sm' 
                              : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentProduct({ ...currentProduct, discountType: 'fixed' })}
                          className={`flex-1 flex items-center justify-center rounded-lg text-[9px] font-black transition-all ${
                            currentProduct.discountType === 'fixed' 
                              ? 'bg-emerald-600 text-white shadow-sm' 
                              : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          INR
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addProduct}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-primary/10 text-brand-primary rounded-xl text-xs font-bold hover:bg-brand-primary hover:text-white transition-all group"
                >
                  <Plus size={14} className="group-hover:scale-110 transition-transform" />
                  Add to Bill
                </button>

                {/* Added Products Table */}
                {productList.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-4 space-y-2">
                    {productList.map((p, idx) => {
                      const basePrice = p.mrp * p.qty;
                      const disc = p.discountType === 'percentage' ? (basePrice * p.discount / 100) : p.discount;
                      const subtotal = basePrice - disc;
                      return (
                        <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 text-brand-primary rounded-lg">
                              <Package size={14} />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-brand-secondary uppercase tracking-tight">{p.name}</div>
                              <div className="text-[10px] text-brand-muted">
                                {p.qty} x ₹{p.mrp} {p.discount > 0 && <span className="text-emerald-600 ml-1">(-{p.discountType === 'percentage' ? `${p.discount}%` : `₹${p.discount}`})</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-xs font-bold text-brand-secondary font-mono">₹{subtotal.toFixed(2)}</div>
                            <button onClick={() => removeProduct(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Billing Summary & Payment */}
              <div className="bg-white p-6 rounded-2xl border border-brand-border shadow-sm space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <span className="text-xs font-bold text-brand-muted uppercase tracking-widest">Total Billable</span>
                    <span className="text-xl font-black text-brand-secondary font-mono">₹{totalAmount.toFixed(2)}</span>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest ml-1">Payment Modes (Split)</label>
                      <button 
                        type="button" 
                        onClick={() => setSplitPayments([...splitPayments, { method: 'Cash', amount: 0 }])}
                        className="text-[9px] font-bold text-brand-primary bg-blue-50 px-2 py-0.5 rounded hover:bg-brand-primary hover:text-white transition-all border border-brand-primary/10"
                      >
                        Add Mode
                      </button>
                    </div>

                    {splitPayments.length > 0 ? (
                      <div className="space-y-3 p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
                        {splitPayments.map((p, idx) => (
                          <div key={idx} className="flex gap-2">
                             <select
                               className="bg-white border border-brand-border rounded-lg text-xs px-2 py-1.5 focus:border-brand-primary outline-none"
                               value={p.method}
                               onChange={(e) => {
                                 const next = [...splitPayments];
                                 next[idx].method = e.target.value as any;
                                 setSplitPayments(next);
                               }}
                             >
                               <option value="Cash">Cash</option>
                               <option value="PhonePe">PhonePe</option>
                               <option value="POS">POS</option>
                               <option value="POS QR Code">POS QR Code</option>
                             </select>
                             <div className="flex-1 relative">
                               <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-brand-muted">₹</span>
                               <input 
                                 type="number"
                                 className="w-full pl-6 pr-3 py-1.5 bg-white border border-brand-border rounded-lg text-xs font-mono outline-none focus:border-brand-primary"
                                 value={p.amount}
                                 onChange={(e) => {
                                   const next = [...splitPayments];
                                   next[idx].amount = parseFloat(e.target.value) || 0;
                                   setSplitPayments(next);
                                 }}
                               />
                             </div>
                             <button
                               type="button"
                               onClick={() => setSplitPayments(splitPayments.filter((_, i) => i !== idx))}
                               className="p-1.5 text-brand-muted hover:text-red-500 transition-colors"
                             >
                               <X size={14} />
                             </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {['Cash', 'PhonePe', 'POS', 'POS QR Code'].map((method) => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setNewTreatment({ ...newTreatment, paymentMethod: method as any })}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-all border ${
                              newTreatment.paymentMethod === method 
                                ? 'bg-blue-50 text-brand-primary border-brand-primary shadow-sm ring-1 ring-brand-primary/10' 
                                : 'bg-white text-brand-muted border-brand-border hover:border-blue-100/50'
                            }`}
                          >
                            {method === 'Cash' && <Banknote size={12} />}
                            {method.includes('POS') && <CreditCard size={12} />}
                            {method === 'PhonePe' && <Smartphone size={12} />}
                            {method}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest ml-1">
                      {splitPayments.length > 0 ? "Total Paid (Calculated)" : "Amount Paid (₹)"}
                    </label>
                    <input
                      readOnly={splitPayments.length > 0}
                      type="number"
                      className={`w-full px-4 py-2.5 border rounded-xl text-lg font-black text-emerald-600 outline-none transition-all font-mono ${
                        splitPayments.length > 0 ? 'bg-slate-100 border-slate-200 opacity-80' : 'bg-slate-50 border-brand-border focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500'
                      }`}
                      value={splitPayments.length > 0 ? splitPayments.reduce((acc, p) => acc + p.amount, 0) : newTreatment.paidAmount}
                      onChange={(e) => !splitPayments.length && setNewTreatment({ ...newTreatment, paidAmount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="pt-4 flex justify-between items-center text-red-500 pb-4 border-b border-slate-50">
                    <span className="text-[10px] font-bold uppercase tracking-widest">Remaining Balance</span>
                    <span className="text-sm font-black font-mono">
                      ₹{(totalAmount - (splitPayments.length > 0 ? splitPayments.reduce((acc, p) => acc + p.amount, 0) : newTreatment.paidAmount)).toFixed(2)}
                    </span>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-5 sm:px-8 pb-8 pt-4">
            <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex items-start gap-4">
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-blue-100 flex items-center justify-center text-brand-primary shrink-0">
                <AlertCircle size={20} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-brand-secondary uppercase tracking-widest">Staff Clinical Mode Active</p>
                <p className="text-xs text-brand-muted leading-relaxed">
                  Financial fields are restricted. Your clinical log will be tagged for administrative billing finalization.
                </p>
                <div className="pt-4">
                  <button
                    disabled={isLogging}
                    type="submit"
                    className="px-8 py-3 bg-brand-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <Save size={18} />
                    {isLogging ? 'Processing...' : 'Save Clinical Record'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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
                <th className="px-5 sm:px-8 py-3 sm:py-4 text-[10px] font-bold text-brand-muted uppercase tracking-wider border-b border-brand-border">Treatment & Products</th>
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
                    {format(t.date instanceof Date ? t.date : t.date.toDate(), 'dd-MMM-yyyy')}
                  </td>
                  <td className="px-5 sm:px-8 py-3 sm:py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-blue-50 text-brand-primary text-[10px] sm:text-[11px] font-bold rounded-lg group-hover:bg-white transition-colors block w-fit">
                          {t.treatmentName}
                        </span>
                        {userRole === 'admin' && t.paymentPending && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-50 text-orange-600 text-[8px] font-black uppercase rounded border border-orange-100 animate-pulse">
                            <AlertCircle size={8} /> Pending Pay
                          </span>
                        )}
                      </div>
                      {t.productUsage && (
                        <div className="text-[9px] font-medium text-brand-muted italic pl-1 leading-tight">
                          Level: {t.productUsage}
                        </div>
                      )}
                      {t.products && t.products.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {t.products.map((p, i) => (
                            <span key={i} className="text-[8px] bg-slate-50 text-brand-muted px-1 rounded border border-slate-100">{p.name}({p.qty})</span>
                          ))}
                        </div>
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
                    {t.followUpDate ? format(t.followUpDate instanceof Date ? t.followUpDate : t.followUpDate.toDate(), 'dd-MMM-yy') : '--'}
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
