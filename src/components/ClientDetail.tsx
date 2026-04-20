import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, getDocs, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ArrowLeft, Plus, History, Calendar, Package, Zap, StickyNote, Save, CheckCircle2, ChevronDown, ChevronUp, Stethoscope, Trash2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Client, Treatment } from '../types';
import { handleFirestoreError } from '../lib/errorHandlers';

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
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [newTreatment, setNewTreatment] = useState({
    treatmentName: '',
    productUsage: '',
    doctorName: '',
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
    if (!newTreatment.treatmentName.trim()) {
      alert("Please enter a treatment name");
      return;
    }
    if (!newTreatment.doctorName) {
      alert("Please select the doctor who performed the treatment");
      return;
    }

    setIsLogging(true);
    try {
      const treatmentData = {
        ...newTreatment,
        treatmentName: newTreatment.treatmentName.trim(),
        productUsage: newTreatment.productUsage.trim(),
        notes: newTreatment.notes?.trim(),
        ownerId: userId,
        clientName: client.name,
        clientPhone: client.phone,
        date: new Date(newTreatment.date),
        followUpDate: newTreatment.followUpDate ? new Date(newTreatment.followUpDate) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const treatmentRef = await addDoc(collection(db, 'clients', client.id!, 'treatments'), treatmentData);
      
      // Update client's updatedAt
      await updateDoc(doc(db, 'clients', client.id!), {
        updatedAt: serverTimestamp()
      });

      // For local state update, convert serverTimestamp placeholder to actual date
      const localTreatment = {
        id: treatmentRef.id,
        ...treatmentData,
        createdAt: new Date(),
        updatedAt: new Date(),
        // Ensure dates are objects for the local list
        date: treatmentData.date,
        followUpDate: treatmentData.followUpDate
      };

      setTreatments([localTreatment as any, ...treatments]);
      setNewTreatment({
        treatmentName: '',
        productUsage: '',
        doctorName: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        followUpDate: '',
        notes: '',
      });
      setShowHistory(true);
      onUpdate({ ...client, updatedAt: new Date() } as any);
      alert("Treatment successfully logged");
    } catch (error) {
      const msg = handleFirestoreError(error, 'create', `clients/${client.id}/treatments`);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-brand-muted hover:text-brand-primary transition-colors font-semibold text-sm group"
        >
          <ArrowLeft size={16} />
          Back to Directory
        </button>

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

      {/* New Treatment Form Card */}
      <div className="section-card">
        <div className="section-title">New Treatment Entry</div>
        <form onSubmit={handleLogTreatment} className="p-5 sm:p-8 space-y-5 sm:space-y-0 sm:flex sm:flex-wrap lg:flex-nowrap items-end gap-4 sm:gap-6">
          <div className="w-full sm:flex-1 min-w-0 sm:min-w-[200px] space-y-1.5">
            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest block ml-1">Treatment Name</label>
            <input
              required
              type="text"
              placeholder="Laser Resurfacing"
              className="w-full px-4 py-2.5 bg-white border border-brand-border rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none"
              value={newTreatment.treatmentName}
              onChange={(e) => setNewTreatment({ ...newTreatment, treatmentName: e.target.value })}
            />
          </div>
          <div className="w-full sm:flex-1 min-w-0 sm:min-w-[200px] space-y-1.5">
            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest block ml-1">Intensity / Level</label>
            <input
              type="text"
              placeholder="30J / Hydro-Gel"
              className="w-full px-4 py-2.5 bg-white border border-brand-border rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none"
              value={newTreatment.productUsage}
              onChange={(e) => setNewTreatment({ ...newTreatment, productUsage: e.target.value })}
            />
          </div>
          <div className="w-full sm:w-auto space-y-1.5">
            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest block ml-1">Follow-up</label>
            <input
              type="date"
              className="w-full px-4 py-2.5 bg-white border border-brand-border rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none"
              value={newTreatment.followUpDate}
              onChange={(e) => setNewTreatment({ ...newTreatment, followUpDate: e.target.value })}
            />
          </div>

          <div className="w-full sm:w-auto space-y-1.5">
            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest block ml-1">Select Doctor</label>
            <div className="flex gap-2">
              {['Dr. Debahuti Pattnaik', 'Dr. Sweta Sucharita'].map((doc) => (
                <button
                  key={doc}
                  type="button"
                  onClick={() => setNewTreatment({ ...newTreatment, doctorName: doc })}
                  className={`px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all border ${
                    newTreatment.doctorName === doc 
                      ? 'bg-brand-primary text-white border-brand-primary shadow-sm shadow-brand-primary/20' 
                      : 'bg-white text-brand-muted border-brand-border hover:border-brand-primary/30'
                  }`}
                >
                  {doc}
                </button>
              ))}
            </div>
          </div>

          <button
            disabled={isLogging}
            type="submit"
            className="w-full sm:w-auto btn-professional btn-success h-[42px] px-8 py-2.5"
          >
            <Save size={18} className="sm:hidden" />
            <span className="font-bold">{isLogging ? 'Saving...' : 'Save Record'}</span>
          </button>
        </form>

        <div className="px-5 sm:px-8 pb-8 pt-0">
          <div className="space-y-1.5 pt-4 sm:pt-0">
            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest block ml-1">Clinical Treatment Notes</label>
            <textarea
              placeholder="Enter comprehensive clinical observations, results, and recommendations..."
              className="w-full px-4 py-3 bg-white border border-brand-border rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none min-h-[100px] resize-none"
              value={newTreatment.notes}
              onChange={(e) => setNewTreatment({ ...newTreatment, notes: e.target.value })}
            />
          </div>
        </div>
      </div>

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
                <th className="px-5 sm:px-8 py-3 sm:py-4 text-[10px] font-bold text-brand-muted uppercase tracking-wider border-b border-brand-border">Treatment</th>
                <th className="px-5 sm:px-8 py-3 sm:py-4 text-[10px] font-bold text-brand-muted uppercase tracking-wider border-b border-brand-border">Intensity</th>
                <th className="px-5 sm:px-8 py-3 sm:py-4 text-[10px] font-bold text-brand-muted uppercase tracking-wider border-b border-brand-border text-right">Doctor</th>
                <th className="px-5 sm:px-8 py-3 sm:py-4 text-[10px] font-bold text-brand-muted uppercase tracking-wider border-b border-brand-border text-right">Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {treatments.map((t) => (
                <tr key={t.id} className="hover:bg-brand-row-hover transition-colors group">
                  <td className="px-5 sm:px-8 py-3 sm:py-4 mono text-[11px] sm:text-xs text-brand-muted">
                    {format(t.date instanceof Date ? t.date : t.date.toDate(), 'dd-MMM-yyyy')}
                  </td>
                  <td className="px-5 sm:px-8 py-3 sm:py-4">
                    <span className="px-2.5 py-1 bg-blue-50 text-brand-primary text-[10px] sm:text-[11px] font-bold rounded-lg group-hover:bg-white transition-colors block w-fit truncate max-w-[150px]">
                      {t.treatmentName}
                    </span>
                  </td>
                  <td className="px-5 sm:px-8 py-3 sm:py-4 text-[11px] sm:text-sm font-medium text-brand-secondary truncate max-w-[120px]">
                    {t.productUsage || '--'}
                  </td>
                  <td className="px-5 sm:px-8 py-3 sm:py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Stethoscope size={12} className="text-brand-muted" />
                      <span className="text-[11px] font-bold text-brand-secondary">{t.doctorName || '--'}</span>
                    </div>
                  </td>
                  <td className="px-5 sm:px-8 py-3 sm:py-4 text-[11px] sm:text-sm font-medium text-brand-muted italic text-right whitespace-nowrap">
                    {t.followUpDate ? format(t.followUpDate instanceof Date ? t.followUpDate : t.followUpDate.toDate(), 'dd-MMM-yy') : '--'}
                  </td>
                </tr>
              ))}
              {treatments.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-8 py-16 text-center text-brand-muted font-medium">
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
