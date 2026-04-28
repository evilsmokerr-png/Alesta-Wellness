import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, onSnapshot, orderBy, limit, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { Search, UserPlus, Phone, MapPin, Calendar, ClipboardList, Plus, ChevronRight, History, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import { doc, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Client, Treatment } from '../types';

interface DashboardProps {
  userId: string;
  onSelectClient: (client: Client) => void;
  onNewClient: () => void;
  onRescheduleClient: (client: Client) => void;
}

export default function ClientDashboard({ userId, onSelectClient, onNewClient, onRescheduleClient }: DashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'clients', id));
      setConfirmingId(null);
    } catch (err) {
      console.error("Error deleting client:", err);
    }
  };

  useEffect(() => {
    if (!userId) return;
    
    setLoading(true);
    const clientsRef = collection(db, 'clients');
    const q = query(
      clientsRef,
      where('ownerId', '==', userId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching patients:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const filteredClients = allClients.filter(client => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const name = client.name.toLowerCase();
    const phone = client.phone.replace(/\D/g, '');
    const cleanTerm = term.replace(/\D/g, '');
    
    return name.includes(term) || 
           (cleanTerm && phone.includes(cleanTerm)) ||
           (client.address && client.address.toLowerCase().includes(term));
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-brand-secondary tracking-tight">Patient Registry</h2>
        <p className="text-brand-muted text-xs sm:text-sm mt-1">Manage and search your comprehensive clinical records.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center justify-between">
        <div className="relative w-full sm:max-w-xl group order-2 sm:order-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted group-focus-within:text-brand-primary transition-colors" size={16} />
          <input
            type="text"
            placeholder="Search record by name, phone or location..."
            className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-white border border-brand-border rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-brand-secondary shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button
          onClick={onNewClient}
          className="w-full sm:w-auto btn-professional btn-primary order-1 sm:order-2 py-2.5 sm:py-3"
        >
          <UserPlus size={18} />
          <span className="sm:inline font-bold">Register Patient</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        <AnimatePresence mode="popLayout">
          {filteredClients.map((client, index) => (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => onSelectClient(client)}
              className="section-card hover:border-brand-primary/40 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="section-title flex justify-between items-center py-2 px-4 sm:px-5 relative overflow-hidden">
                <span className="text-[10px] font-bold uppercase tracking-widest bg-blue-50 text-brand-primary px-2 py-0.5 rounded">Profile</span>
                
                <div className="flex items-center gap-2">
                  <AnimatePresence mode="wait">
                    {confirmingId === client.id ? (
                      <motion.div 
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 20, opacity: 0 }}
                        className="flex items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button 
                          onClick={(e) => handleDelete(e, client.id!)}
                          className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded transition-colors"
                        >
                          Confirm
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setConfirmingId(null); }}
                          className="text-[10px] font-bold text-brand-muted hover:text-brand-secondary px-2 py-0.5"
                        >
                          Cancel
                        </button>
                      </motion.div>
                    ) : (
                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={(e) => { e.stopPropagation(); setConfirmingId(client.id!); }}
                        className="p-1 text-brand-muted hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </motion.button>
                    )}
                  </AnimatePresence>
                  <ChevronRight size={16} className="text-brand-muted group-hover:text-brand-primary transition-colors" />
                </div>
              </div>
              <div className="p-4 sm:p-6">
                <h3 className="font-bold text-brand-secondary text-base mb-3 group-hover:text-brand-primary transition-colors truncate">{client.name}</h3>
                <div className="space-y-2.5">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-0.5">Contact</span>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="mono text-xs sm:text-sm text-brand-secondary font-medium">{client.phone}</span>
                        <a
                          href={`tel:${client.phone.replace(/\D/g, '')}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 bg-blue-50 text-brand-primary rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Phone size={12} />
                        </a>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRescheduleClient(client);
                        }}
                        className="p-1.5 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors flex items-center gap-1.5 px-2"
                        title="Reschedule Follow-up"
                      >
                        <RefreshCw size={12} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Reschedule</span>
                      </button>
                    </div>
                  </div>
                  {client.address && (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-0.5">Location</span>
                      <span className="text-[11px] sm:text-xs text-brand-secondary truncate font-medium">{client.address}</span>
                    </div>
                  )}
                  <div className="flex flex-col pt-2.5 border-t border-slate-50">
                    <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-0.5">Updated</span>
                    <span className="text-[11px] sm:text-xs font-bold text-brand-secondary italic">
                      {client.updatedAt?.toDate ? format(client.updatedAt.toDate(), 'MMM d, yyyy') : 'Recently'}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredClients.length === 0 && !loading && (
        <div className="text-center py-20">
          <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <ClipboardList size={32} className="text-slate-300" />
          </div>
          <h3 className="text-slate-600 font-medium text-lg">No clients found</h3>
          <p className="text-slate-400 mt-1 max-w-sm mx-auto">Start by adding a new client or refine your search to find existing records.</p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      )}
    </div>
  );
}
