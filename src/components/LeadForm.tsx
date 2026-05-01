import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, Timestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { X, Save, User, Phone, Tag, MessageSquare, Calendar, RefreshCw, Search, Check, Calculator } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Lead, Client } from '../types';
import { handleFirestoreError } from '../lib/errorHandlers';
import { addDays, format } from 'date-fns';

interface LeadFormProps {
  userId: string;
  lead?: Lead;
  onClose: () => void;
  onSaved: () => void;
}

export default function LeadForm({ userId, lead, onClose, onSaved }: LeadFormProps) {
  const [entryType, setEntryType] = useState<'new' | 'existing'>(lead?.type === 'existing' ? 'existing' : 'new');
  const [formData, setFormData] = useState({
    name: lead?.name || '',
    phone: lead?.phone || '',
    source: lead?.source || '',
    concern: lead?.concern || '',
    status: lead?.status || 'enquiry',
    appointmentInDays: 1,
    notes: lead?.notes || '',
    doctorName: lead?.doctorName || '',
    upcomingTreatment: lead?.upcomingTreatment || '',
  });
  
  const [loading, setLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Client[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (clientSearch.length < 3) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearching(true);
      try {
        const q = query(
          collection(db, 'clients'),
          where('ownerId', '==', userId),
          where('searchName', '>=', clientSearch.toLowerCase()),
          where('searchName', '<=', clientSearch.toLowerCase() + '\uf8ff'),
          limit(5)
        );
        const snapshot = await getDocs(q);
        setSearchResults(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setSearching(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [clientSearch, userId]);

  const selectClient = (client: Client) => {
    setFormData({
      ...formData,
      name: client.name,
      phone: client.phone,
    });
    setClientSearch('');
    setSearchResults([]);
  };

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
      
      const leadData: Lead = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        source: formData.source.trim(),
        concern: formData.concern.trim(),
        status: formData.status as any,
        appointmentDate: Timestamp.fromDate(appointmentDate),
        notes: formData.notes.trim(),
        ownerId: userId,
        updatedAt: serverTimestamp(),
        type: entryType,
        doctorName: formData.doctorName,
        upcomingTreatment: formData.upcomingTreatment,
        createdAt: lead?.createdAt || serverTimestamp(), // Handle createdAt if editing
      };

      if (lead?.id) {
        const { id, ...updateData } = leadData;
        const leadRef = doc(db, 'leads', lead.id);
        await updateDoc(leadRef, updateData);
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
          <div className="p-4 sm:p-6 border-b border-brand-border/30 flex items-center justify-between bg-white">
            <h2 className="text-base sm:text-lg font-black text-brand-secondary flex items-center gap-2 uppercase tracking-tight">
              {lead ? 'Update Call Log' : 'New Client Call Record'}
            </h2>
            <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-brand-muted">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 sm:p-8 space-y-4 sm:space-y-5 overflow-y-auto flex-1 scrollbar-hide">
            
            {!lead && (
              <div className="flex bg-white p-1 rounded-xl border border-brand-border mb-2">
                <button 
                  type="button"
                  onClick={() => setEntryType('new')}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${entryType === 'new' ? 'bg-brand-primary text-white shadow-md' : 'text-brand-muted hover:bg-slate-50'}`}
                >
                  New Inquiry
                </button>
                <button 
                  type="button"
                  onClick={() => setEntryType('existing')}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${entryType === 'existing' ? 'bg-brand-primary text-white shadow-md' : 'text-brand-muted hover:bg-slate-50'}`}
                >
                  Existing Client
                </button>
              </div>
            )}

            {entryType === 'existing' && !lead && (
              <div className="space-y-1.5 relative">
                <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted ml-1">Search Patient</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by name..."
                    className="w-full pl-10 pr-4 py-3 bg-white border-2 border-brand-primary/20 rounded-xl focus:border-brand-primary outline-none text-sm text-brand-secondary font-bold"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-primary" size={16} />
                </div>
                
                <AnimatePresence>
                  {(searching || searchResults.length > 0) && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-10 w-full mt-1 bg-white border border-brand-border rounded-xl shadow-xl overflow-hidden"
                    >
                      {searching ? (
                        <div className="p-4 text-center text-xs text-brand-muted">Searching...</div>
                      ) : (
                        searchResults.map(client => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => selectClient(client)}
                            className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b last:border-0 border-slate-100 flex items-center justify-between group"
                          >
                            <div>
                              <div className="text-sm font-bold text-brand-secondary">{client.name}</div>
                              <div className="text-[10px] text-brand-muted mono">{client.phone}</div>
                            </div>
                            <Check size={14} className="text-brand-primary opacity-0 group-hover:opacity-100" />
                          </button>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted ml-1">Client Name</label>
                <div className="relative">
                  <input
                    required
                    type="text"
                    placeholder="Client Name"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-base sm:text-sm text-brand-secondary font-bold"
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
                    className="w-full pl-10 pr-4 py-3 bg-white border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-base sm:text-sm text-brand-secondary mono font-bold"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" size={16} />
                </div>
              </div>
            </div>

            {entryType === 'existing' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted ml-1">Consulting Doctor</label>
                  <select
                    className="w-full px-4 py-3 bg-white border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-base sm:text-sm text-brand-secondary appearance-none font-bold"
                    value={formData.doctorName}
                    onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
                  >
                    <option value="">Select Doctor</option>
                    <option value="Dr. Sweta">Dr. Sweta</option>
                    <option value="Dr. Debahuti Pattnaik">Dr. Debahuti Pattnaik</option>
                    <option value="Manoranjan">Manoranjan</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted ml-1">Upcoming Treatment</label>
                  <input
                    type="text"
                    placeholder="e.g. Skin Concern"
                    className="w-full px-4 py-3 bg-white border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-base sm:text-sm text-brand-secondary font-bold"
                    value={formData.upcomingTreatment}
                    onChange={(e) => setFormData({ ...formData, upcomingTreatment: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted ml-1">Concerns / Context</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Nature of inquiry"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-base sm:text-sm text-brand-secondary"
                    value={formData.concern}
                    onChange={(e) => setFormData({ ...formData, concern: e.target.value })}
                  />
                  <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" size={16} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted ml-1">Followup Plan</label>
                <select
                  className="w-full px-4 py-3 bg-white border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-base sm:text-sm text-brand-secondary appearance-none font-medium"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="enquiry">Enquiry / Pending</option>
                  <option value="appointment_set">Appointment Scheduled</option>
                  <option value="visited">Visited / Completed</option>
                  <option value="no_show">No Show</option>
                  <option value="cancelled">Declined</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted ml-1">
                  Treatment After (Days)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-base sm:text-sm text-brand-secondary mono font-bold"
                    value={formData.appointmentInDays}
                    onChange={(e) => setFormData({ ...formData, appointmentInDays: parseInt(e.target.value) || 0 })}
                  />
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" size={16} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted ml-1">Caller Notes / Output</label>
              <textarea
                rows={3}
                placeholder="What was the result of the call?"
                className="w-full px-4 py-3 bg-white border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-base sm:text-sm text-brand-secondary resize-none"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="p-4 sm:p-8 bg-white border-t border-brand-border/30">
            <button
              disabled={loading}
              type="submit"
              className="w-full py-4 bg-[#2ecc71] hover:bg-[#27ae60] text-white rounded-xl transition-all font-bold shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  {lead ? <RefreshCw size={18} /> : <Save size={18} />}
                  {lead ? 'Update Calling Record' : 'Save Calling Output'}
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
