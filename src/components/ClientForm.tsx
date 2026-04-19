import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { X, Save, User, Phone, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { Client } from '../types';

interface ClientFormProps {
  userId: string;
  client?: Client;
  onClose: () => void;
  onSaved: (client: Client) => void;
}

export default function ClientForm({ userId, client, onClose, onSaved }: ClientFormProps) {
  const [formData, setFormData] = useState({
    name: client?.name || '',
    phone: client?.phone || '',
    address: client?.address || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;

    setLoading(true);
    try {
      const clientData = {
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        searchName: formData.name.toLowerCase(),
        ownerId: userId,
        updatedAt: serverTimestamp(),
      };

      if (client?.id) {
        const clientRef = doc(db, 'clients', client.id);
        await updateDoc(clientRef, clientData);
        onSaved({ ...client, ...clientData });
      } else {
        const docRef = await addDoc(collection(db, 'clients'), {
          ...clientData,
          createdAt: serverTimestamp(),
        });
        onSaved({ id: docRef.id, ...clientData, createdAt: new Date() } as any);
      }
    } catch (error) {
      console.error("Error saving client:", error);
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
        className="bg-white w-full max-w-md sm:rounded-3xl shadow-2xl overflow-hidden min-h-[100dvh] sm:min-h-0 flex flex-col"
      >
        <div className="p-4 sm:p-6 border-b border-brand-border flex items-center justify-between bg-white flex-shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-brand-secondary flex items-center gap-2 uppercase tracking-tight">
            {client ? 'Edit Record' : 'Register Patient'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-brand-muted">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5 sm:space-y-6 overflow-y-auto flex-1">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted ml-1">Patient Full Name</label>
            <div className="relative">
              <input
                required
                type="text"
                placeholder="Ex: Sarah Jenkins"
                className="w-full pl-10 pr-4 py-3 bg-white border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-sm text-brand-secondary"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" size={16} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted ml-1">Phone Number</label>
            <div className="relative">
              <input
                required
                type="tel"
                placeholder="+1 (555) 000-0000"
                className="w-full pl-10 pr-4 py-3 bg-white border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-sm text-brand-secondary mono"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" size={16} />
            </div>
          </div>

          <div className="space-y-1.5 pb-20 sm:pb-0">
            <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted ml-1">Clinical Address</label>
            <div className="relative">
              <textarea
                placeholder="Residential/Billing address..."
                rows={3}
                className="w-full pl-10 pr-4 py-3 bg-white border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-sm text-brand-secondary resize-none"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
              <MapPin className="absolute left-3 top-4 text-brand-muted" size={16} />
            </div>
          </div>
        </form>

        <div className="p-4 sm:p-8 bg-white border-t border-brand-border sm:border-none flex-shrink-0 sticky bottom-0 sm:static">
          <button
            disabled={loading}
            onClick={handleSubmit}
            className="w-full py-3.5 bg-brand-primary text-white rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <Save size={18} />
                Save Patient Record
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
