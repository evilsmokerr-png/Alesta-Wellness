import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, doc, deleteDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Search, UserPlus, Phone, Calendar, ClipboardList, Plus, ChevronRight, RefreshCw, Trash2, Clock, AlertTriangle, CheckCircle2, Tag, MessageSquare, Pencil, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isToday, isPast, isFuture } from 'date-fns';
import { Lead } from '../types';
import LeadForm from './LeadForm';

interface LeadDashboardProps {
  userId: string;
  onMarkVisited: (leadId: string) => void;
  onRequestDeleteLead?: (leadId: string) => void;
}

export default function LeadDashboard({ userId, onMarkVisited, onRequestDeleteLead }: LeadDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | undefined>();
  const [filter, setFilter] = useState<'all' | 'today' | 'no_show' | 'pending' | 'visited'>('all');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const leadsRef = collection(db, 'leads');
    const q = query(
      leadsRef,
      where('ownerId', '==', userId),
      orderBy('appointmentDate', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead)));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching leads:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         lead.phone.includes(searchTerm);
    
    if (!matchesSearch) return false;

    const apptDate = lead.appointmentDate?.toDate ? lead.appointmentDate.toDate() : new Date(lead.appointmentDate);
    
    if (filter === 'today') return isToday(apptDate);
    if (filter === 'no_show') return lead.status === 'no_show' || (isPast(apptDate) && !isToday(apptDate) && lead.status === 'appointment_set');
    if (filter === 'pending') return lead.status === 'enquiry' || lead.status === 'appointment_set';
    if (filter === 'visited') return lead.status === 'visited';
    
    // By default for 'all', we might want to exclude visited/no-shows if user wants a clean board, 
    // but usually 'all' means all. Let's keep it as all for now.
    return true;
  });

  const getStatusBadge = (status: string, apptDate: Date) => {
    if (status === 'no_show') return <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full text-[10px] font-bold">NO SHOW</span>;
    if (status === 'visited') return <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full text-[10px] font-bold">VISITED</span>;
    if (status === 'cancelled') return <span className="bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-bold">CANCELLED</span>;
    
    if (isToday(apptDate)) return <span className="bg-blue-50 text-brand-primary px-2 py-0.5 rounded-full text-[10px] font-bold">TODAY</span>;
    if (isPast(apptDate)) return <span className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full text-[10px] font-bold">OVERDUE</span>;
    
    return <span className="bg-slate-50 text-brand-muted px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">{status.replace('_', ' ')}</span>;
  };

  const handleDelete = (id: string) => {
    if (onRequestDeleteLead) {
      onRequestDeleteLead(id);
    }
  };

  const handleMarkVisitedClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onMarkVisited(id);
  };

  const counts = {
    all: leads.length,
    today: leads.filter(l => {
      const d = l.appointmentDate?.toDate ? l.appointmentDate.toDate() : new Date(l.appointmentDate);
      return isToday(d);
    }).length,
    pending: leads.filter(l => l.status === 'enquiry' || l.status === 'appointment_set').length,
    visited: leads.filter(l => l.status === 'visited').length,
    no_show: leads.filter(l => l.status === 'no_show' || (isPast(l.appointmentDate?.toDate ? l.appointmentDate.toDate() : new Date(l.appointmentDate)) && !isToday(l.appointmentDate?.toDate ? l.appointmentDate.toDate() : new Date(l.appointmentDate)) && l.status === 'appointment_set')).length,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-brand-secondary tracking-tight">Inquiry & Appointments</h2>
          <p className="text-brand-muted text-xs sm:text-sm mt-1">Manage new client calls and bookings</p>
        </div>
        <button 
          onClick={() => { setSelectedLead(undefined); setIsFormOpen(true); }}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-[#2ecc71] text-white rounded-xl text-sm font-bold hover:bg-[#27ae60] transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus size={18} />
          Log New Inquiry
        </button>
      </div>

      {/* Stats Quick Filter */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { id: 'all', label: 'All', icon: ClipboardList, color: 'text-slate-600', bg: 'bg-slate-50' },
          { id: 'today', label: 'Today', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
          { id: 'pending', label: 'Pending', icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-50' },
          { id: 'visited', label: 'Visited', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { id: 'no_show', label: 'No Shows', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setFilter(item.id as any)}
            className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 ${
              filter === item.id 
                ? 'bg-white border-brand-primary shadow-md ring-2 ring-brand-primary/5' 
                : 'bg-white border-brand-border hover:bg-slate-50'
            }`}
          >
            <div className={`w-8 h-8 ${item.bg} ${item.color} rounded-lg flex items-center justify-center relative`}>
              <item.icon size={16} />
              {(counts as any)[item.id] > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center bg-white border border-slate-100 rounded-full text-[9px] font-black shadow-sm px-1">
                  {(counts as any)[item.id]}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative group">
        <input
          type="text"
          placeholder="Search by name or phone..."
          className="w-full pl-12 pr-4 py-4 bg-white border border-brand-border rounded-2xl focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary outline-none transition-all shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted group-focus-within:text-brand-primary transition-colors" size={20} />
      </div>

      {/* Leads List */}
      <div className="bg-white rounded-3xl border border-brand-border shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
            <p className="text-brand-muted text-sm font-medium">Crunching data...</p>
          </div>
        ) : filteredLeads.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {filteredLeads.map((lead, idx) => {
              const apptDate = lead.appointmentDate?.toDate ? lead.appointmentDate.toDate() : new Date(lead.appointmentDate);
              return (
                <motion.div
                  key={lead.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`p-4 sm:p-6 hover:bg-slate-50 flex items-center justify-between group cursor-pointer ${
                    isToday(apptDate) ? 'bg-blue-50/20' : ''
                  }`}
                  onClick={() => { setSelectedLead(lead); setIsFormOpen(true); }}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-brand-border flex items-center justify-center text-brand-muted shadow-sm group-hover:border-brand-primary/30 transition-all">
                      {lead.status === 'visited' ? <CheckCircle2 size={24} className="text-emerald-500" /> : <Phone size={24} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-brand-secondary">{lead.name}</span>
                        {getStatusBadge(lead.status, apptDate)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-brand-muted font-medium">
                        <span className="flex items-center gap-1"><Phone size={12} /> {lead.phone}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span className="flex items-center gap-1 font-bold text-brand-primary">
                          <Calendar size={12} /> {format(apptDate, 'MMM dd, yyyy')}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mt-2">
                        {lead.source && (
                          <span className="flex items-center gap-1 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            <Tag size={10} /> {lead.source}
                          </span>
                        )}
                        {lead.concern && (
                          <span className="flex items-center gap-1 text-[10px] bg-blue-50 text-brand-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            <MessageSquare size={10} /> {lead.concern}
                          </span>
                        )}
                      </div>

                      {lead.notes && (
                        <p className="text-[11px] text-brand-muted mt-1.5 italic truncate max-w-[200px] sm:max-w-md">
                          "{lead.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                    <div className="flex items-center gap-2">
                      <AnimatePresence mode="wait">
                        {confirmingDeleteId === lead.id ? (
                          <motion.div 
                            initial={{ x: 10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 10, opacity: 0 }}
                            className="flex items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleDelete(lead.id!)}
                              className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors border border-red-100"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmingDeleteId(null)}
                              className="text-[10px] font-bold text-brand-muted hover:text-brand-secondary px-2.5 py-1.5 rounded-lg border border-slate-100"
                            >
                              Cancel
                            </button>
                          </motion.div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <a
                              href={`tel:${lead.phone.replace(/\D/g, '')}`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-2.5 bg-green-50 text-emerald-600 rounded-xl hover:bg-green-100 transition-colors flex items-center justify-center"
                              title="Call Client"
                            >
                              <Phone size={18} />
                            </a>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const dateStr = format(apptDate, 'dd MMM (EEEE)');
                                const message = `Hi ${lead.name}! Just a quick reminder from Alesta Wellness about your scheduled visit on ${dateStr}. Please let us know if you have any questions!`;
                                const encodedMsg = encodeURIComponent(message);
                                const phone = lead.phone.replace(/\D/g, '');
                                window.open(`https://wa.me/${phone.startsWith('91') ? phone : '91' + phone}?text=${encodedMsg}`, '_blank');
                              }}
                              className="p-2.5 bg-emerald-50 text-[#25D366] rounded-xl hover:bg-emerald-100 transition-colors flex items-center justify-center"
                              title="Send WhatsApp Reminder"
                            >
                              <MessageCircle size={18} />
                            </button>
                            <button
                              onClick={(e) => handleMarkVisitedClick(e, lead.id!)}
                              className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors hidden sm:flex"
                              title="Mark as Visited"
                            >
                              <CheckCircle2 size={18} />
                            </button>
                            <button
                              onClick={() => { setSelectedLead(lead); setIsFormOpen(true); }}
                              className="p-2.5 bg-blue-50 text-brand-primary rounded-xl hover:bg-blue-100 transition-colors"
                              title="Edit Inquiry"
                            >
                              <Pencil size={18} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(lead.id!); }}
                              className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                              title="Delete Entry"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        )}
                      </AnimatePresence>
                      <ChevronRight className="text-slate-300 group-hover:text-brand-primary transition-colors ml-1" size={20} />
                    </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
              <Search size={32} />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-brand-secondary">No inquiries found</h3>
              <p className="text-brand-muted text-xs mt-1">Try a different search or log a new call.</p>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isFormOpen && (
          <LeadForm 
            userId={userId} 
            lead={selectedLead}
            onClose={() => setIsFormOpen(false)} 
            onSaved={() => { setIsFormOpen(false); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
