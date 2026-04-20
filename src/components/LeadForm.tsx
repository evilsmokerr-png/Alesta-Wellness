import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { X, Save, User, Phone, MapPin, Tag, MessageSquare, Calendar, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { Lead } from '../types';
import { handleFirestoreError } from '../lib/errorHandlers';
import { addDays } from 'date-fns';

interface LeadFormProps {
  userId: string;
  lead?: Lead;
  onClose: () => void;
  onSaved: () => void;
}

export default function LeadForm({ userId, lead, onClose, onSaved }: LeadFormProps) {
  const [formData, setFormData] = useState({
    name: lead?.name || '',
    phone: lead?.phone || '',
    source: lead?.source || '',
    concern: lead?.concern || '',
    status: lead?.status || 'enquiry',
    appointmentInDays: 1,
    notes: lead?.notes || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("Please enter the client name");
      return;
    }
    if (!formData.phone.trim()) {
      alert("Please enter the contact number");
      return;
    }

    setLoading(true);
    try {
      const appointmentDate = addDays(new Date(), formData.appointmentInDays);
      
      const leadData = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        source: formData.source.trim(),
        concern: formData.concern.trim(),
        status: formData.status,
        appointmentDate: Timestamp.fromDate(appointmentDate),
        notes: formData.notes.trim(),
        ownerId: userId,
        updatedAt: serverTimestamp(),
      };

      if (lead?.id) {
        const leadRef = doc(db, 'leads', lead.id);
        await updateDoc(leadRef, leadData);
      } else {
        await addDoc(collection(db, 'leads'), {
          ...leadData,
          createdAt: serverTimestamp(),
        });
      }
      onSaved();
    } catch (error) {
      const msg = handleFirestoreError(error, lead?.id ? 'update' : 'create', 'leads');
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-[#f2efe9] w-full max-w-md sm:rounded-3xl shadow-2xl overflow-hidden min-h-[100dvh] sm:min-h-0 border border-brand-border/50"
      >
        <form onSubmit={handleSubmit} className="flex flex-col h-full sm:h-auto max-h-[100dvh] sm:max-h-[85vh]">
          <div className="p-4 sm:p-6 border-b border-brand-border/30 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-brand-secondary flex items-center gap-2 uppercase tracking-tight">
              {lead ? 'Reschedule Inquiry' : 'New Inquiry / Calling'}
            </h2>
            <button type="button" onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg transition-colors text-brand-muted">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 sm:p-8 space-y-4 sm:space-y-5 overflow-y-auto flex-1 scrollbar-hide">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted ml-1">Client Name</label>
              <div className="relative">
                <input
                  required
                  type="text"
                  placeholder="Client Name"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-base sm:text-sm text-brand-secondary"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" size={16} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted ml-1">Phone</label>
              <div className="relative">
                <input
                  required
                  type="tel"
                  placeholder="Phone"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-base sm:text-sm text-brand-secondary mono"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" size={16} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted ml-1">Source</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Source"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-base sm:text-sm text-brand-secondary"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  />
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" size={16} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted ml-1">Concern</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Concern"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-base sm:text-sm text-brand-secondary"
                    value={formData.concern}
                    onChange={(e) => setFormData({ ...formData, concern: e.target.value })}
                  />
                  <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" size={16} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted ml-1">Followup (Status)</label>
              <select
                className="w-full px-4 py-3 bg-white border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-base sm:text-sm text-brand-secondary appearance-none"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              >
                <option value="enquiry">Enquiry</option>
                <option value="appointment_set">Appointment Set</option>
                <option value="visited">Visited</option>
                <option value="no_show">No Show</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted ml-1">
                {lead ? 'Reschedule In (Days)' : 'Followup After (Days)'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-base sm:text-sm text-brand-secondary mono"
                  value={formData.appointmentInDays}
                  onChange={(e) => setFormData({ ...formData, appointmentInDays: parseInt(e.target.value) || 0 })}
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" size={16} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted ml-1">Notes</label>
              <textarea
                rows={3}
                placeholder="Add conversation notes here..."
                className="w-full px-4 py-3 bg-white border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-base sm:text-sm text-brand-secondary resize-none"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="p-4 sm:p-8 bg-white/50 border-t border-brand-border/30">
            <button
              disabled={loading}
              type="submit"
              className="w-full py-4 bg-[#2ecc71] hover:bg-[#27ae60] text-white rounded-xl transition-all font-bold shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  {lead ? <RefreshCw size={18} /> : <Save size={18} />}
                  {lead ? 'Reschedule & Update' : 'Save Inquiry'}
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
