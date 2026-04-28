import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, IndianRupee, CreditCard, Banknote, Smartphone, Plus, Trash2, AlertCircle } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError } from '../lib/errorHandlers';

interface PaymentFinalizationModalProps {
  treatment: any;
  clientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentFinalizationModal({ treatment, clientName, onClose, onSuccess }: PaymentFinalizationModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [services, setServices] = useState<any[]>(treatment.services || []);
  const [splitPayments, setSplitPayments] = useState<{method: 'Cash' | 'PhonePe' | 'POS' | 'POS QR Code', amount: number}[]>(
    treatment.splitPayments || []
  );
  
  // Local state for adding a service if missed
  const [extraService, setExtraService] = useState({ name: '', mrp: 0, discount: 0 });

  const calculateTotal = () => {
    const servicesTotal = services.reduce((acc, s) => acc + (s.mrp || 0) - (s.discount || 0), 0);
    const productsTotal = (treatment.products || []).reduce((acc: number, p: any) => acc + ((p.mrp || 0) * (p.qty || 1)) - (p.discount || 0), 0);
    return servicesTotal + productsTotal;
  };

  const totalAmount = calculateTotal();
  const totalPaid = splitPayments.reduce((acc, p) => acc + p.amount, 0);
  const balance = totalAmount - totalPaid;

  const handleUpdate = async () => {
    if (splitPayments.length === 0) {
      setError("Please add at least one payment method");
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      if (!treatment.parentId || !treatment.id) throw new Error("Invalid treatment reference");
      
      const treatmentRef = doc(db, 'clients', treatment.parentId, 'treatments', treatment.id);
      
      await updateDoc(treatmentRef, {
        services: services,
        splitPayments: splitPayments,
        totalAmount: totalAmount,
        paidAmount: totalPaid,
        balanceAmount: balance,
        paymentPending: false, // Mark as finalized
        updatedAt: serverTimestamp()
      });

      onSuccess();
    } catch (err) {
      handleFirestoreError(err, 'update', `clients/${treatment.parentId}/treatments/${treatment.id}`);
      setError("Failed to update payment information");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-brand-secondary/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-brand-border"
      >
        <div className="p-6 border-b border-brand-border flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-brand-secondary uppercase tracking-widest flex items-center gap-2">
              <IndianRupee size={16} className="text-emerald-600" />
              Finalize Billing
            </h2>
            <p className="text-[10px] text-brand-muted font-bold uppercase tracking-widest mt-1">
              Patient: {clientName}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-brand-muted hover:text-brand-secondary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-xs font-bold">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Services Review */}
          <div className="space-y-3">
             <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">Services & Fees</label>
             <div className="space-y-2">
                {services.map((s, idx) => (
                  <div key={idx} className="flex gap-2 bg-slate-50 p-2 rounded-xl border border-brand-border">
                    <div className="flex-1 text-[11px] font-bold text-brand-secondary flex items-center px-1">
                      {s.name}
                    </div>
                    <div className="w-24">
                       <input 
                         type="number"
                         placeholder="MRP"
                         className="w-full px-2 py-1 bg-white border border-brand-border rounded-lg text-xs font-mono outline-none"
                         value={s.mrp}
                         onChange={(e) => {
                           const next = [...services];
                           next[idx].mrp = parseFloat(e.target.value) || 0;
                           setServices(next);
                         }}
                       />
                    </div>
                    <div className="w-24">
                       <input 
                         type="number"
                         placeholder="Disc"
                         className="w-full px-2 py-1 bg-white border border-brand-border rounded-lg text-xs font-mono outline-none"
                         value={s.discount}
                         onChange={(e) => {
                           const next = [...services];
                           next[idx].discount = parseFloat(e.target.value) || 0;
                           setServices(next);
                         }}
                       />
                    </div>
                  </div>
                ))}
             </div>
          </div>

          {/* Combined Inventory/Product View (Read Only here for simplicity, or editable) */}
          {treatment.products && treatment.products.length > 0 && (
             <div className="space-y-2">
                <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">Inventory Used</label>
                <div className="space-y-1">
                  {treatment.products.map((p: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-[10px] text-brand-secondary font-medium px-2 py-1.5 bg-slate-50/50 rounded-lg">
                      <span>{p.name} (x{p.qty})</span>
                      <span className="font-bold">₹{((p.mrp * p.qty) - (p.discount || 0)).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
             </div>
          )}

          {/* Payment Details */}
          <div className="space-y-4 pt-4 border-t border-brand-border">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">Select Payment Mode to Add</label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'Cash', icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { id: 'PhonePe', icon: Smartphone, color: 'text-purple-600', bg: 'bg-purple-50' },
                { id: 'POS', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
                { id: 'POS QR Code', icon: CreditCard, color: 'text-brand-primary', bg: 'bg-blue-50' }
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSplitPayments([...splitPayments, { method: m.id as any, amount: balance > 0 ? balance : 0 }])}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-brand-border bg-white hover:border-brand-primary hover:bg-slate-50 transition-all group"
                >
                  <m.icon size={18} className={`${m.color} group-hover:scale-110 transition-transform`} />
                  <span className="text-[9px] font-black tracking-tight text-brand-secondary">{m.id}</span>
                </button>
              ))}
            </div>

            {splitPayments.length > 0 && (
              <div className="space-y-3 pt-2">
                <label className="text-[9px] font-black text-brand-muted uppercase tracking-widest ml-1">Current Split</label>
                {splitPayments.map((p, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-slate-50/50 p-2 rounded-2xl border border-brand-border">
                     <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-brand-border rounded-xl min-w-[100px]">
                        {p.method === 'Cash' && <Banknote size={14} className="text-emerald-600" />}
                        {p.method.includes('POS') && <CreditCard size={14} className="text-blue-600" />}
                        {p.method === 'PhonePe' && <Smartphone size={14} className="text-purple-600" />}
                        <span className="text-[10px] font-bold text-brand-secondary">{p.method}</span>
                     </div>
                     <div className="flex-1 relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-brand-muted">₹</span>
                       <input 
                         type="number"
                         className="w-full pl-7 pr-4 py-2 bg-white border border-brand-border rounded-xl text-base font-black text-brand-secondary font-mono outline-none focus:border-brand-primary"
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
                       className="p-2 text-brand-muted hover:text-red-500 transition-colors bg-white border border-brand-border rounded-xl shadow-sm"
                     >
                       <Trash2 size={16} />
                     </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Summary */}
        <div className="p-6 bg-slate-50 border-t border-brand-border space-y-4">
          <div className="grid grid-cols-3 gap-4">
             <div className="text-center p-2 bg-white rounded-2xl border border-brand-border">
                <div className="text-[8px] font-black text-brand-muted uppercase">Billable</div>
                <div className="text-xs font-black text-brand-secondary font-mono">₹{totalAmount.toFixed(2)}</div>
             </div>
             <div className="text-center p-2 bg-white rounded-2xl border border-brand-border">
                <div className="text-[8px] font-black text-brand-muted uppercase">Paid</div>
                <div className="text-xs font-black text-emerald-600 font-mono">₹{totalPaid.toFixed(2)}</div>
             </div>
             <div className="text-center p-2 bg-white rounded-2xl border border-brand-border">
                <div className="text-[8px] font-black text-brand-muted uppercase">Balance</div>
                <div className="text-xs font-black text-red-500 font-mono">₹{balance.toFixed(2)}</div>
             </div>
          </div>

          <div className="flex gap-3">
             <button
               disabled={loading}
               onClick={onClose}
               className="flex-1 px-4 py-3 bg-white border border-brand-border text-brand-secondary rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all"
             >
               Cancel
             </button>
             <button
               disabled={loading}
               onClick={handleUpdate}
               className="flex-[2] px-4 py-3 bg-brand-primary text-white rounded-2xl text-xs font-bold shadow-lg shadow-brand-primary/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
             >
               {loading ? 'Processing...' : (
                 <>
                   <CheckCircle2 size={16} />
                   Finalize Bill & Save
                 </>
               )}
             </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
