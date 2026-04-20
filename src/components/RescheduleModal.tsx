import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, StickyNote, Clock, RefreshCw } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { handleFirestoreError } from '../lib/errorHandlers';
import { addDays, format } from 'date-fns';

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'lead' | 'followup';
  data: any;
  userId: string;
  onSuccess: () => void;
}

export default function RescheduleModal({ isOpen, onClose, type, data, userId, onSuccess }: RescheduleModalProps) {
  const [days, setDays] = useState(1);
  const [notes, setNotes] = useState(data?.notes || '');
  const [loading, setLoading] = useState(false);

  const handleReschedule = async () => {
    if (!data?.id) return;
    setLoading(true);
    try {
      const newDate = addDays(new Date(), days);
      const firestoreDate = Timestamp.fromDate(newDate);

      if (type === 'lead') {
        const leadRef = doc(db, 'leads', data.id);
        await updateDoc(leadRef, {
          appointmentDate: firestoreDate,
          notes: notes.trim(),
          updatedAt: serverTimestamp()
        });
      } else {
        const clientId = data.parentId;
        if (!clientId) throw new Error("Missing client ID for follow-up");
        const treatmentRef = doc(db, 'clients', clientId, 'treatments', data.id);
        await updateDoc(treatmentRef, {
          followUpDate: firestoreDate,
          notes: notes.trim(),
          updatedAt: serverTimestamp()
        });
      }

      onSuccess();
      onClose();
    } catch (error) {
      const path = type === 'lead' ? `leads/${data.id}` : `clients/${data.parentId}/treatments/${data.id}`;
      const msg = handleFirestoreError(error, 'update', path);
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-brand-border"
          >
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand-secondary flex items-center gap-2">
                <RefreshCw size={20} className="text-brand-primary" />
                Reschedule {type === 'lead' ? 'Inquiry' : 'Follow-up'}
              </h2>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-brand-muted">
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="flex items-center gap-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-brand-primary shadow-sm">
                   <Clock size={20} />
                 </div>
                 <div>
                   <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest leading-none mb-1">New Date (Approx)</div>
                   <div className="text-sm font-bold text-brand-secondary">{format(addDays(new Date(), days), 'EEEE, MMM d')}</div>
                 </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted ml-1">Days from Today</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    placeholder="Days..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-brand-secondary font-bold"
                    value={days}
                    onChange={(e) => setDays(parseInt(e.target.value) || 0)}
                  />
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" size={18} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted ml-1">Reschedule Notes</label>
                <div className="relative">
                  <textarea
                    rows={3}
                    placeholder="Why was this rescheduled? / Specific requests..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-sm text-brand-secondary resize-none"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-brand-muted ml-1 italic">
                  <StickyNote size={10} />
                  Notes will update the existing log.
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 flex gap-3 border-t border-slate-100">
              <button 
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-white border border-brand-border text-brand-secondary rounded-xl text-xs font-bold hover:bg-slate-100 transition-all uppercase tracking-widest"
              >
                Cancel
              </button>
              <button 
                onClick={handleReschedule}
                disabled={loading}
                className="flex-[2] py-3 px-4 bg-brand-primary hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-brand-primary/20 uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    Save & Update
                    <RefreshCw size={14} />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
