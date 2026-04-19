import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, getDocs, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Plus, History, Calendar, Package, Zap, StickyNote, Save, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Client, Treatment } from '../types';

interface ClientDetailProps {
  userId: string;
  client: Client;
  onBack: () => void;
  onUpdate: (client: Client) => void;
}

export default function ClientDetail({ userId, client, onBack, onUpdate }: ClientDetailProps) {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [isLogging, setIsLogging] = useState(false);

  const [newTreatment, setNewTreatment] = useState({
    treatmentName: '',
    productUsage: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    followUpDate: '',
    notes: '',
  });

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
    if (!newTreatment.treatmentName) return;

    setIsLogging(true);
    try {
      const treatmentData = {
        ...newTreatment,
        ownerId: userId,
        date: new Date(newTreatment.date),
        followUpDate: newTreatment.followUpDate ? new Date(newTreatment.followUpDate) : null,
        createdAt: serverTimestamp(),
      };

      const treatmentRef = await addDoc(collection(db, 'clients', client.id!, 'treatments'), treatmentData);
      
      // Update client's updatedAt
      await updateDoc(doc(db, 'clients', client.id!), {
        updatedAt: serverTimestamp()
      });

      setTreatments([{ id: treatmentRef.id, ...treatmentData } as any, ...treatments]);
      setNewTreatment({
        treatmentName: '',
        productUsage: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        followUpDate: '',
        notes: '',
      });
      setShowHistory(true);
      onUpdate({ ...client, updatedAt: new Date() } as any);
    } catch (error) {
      console.error("Error logging treatment:", error);
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div className="space-y-6">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-brand-muted hover:text-brand-primary transition-colors font-semibold text-sm group mb-2"
      >
        <ArrowLeft size={16} />
        Back to Directory
      </button>

      {/* Client Profile Card */}
      <div className="section-card">
        <div className="section-title">Client Profile</div>
        <div className="p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-brand-muted uppercase tracking-wider block">Full Name</label>
              <span className="text-base font-semibold text-brand-secondary">{client.name}</span>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-brand-muted uppercase tracking-wider block">Phone Number</label>
              <span className="mono text-brand-secondary">{client.phone}</span>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-brand-muted uppercase tracking-wider block">Home Address</label>
              <span className="text-sm font-medium text-brand-secondary">{client.address || 'N/A'}</span>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-brand-muted uppercase tracking-wider block">Member Since</label>
              <span className="text-sm font-medium text-brand-secondary">
                {client.createdAt?.toDate ? format(client.createdAt.toDate(), 'MMM d, yyyy') : 'Recent'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* New Treatment Form Card */}
      <div className="section-card">
        <div className="section-title">New Treatment Entry</div>
        <form onSubmit={handleLogTreatment} className="p-8 flex flex-wrap lg:flex-nowrap items-end gap-6">
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <label className="text-[11px] font-bold text-brand-muted uppercase tracking-wider block ml-1">Treatment Name</label>
            <input
              required
              type="text"
              placeholder="e.g. Laser Resurfacing"
              className="w-full px-4 py-2.5 bg-white border border-brand-border rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none"
              value={newTreatment.treatmentName}
              onChange={(e) => setNewTreatment({ ...newTreatment, treatmentName: e.target.value })}
            />
          </div>
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <label className="text-[11px] font-bold text-brand-muted uppercase tracking-wider block ml-1">Product / Energy Level</label>
            <input
              type="text"
              placeholder="30J / Hydro-Gel"
              className="w-full px-4 py-2.5 bg-white border border-brand-border rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none"
              value={newTreatment.productUsage}
              onChange={(e) => setNewTreatment({ ...newTreatment, productUsage: e.target.value })}
            />
          </div>
          <div className="w-full sm:w-auto space-y-1.5">
            <label className="text-[11px] font-bold text-brand-muted uppercase tracking-wider block ml-1">Follow-up Date</label>
            <input
              type="date"
              className="w-full px-4 py-2.5 bg-white border border-brand-border rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none"
              value={newTreatment.followUpDate}
              onChange={(e) => setNewTreatment({ ...newTreatment, followUpDate: e.target.value })}
            />
          </div>
          <button
            disabled={isLogging}
            type="submit"
            className="btn-professional btn-success h-[42px] px-8"
          >
            {isLogging ? 'Saving...' : 'Save Record'}
          </button>
        </form>
      </div>

      {/* History Table Card */}
      <div className="section-card">
        <div className="section-title flex justify-between items-center">
          Treatment History
          <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-brand-muted font-bold tracking-widest">{treatments.length} Records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/30">
                <th className="px-8 py-4 text-[11px] font-bold text-brand-muted uppercase tracking-wider border-b border-brand-border">Date</th>
                <th className="px-8 py-4 text-[11px] font-bold text-brand-muted uppercase tracking-wider border-b border-brand-border">Treatment</th>
                <th className="px-8 py-4 text-[11px] font-bold text-brand-muted uppercase tracking-wider border-b border-brand-border">Product/Energy</th>
                <th className="px-8 py-4 text-[11px] font-bold text-brand-muted uppercase tracking-wider border-b border-brand-border">Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {treatments.map((t) => (
                <tr key={t.id} className="hover:bg-brand-row-hover transition-colors group">
                  <td className="px-8 py-4 mono text-brand-muted">
                    {format(t.date instanceof Date ? t.date : t.date.toDate(), 'dd-MMM-yyyy')}
                  </td>
                  <td className="px-8 py-4">
                    <span className="px-2.5 py-1 bg-blue-50 text-brand-primary text-[11px] font-bold rounded-full group-hover:bg-white transition-colors">
                      {t.treatmentName}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-sm font-medium text-brand-secondary">
                    {t.productUsage || '--'}
                  </td>
                  <td className="px-8 py-4 text-sm font-medium text-brand-muted italic">
                    {t.followUpDate ? format(t.followUpDate instanceof Date ? t.followUpDate : t.followUpDate.toDate(), 'dd-MMM-yyyy') : '--'}
                  </td>
                </tr>
              ))}
              {treatments.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-brand-muted font-medium">
                    No clinical history recorded for this patient.
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
