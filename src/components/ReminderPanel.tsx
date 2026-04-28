import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, collectionGroup, orderBy, limit } from 'firebase/firestore';
import { format, addDays, isSameDay, startOfDay } from 'date-fns';
import { MessageCircle, Bell, User, Calendar, History, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Lead, Treatment } from '../types';

interface ReminderPanelProps {
  userId: string;
}

interface DueReminder {
  id: string;
  type: 'lead' | 'treatment';
  name: string;
  phone: string;
  dueDate: Date;
  daysRemaining: number;
  data: any;
}

export default function ReminderPanel({ userId }: ReminderPanelProps) {
  const [reminders, setReminders] = useState<DueReminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReminders = async () => {
      try {
        setLoading(true);
        const now = new Date();
        const startToday = startOfDay(now);
        
        // Target dates: today + 1 day, today + 3 days
        const target1 = addDays(startToday, 1);
        const target3 = addDays(startToday, 3);

        const remindersDue: DueReminder[] = [];

        // 1. Fetch leads
        const leadsQ = query(
          collection(db, 'leads'),
          where('ownerId', '==', userId),
          where('status', 'not-in', ['visited', 'cancelled'])
        );
        const leadsSnap = await getDocs(leadsQ);
        leadsSnap.docs.forEach(doc => {
          const lead = { id: doc.id, ...doc.data() } as Lead;
          if (lead.appointmentDate) {
            const dueDate = lead.appointmentDate.toDate();
            const startDue = startOfDay(dueDate);
            
            if (isSameDay(startDue, target1)) {
              remindersDue.push({
                id: doc.id,
                type: 'lead',
                name: lead.name,
                phone: lead.phone,
                dueDate,
                daysRemaining: 1,
                data: lead
              });
            } else if (isSameDay(startDue, target3)) {
              remindersDue.push({
                id: doc.id,
                type: 'lead',
                name: lead.name,
                phone: lead.phone,
                dueDate,
                daysRemaining: 3,
                data: lead
              });
            }
          }
        });

        // 2. Fetch treatments (using collectionGroup for followUpDate)
        const treatmentsQ = query(
          collectionGroup(db, 'treatments'),
          where('ownerId', '==', userId),
          orderBy('followUpDate', 'asc'),
          limit(500)
        );
        const treatmentsSnap = await getDocs(treatmentsQ);
        treatmentsSnap.docs.forEach(doc => {
          const t = { id: doc.id, ...doc.data() } as Treatment;
          if (t.followUpDate) {
            const dueDate = t.followUpDate.toDate();
            const startDue = startOfDay(dueDate);

            if (isSameDay(startDue, target1)) {
              remindersDue.push({
                id: doc.id,
                type: 'treatment',
                name: (t as any).clientName || 'Patient',
                phone: (t as any).clientPhone || '',
                dueDate,
                daysRemaining: 1,
                data: t
              });
            } else if (isSameDay(startDue, target3)) {
              remindersDue.push({
                id: doc.id,
                type: 'treatment',
                name: (t as any).clientName || 'Patient',
                phone: (t as any).clientPhone || '',
                dueDate,
                daysRemaining: 3,
                data: t
              });
            }
          }
        });

        setReminders(remindersDue.sort((a, b) => a.daysRemaining - b.daysRemaining));
      } catch (error) {
        console.error("Error fetching reminders:", error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) fetchReminders();
  }, [userId]);

  const sendWhatsApp = (reminder: DueReminder) => {
    let message = '';
    const dateStr = format(reminder.dueDate, 'dd MMM (EEEE)');
    
    if (reminder.type === 'lead') {
      if (reminder.daysRemaining === 3) {
        message = `Hello ${reminder.name}, this is Alesta Wellness. We're excited to see you for your inquiry regarding ${reminder.data.concern || 'our services'} in 3 days on ${dateStr}. See you soon!`;
      } else {
        message = `Hi ${reminder.name}! Just a quick reminder from Alesta Wellness about your scheduled visit tomorrow, ${dateStr}. Please let us know if you have any questions!`;
      }
    } else {
      if (reminder.daysRemaining === 3) {
        message = `Hello ${reminder.name}, Alesta Wellness here. Your follow-up session for ${reminder.data.treatmentName} is due in 3 days on ${dateStr}. Looking forward to seeing your progress!`;
      } else {
        message = `Dear ${reminder.name}, this is a reminder for your ${reminder.data.treatmentName} follow-up tomorrow, ${dateStr} at Alesta Wellness. See you then!`;
      }
    }

    const encodedMsg = encodeURIComponent(message);
    const phone = reminder.phone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone.startsWith('91') ? phone : '91' + phone}?text=${encodedMsg}`, '_blank');
  };

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-brand-secondary">Follow-up Reminders Due Today</h3>
          <p className="text-xs text-brand-muted mt-1">Identified based on 1-day and 3-day advance windows</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-brand-primary rounded-lg">
          <Bell size={14} />
          <span className="text-[10px] font-black uppercase tracking-widest">{reminders.length} Due</span>
        </div>
      </div>

      {reminders.length === 0 ? (
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm">
            <CheckCircle2 className="text-emerald-500" size={24} />
          </div>
          <h4 className="text-sm font-bold text-brand-secondary uppercase tracking-widest">All Caught Up!</h4>
          <p className="text-xs text-brand-muted mt-1 max-w-[240px] mx-auto">No automated reminders are due for your patients or leads today.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reminders.map((r, idx) => (
            <motion.div 
              key={r.id + idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white border border-brand-border rounded-2xl p-5 hover:border-brand-primary/30 transition-all group shadow-sm"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${
                  r.daysRemaining === 1 ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-brand-primary'
                }`}>
                  {r.daysRemaining} Day Reminder
                </div>
                <div className={`text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border ${
                  r.type === 'lead' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                }`}>
                  {r.type === 'lead' ? 'Inquiry' : 'Treatment'}
                </div>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-brand-secondary group-hover:bg-brand-primary group-hover:text-white transition-colors">
                  <User size={20} />
                </div>
                <div>
                  <div className="text-sm font-black text-brand-secondary">{r.name}</div>
                  <div className="text-xs text-brand-muted mono">{r.phone}</div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-[10px] text-brand-muted font-bold">
                  <Calendar size={12} />
                  Due: {format(r.dueDate, 'dd MMM yyyy')}
                </div>
                {r.type === 'treatment' && (
                  <div className="flex items-center gap-2 text-[10px] text-brand-muted font-bold italic">
                    <History size={12} />
                    {r.data.treatmentName}
                  </div>
                )}
              </div>

              <button 
                onClick={() => sendWhatsApp(r)}
                className="w-full py-3 bg-[#25D366] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-[#25D366]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <MessageCircle size={14} />
                Send WhatsApp Reminder
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

import { CheckCircle2 } from 'lucide-react';
