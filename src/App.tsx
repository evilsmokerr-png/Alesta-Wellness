import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Leaf, Users, LayoutDashboard, Bell, Activity, Calendar, ChevronRight, Phone, Zap, StickyNote, CheckCircle2, MapPin, Stethoscope, Tag, MessageSquare, AlertTriangle, RefreshCw, Trash2, Clock, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from './lib/firebase';
import { collection, collectionGroup, query, where, onSnapshot, orderBy, limit, doc, getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, format, isToday, addDays, isBefore } from 'date-fns';
import Auth from './components/Auth';
import DashboardView from './components/DashboardView';
import ClientDashboard from './components/ClientDashboard';
import ClientDetail from './components/ClientDetail';
import ClientForm from './components/ClientForm';
import LeadDashboard from './components/LeadDashboard';
import RescheduleModal from './components/RescheduleModal';
import { Client, Lead } from './types';
import { handleFirestoreError } from './lib/errorHandlers';

type ViewType = 'dashboard' | 'clients' | 'notifications' | 'leads';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [view, setView] = useState<ViewType>('dashboard');
  
  const [stats, setStats] = useState({
    treatmentsToday: 0,
    followUpsDue: 0,
    activeLeads: 0,
    leadsDue: 0
  });
  const [followUpList, setFollowUpList] = useState<any[]>([]);
  const [treatmentsTodayList, setTreatmentsTodayList] = useState<any[]>([]);
  const [leadsDueList, setLeadsDueList] = useState<Lead[]>([]);
  const [upcomingFollowUpsList, setUpcomingFollowUpsList] = useState<any[]>([]);
  const [upcomingLeadsList, setUpcomingLeadsList] = useState<Lead[]>([]);
  const [clientDataMap, setClientDataMap] = useState<Record<string, Client>>({});
  const [recentTreatments, setRecentTreatments] = useState<any[]>([]);

  const [rescheduleData, setRescheduleData] = useState<{ type: 'lead' | 'followup', data: any } | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setStats({ treatmentsToday: 0, followUpsDue: 0 });
      setFollowUpList([]);
      setRecentTreatments([]);
      setStats({ treatmentsToday: 0, followUpsDue: 0, activeLeads: 0 });
      return;
    }

    const todayEnd = endOfDay(new Date());
    const notificationThreshold = endOfDay(addDays(new Date(), 1));
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());

    // 1. Treatments Today
    const treatmentsTodayQuery = query(
      collectionGroup(db, 'treatments'),
      where('ownerId', '==', user.uid),
      where('date', '>=', startOfDay(new Date())),
      where('date', '<=', todayEnd)
    );

    const unsubTreatments = onSnapshot(treatmentsTodayQuery, (snapshot) => {
      setStats(prev => ({ ...prev, treatmentsToday: snapshot.size }));
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        parentId: doc.ref.parent.parent?.id,
        ...doc.data()
      }));
      setTreatmentsTodayList(list);

      // Fetch client data for items that don't have them denormalized
      list.forEach(async (item: any) => {
        if (item.parentId && !clientDataMap[item.parentId]) {
          const cDoc = await getDoc(doc(db, 'clients', item.parentId));
          if (cDoc.exists()) {
            const data = cDoc.data() as Client;
            setClientDataMap(prev => ({
              ...prev,
              [item.parentId!]: { ...data, id: cDoc.id }
            }));
          }
        }
      });
    });

    // 2. Follow-ups Due & Notification List
    const followUpsQuery = query(
      collectionGroup(db, 'treatments'),
      where('ownerId', '==', user.uid),
      where('followUpDate', '<=', notificationThreshold),
      orderBy('followUpDate', 'desc')
    );

    const unsubFollowUps = onSnapshot(followUpsQuery, (snapshot) => {
      setStats(prev => ({ ...prev, followUpsDue: snapshot.size }));
      const list = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        parentId: doc.ref.parent.parent?.id,
        ...doc.data() 
      }));
      setFollowUpList(list);

      // Fetch client data for items that don't have them denormalized
      list.forEach(async (item: any) => {
        if (item.parentId && !clientDataMap[item.parentId]) {
          const cDoc = await getDoc(doc(db, 'clients', item.parentId));
          if (cDoc.exists()) {
            const data = cDoc.data() as Client;
            setClientDataMap(prev => ({
              ...prev,
              [item.parentId!]: { ...data, id: cDoc.id }
            }));
          }
        }
      });
    });

    // 4. Recent Activity (Last 10 treatments across all patients)
    const recentQuery = query(
      collectionGroup(db, 'treatments'),
      where('ownerId', '==', user.uid),
      orderBy('date', 'desc'),
      limit(10)
    );

    const unsubRecent = onSnapshot(recentQuery, (snapshot) => {
      setRecentTreatments(snapshot.docs.map(doc => ({
        id: doc.id,
        parentId: doc.ref.parent.parent?.id,
        ...doc.data()
      })));
    });

    // 5. Active Leads Count
    const leadsQuery = query(
      collection(db, 'leads'),
      where('ownerId', '==', user.uid),
      where('status', 'in', ['enquiry', 'appointment_set'])
    );

    const unsubLeadsCount = onSnapshot(leadsQuery, (snapshot) => {
      setStats(prev => ({ ...prev, activeLeads: snapshot.size }));
    });

    // 6. Leads Due Today/Overdue for Notifications
    const leadsDueTodayQuery = query(
      collection(db, 'leads'),
      where('ownerId', '==', user.uid),
      where('appointmentDate', '<=', notificationThreshold),
      where('status', 'in', ['enquiry', 'appointment_set'])
    );

    const unsubLeadsDue = onSnapshot(leadsDueTodayQuery, (snapshot) => {
      setLeadsDueList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead)));
      setStats(prev => ({ ...prev, leadsDue: snapshot.size }));
    });

    // 7. Strictly Future Follow-ups (Upcoming)
    const futureFollowUpsQuery = query(
      collectionGroup(db, 'treatments'),
      where('ownerId', '==', user.uid),
      where('followUpDate', '>', todayEnd),
      orderBy('followUpDate', 'asc')
    );
    const unsubFutureFollowUps = onSnapshot(futureFollowUpsQuery, (snapshot) => {
      setUpcomingFollowUpsList(snapshot.docs.map(doc => ({ 
        id: doc.id, 
        parentId: doc.ref.parent.parent?.id,
        ...doc.data() 
      })));
    });

    // 8. Strictly Future Leads (Upcoming)
    const futureLeadsQuery = query(
      collection(db, 'leads'),
      where('ownerId', '==', user.uid),
      where('appointmentDate', '>', todayEnd),
      where('status', 'in', ['enquiry', 'appointment_set']),
      orderBy('appointmentDate', 'asc')
    );
    const unsubFutureLeads = onSnapshot(futureLeadsQuery, (snapshot) => {
      setUpcomingLeadsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead)));
    });

    return () => {
      unsubTreatments();
      unsubFollowUps();
      unsubRecent();
      unsubLeadsCount();
      unsubLeadsDue();
      unsubFutureFollowUps();
      unsubFutureLeads();
    };
  }, [user]);

  const handleClientSaved = (client: Client) => {
    setIsFormOpen(false);
    setSelectedClient(client);
  };

  const handleNavClick = (newView: ViewType) => {
    setView(newView);
    setSelectedClient(null);
  };

  const handleSelectClientById = async (clientId: string) => {
    try {
      const clientDoc = await getDoc(doc(db, 'clients', clientId));
      if (clientDoc.exists()) {
        setSelectedClient({ id: clientDoc.id, ...clientDoc.data() } as Client);
      }
    } catch (error) {
      console.error("Error fetching client from notification:", error);
    }
  };

  const handleCompleteFollowUp = async (clientId: string, treatmentId: string) => {
    if (!clientId) return;
    try {
      const treatmentRef = doc(db, 'clients', clientId, 'treatments', treatmentId);
      await updateDoc(treatmentRef, {
        followUpDate: null,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      const msg = handleFirestoreError(error, 'update', `clients/${clientId}/treatments/${treatmentId}`);
      alert(msg);
    }
  };

  const handleDeleteTreatmentRecord = async (clientId: string, treatmentId: string) => {
    if (!clientId || !treatmentId) return;
    try {
      await deleteDoc(doc(db, 'clients', clientId, 'treatments', treatmentId));
      setConfirmingDeleteId(null);
      // Update client's updatedAt
      await updateDoc(doc(db, 'clients', clientId), {
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      const msg = handleFirestoreError(error, 'delete', `clients/${clientId}/treatments/${treatmentId}`);
      alert(msg);
    }
  };

  const handleMarkLeadVisited = async (leadId: string) => {
    if (!user) return;
    try {
      const leadRef = doc(db, 'leads', leadId);
      const leadSnap = await getDoc(leadRef);
      if (!leadSnap.exists()) return;
      const leadData = leadSnap.data() as Lead;

      // 1. Update Lead Status
      await updateDoc(leadRef, {
        status: 'visited',
        updatedAt: serverTimestamp()
      });

      // 2. Find or Create Client
      let targetClient: Client | null = null;
      const clientsRef = collection(db, 'clients');
      const q = query(clientsRef, 
        where('ownerId', '==', user.uid), 
        where('phone', '==', leadData.phone)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const d = querySnapshot.docs[0];
        targetClient = { id: d.id, ...d.data() } as Client;
      } else {
        const clientData = {
          name: leadData.name,
          phone: leadData.phone,
          address: '',
          source: leadData.source || '',
          concern: leadData.concern || '',
          searchName: leadData.name.toLowerCase(),
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        const newClientRef = await addDoc(clientsRef, clientData);
        targetClient = { id: newClientRef.id, ...clientData } as Client;
      }

      // 3. Open the client record directly
      if (targetClient) {
        setSelectedClient(targetClient);
      }

    } catch (error) {
      const msg = handleFirestoreError(error, 'update', `leads/${leadId}`);
      alert(msg);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!leadId) return;
    try {
      await deleteDoc(doc(db, 'leads', leadId));
      setConfirmingDeleteId(null);
    } catch (error) {
      const msg = handleFirestoreError(error, 'delete', `leads/${leadId}`);
      alert(msg);
    }
  };

  const handleRescheduleClient = async (client: Client) => {
    if (!user || !client.id) return;
    try {
      const treatmentsRef = collection(db, 'clients', client.id, 'treatments');
      const q = query(treatmentsRef, orderBy('date', 'desc'), limit(1));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const latestTreatment = { id: querySnapshot.docs[0].id, parentId: client.id, ...querySnapshot.docs[0].data() };
        setRescheduleData({ type: 'followup', data: latestTreatment });
      } else {
        alert("No treatment record found to reschedule. Please log a treatment first.");
      }
    } catch (error) {
      console.error("Error fetching latest treatment for reschedule:", error);
    }
  };

  return (
    <div className="min-h-screen font-sans flex bg-slate-50/50">
      {/* Sidebar - Professional Polish Style */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-brand-border hidden lg:flex flex-col p-6 z-40">
        <div className="flex items-center gap-2 text-brand-primary font-bold text-lg mb-8">
          <div className="w-8 h-8 bg-brand-primary rounded-lg flex items-center justify-center text-white">
            <Leaf size={18} />
          </div>
          Alesta Wellness
        </div>
        
        <div className="space-y-4 mb-8">
          <button 
            onClick={() => handleNavClick('dashboard')}
            className="w-full text-left bg-slate-50 p-4 rounded-xl border border-brand-border hover:border-brand-primary/30 transition-colors group"
          >
            <div className="text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-1 group-hover:text-brand-primary transition-colors">Treatments Today</div>
            <div className="text-2xl font-bold text-brand-secondary">{stats.treatmentsToday.toString().padStart(2, '0')}</div>
          </button>
          <button 
            onClick={() => handleNavClick('notifications')}
            className="w-full text-left bg-slate-50 p-4 rounded-xl border border-brand-border hover:border-brand-primary/30 transition-colors group"
          >
            <div className="text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-1 group-hover:text-brand-primary transition-colors">Follow-ups Due</div>
            <div className="text-2xl font-bold text-brand-secondary">{(stats.followUpsDue + stats.leadsDue).toString().padStart(2, '0')}</div>
          </button>
          <button 
            onClick={() => handleNavClick('leads')}
            className="w-full text-left bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 hover:border-emerald-500/30 transition-colors group"
          >
            <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">New Inquiries</div>
            <div className="text-2xl font-bold text-brand-secondary">{stats.activeLeads.toString().padStart(2, '0')}</div>
          </button>
        </div>

        <nav className="flex-1 space-y-2">
          <button 
            onClick={() => handleNavClick('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
              view === 'dashboard' ? 'bg-blue-50 text-brand-primary' : 'text-brand-muted hover:bg-slate-50'
            }`}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button 
            onClick={() => handleNavClick('clients')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
              view === 'clients' ? 'bg-blue-50 text-brand-primary' : 'text-brand-muted hover:bg-slate-50'
            }`}
          >
            <Users size={18} />
            Clients
          </button>
          <button 
            onClick={() => handleNavClick('leads')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
              view === 'leads' ? 'bg-emerald-50 text-emerald-600' : 'text-brand-muted hover:bg-slate-50'
            }`}
          >
            <Phone size={18} />
            Inquiries
          </button>
          <button 
            onClick={() => handleNavClick('notifications')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
              view === 'notifications' ? 'bg-blue-50 text-brand-primary' : 'text-brand-muted hover:bg-slate-50'
            }`}
          >
            <Bell size={18} />
            Notifications
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-brand-border">
          <div className="text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-1">Connected as</div>
          <div className="text-xs font-semibold text-brand-secondary truncate">{user?.email || 'Guest Office'}</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="lg:pl-64 flex-1 min-h-screen flex flex-col pb-20 lg:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-brand-border px-4 sm:px-8 py-4 flex items-center justify-between shadow-sm shadow-slate-200/20">
          <div className="flex items-center gap-3 lg:hidden overflow-hidden">
             <div className="w-8 h-8 bg-brand-primary rounded-lg flex-shrink-0 flex items-center justify-center text-white shadow-md shadow-brand-primary/20">
              <Leaf size={18} />
            </div>
            <h1 className="font-bold text-brand-secondary tracking-tight truncate">Alesta Wellness</h1>
          </div>
          
          <div className="hidden lg:block">
            <h1 className="text-lg font-bold text-brand-secondary tracking-tight">
              {view === 'dashboard' && !selectedClient && "Clinical Overview"}
              {view === 'clients' && !selectedClient && "Patient Records"}
              {view === 'leads' && !selectedClient && "Manage Inquiries"}
              {view === 'notifications' && !selectedClient && "Daily Follow-ups"}
              {selectedClient && `Patient: ${selectedClient.name}`}
            </h1>
          </div>

          <Auth onAuthChange={setUser} />
        </header>

        {/* Dynamic Content Pane */}
        <div className="flex-1 p-4 sm:p-8">
          {!user ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10 sm:mt-20 flex flex-col items-center text-center max-w-2xl mx-auto px-2"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-50 rounded-2xl flex items-center justify-center text-brand-primary mb-6 sm:mb-8 border border-blue-100">
                <Leaf size={32} className="sm:hidden" />
                <Leaf size={40} className="hidden sm:block" />
              </div>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-brand-secondary mb-4 sm:mb-6 tracking-tight">Elite Patient Management.</h2>
              <p className="text-brand-muted text-base sm:text-lg mb-8 sm:mb-10 leading-relaxed font-medium">
                Our precision-built dashboard empowers professionals to track clinical records with absolute clarity and control.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                <div className="flex-1 bg-white border border-brand-border p-5 sm:p-6 rounded-xl text-left shadow-sm">
                    <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded flex items-center justify-center mb-3">
                      <LayoutDashboard size={16} />
                    </div>
                    <h3 className="font-bold text-brand-secondary mb-2 whitespace-nowrap">Clinical Oversight</h3>
                    <p className="text-xs text-brand-muted leading-relaxed">Secure, searchable database for treatment protocols and outcomes.</p>
                </div>
                <div className="flex-1 bg-white border border-brand-border p-5 sm:p-6 rounded-xl text-left shadow-sm">
                    <div className="w-8 h-8 bg-green-50 text-green-600 rounded flex items-center justify-center mb-3">
                      <Activity size={16} />
                    </div>
                    <h3 className="font-bold text-brand-secondary mb-2 whitespace-nowrap">Outcome Tracking</h3>
                    <p className="text-xs text-brand-muted leading-relaxed">Systematic logging of product usage and energy parameters.</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              {selectedClient ? (
                <motion.div
                  key="detail"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <ClientDetail 
                    userId={user.uid}
                    client={selectedClient} 
                    onBack={() => setSelectedClient(null)} 
                    onUpdate={setSelectedClient}
                  />
                </motion.div>
              ) : view === 'notifications' ? (
                <motion.div
                   key="notifications"
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="max-w-4xl mx-auto space-y-6 pb-12"
                >
                   <div className="flex items-center justify-between px-2">
                     <div>
                       <h2 className="text-xl sm:text-2xl font-bold text-brand-secondary tracking-tight">Daily Follow-ups</h2>
                       <p className="text-brand-muted text-xs sm:text-sm mt-1">Directly manage patient interactions and clinical outcomes.</p>
                     </div>
                     <div className="bg-brand-primary text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg shadow-brand-primary/20">
                       {followUpList.length + leadsDueList.length + treatmentsTodayList.length} Total
                     </div>
                   </div>

                   {treatmentsTodayList.length > 0 && (
                     <div className="space-y-4 pt-2">
                       <div className="flex items-center gap-2 px-2 text-brand-primary">
                         <Activity size={18} />
                         <h3 className="font-bold text-sm uppercase tracking-widest">Clinical Activity (Today)</h3>
                       </div>
                       {treatmentsTodayList.map((treatment, idx) => {
                         const clientName = treatment.clientName || clientDataMap[treatment.parentId!]?.name || 'Unknown Patient';
                         const clientPhone = treatment.clientPhone || clientDataMap[treatment.parentId!]?.phone || 'No Phone';
                         
                         return (
                           <motion.div 
                             key={treatment.id}
                             initial={{ opacity: 0, y: 10 }}
                             animate={{ opacity: 1, y: 0 }}
                             transition={{ delay: idx * 0.05 }}
                             className="bg-white rounded-2xl border border-brand-primary/20 overflow-hidden shadow-sm hover:shadow-md transition-all group"
                           >
                             <div className="p-4 sm:p-6 space-y-4">
                               <div className="flex items-start justify-between border-b border-slate-50 pb-4">
                                 <div className="flex items-center gap-4">
                                   <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-50 text-brand-primary flex items-center justify-center border border-blue-100 flex-shrink-0">
                                      <Stethoscope size={24} />
                                   </div>
                                   <div className="min-w-0">
                                     <div className="text-base sm:text-lg font-bold text-brand-secondary leading-tight truncate uppercase tracking-tighter">
                                       {treatment.treatmentName}
                                     </div>
                                     <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                       <span className="text-xs font-bold text-brand-secondary flex items-center gap-1">
                                         <Users size={12} className="text-brand-muted" /> {clientName}
                                       </span>
                                       <span className="text-xs font-medium text-brand-muted flex items-center gap-1.5">
                                         <Phone size={12} /> {clientPhone}
                                       </span>
                                       <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-widest">
                                         Completed
                                       </span>
                                     </div>
                                   </div>
                                 </div>
                                 <div className="hidden sm:flex flex-col items-end">
                                   <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mb-1 font-mono">Timestamp</div>
                                   <div className="text-xs font-bold px-2 py-1 rounded bg-slate-50 text-brand-secondary">
                                     {treatment.date?.toDate ? format(treatment.date.toDate(), 'h:mm a') : 'Now'}
                                   </div>
                                 </div>
                               </div>

                               <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1">
                                      <Zap size={10} className="text-yellow-500" />
                                      Intensity / Parameters
                                    </div>
                                    <div className="text-sm font-bold text-brand-secondary">{treatment.productUsage || 'Standard Protocol'}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1">
                                      <Stethoscope size={10} className="text-brand-primary" />
                                      Attending Doctor
                                    </div>
                                    <div className="text-sm font-semibold text-brand-secondary">{treatment.doctorName || 'Dr. Consultant'}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1">
                                      <Calendar size={10} className="text-orange-500" />
                                      Follow-up Scheduled
                                    </div>
                                    <div className="text-sm font-bold text-brand-secondary italic">
                                      {treatment.followUpDate ? format(treatment.followUpDate.toDate ? treatment.followUpDate.toDate() : new Date(treatment.followUpDate), 'MMM d, yyyy') : 'No Follow-up'}
                                    </div>
                                  </div>
                               </div>

                               {treatment.notes && (
                                 <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 mt-2">
                                   <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-2 mb-3">
                                     <StickyNote size={12} className="text-brand-primary" />
                                     Clinical Observations
                                   </div>
                                   <p className="text-sm text-brand-secondary leading-relaxed border-l-2 border-brand-primary/20 pl-4 py-1 italic">
                                     "{treatment.notes}"
                                   </p>
                                 </div>
                               )}
                               
                               <div className="flex justify-end gap-3 pt-2">
                                  <button 
                                    onClick={() => treatment.parentId && handleSelectClientById(treatment.parentId)}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-brand-primary text-white rounded-xl text-xs font-bold hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/10"
                                  >
                                    View Full Patient History
                                  </button>
                                  <button 
                                    onClick={() => setConfirmingDeleteId(treatment.id)}
                                    className="p-2 text-brand-muted hover:text-red-500 transition-colors"
                                    title="Delete Record"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                               </div>
                             </div>
                           </motion.div>
                         );
                       })}
                     </div>
                  )}
                  
                  {leadsDueList.length > 0 && (
                     <div className="space-y-4">
                       <div className="flex items-center gap-2 px-2 text-[#2ecc71]">
                         <Bell size={18} />
                         <h3 className="font-bold text-sm uppercase tracking-widest">Inquiry Appointments Due</h3>
                       </div>
                       {leadsDueList.map((lead, idx) => {
                         const apptDate = lead.appointmentDate?.toDate ? lead.appointmentDate.toDate() : new Date(lead.appointmentDate);
                         return (
                           <motion.div 
                             key={lead.id} 
                             initial={{ opacity: 0, x: -10 }}
                             animate={{ opacity: 1, x: 0 }}
                             transition={{ delay: idx * 0.05 }}
                             className={`bg-white rounded-2xl border ${isToday(apptDate) ? 'border-emerald-200 ring-1 ring-emerald-50' : 'border-brand-border'} overflow-hidden shadow-sm hover:shadow-md transition-all group`}
                           >
                             <div className="p-4 sm:p-6 space-y-4">
                               <div className="flex items-start justify-between border-b border-slate-50 pb-4">
                                 <div className="flex items-center gap-3 sm:gap-4">
                                   <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl ${isToday(apptDate) ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'} flex items-center justify-center border border-current opacity-20 flex-shrink-0`}>
                                     <Phone size={20} />
                                   </div>
                                   <div className="min-w-0">
                                     <div className="text-base sm:text-lg font-bold text-brand-secondary leading-tight truncate">
                                       {lead.name}
                                     </div>
                                     <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                                       <a href={`tel:${lead.phone.replace(/\D/g, '')}`} className="text-xs font-medium text-brand-primary flex items-center gap-1.5 hover:underline bg-blue-50/50 px-2 py-0.5 rounded-full">
                                         <Phone size={12} /> {lead.phone}
                                       </a>
                                       <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                         isToday(apptDate) 
                                           ? 'bg-emerald-50 text-emerald-600' 
                                           : isBefore(apptDate, startOfDay(new Date())) 
                                             ? 'bg-red-50 text-red-600' 
                                             : 'bg-blue-50 text-blue-600'
                                       }`}>
                                         {isToday(apptDate) 
                                           ? 'APPOINTMENT TODAY' 
                                           : isBefore(apptDate, startOfDay(new Date())) 
                                             ? 'OVERDUE APPOINTMENT' 
                                             : 'DUE TOMORROW'}
                                       </span>
                                     </div>
                                   </div>
                                 </div>
                                 <div className="hidden sm:flex flex-col items-end">
                                   <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mb-1">Appt Date</div>
                                   <div className={`text-xs font-bold px-2 py-1 rounded ${isToday(apptDate) ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-brand-secondary'}`}>
                                     {format(apptDate, 'MMM d, yyyy')}
                                   </div>
                                 </div>
                               </div>

                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1">
                                      <Tag size={10} className="text-brand-primary" />
                                      Source
                                    </div>
                                    <div className="text-sm font-bold text-brand-secondary">{lead.source || 'Direct Inquiry'}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1">
                                      <MessageSquare size={10} className="text-blue-500" />
                                      Concern
                                    </div>
                                    <div className="text-sm font-semibold text-brand-secondary">{lead.concern || 'Not specified'}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1">
                                      <Clock size={10} className="text-orange-500" />
                                      Current Status
                                    </div>
                                    <div className="text-sm font-bold text-brand-secondary uppercase tracking-tighter">{lead.status.replace('_', ' ')}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1">
                                      <CheckCircle2 size={10} className="text-emerald-500" />
                                      Last Update
                                    </div>
                                    <div className="text-sm font-medium text-brand-muted">
                                      {lead.updatedAt?.toDate ? format(lead.updatedAt.toDate(), 'MMM d, p') : 'Pending'}
                                    </div>
                                  </div>
                                </div>

                               {lead.notes && (
                                 <div className="bg-brand-primary/5 rounded-2xl p-5 border border-brand-primary/10 mt-2 relative overflow-hidden group/notes">
                                   <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/5 rounded-full -mr-12 -mt-12 transition-transform group-hover/notes:scale-110" />
                                   <div className="text-[10px] font-bold text-brand-primary uppercase tracking-widest flex items-center gap-2 mb-3 relative">
                                     <div className="p-1 px-1.5 bg-brand-primary text-white rounded">
                                       <StickyNote size={10} />
                                     </div>
                                     Client Care Notes
                                   </div>
                                   <p className="text-sm text-brand-secondary leading-relaxed relative pl-2 border-l-2 border-brand-primary/20">
                                     {lead.notes}
                                   </p>
                                 </div>
                               )}
                             </div>

                             <div className="bg-slate-50 border-t border-slate-100 p-4 flex items-center justify-between sm:px-6">
                               <button 
                                 onClick={() => setView('leads')}
                                 className="hidden sm:flex items-center gap-2 text-xs font-bold text-brand-muted hover:text-brand-primary transition-colors uppercase tracking-widest"
                               >
                                 <LayoutDashboard size={14} />
                                 Manage All Inquiries
                                </button>
                                <div className="flex gap-2 w-full sm:w-auto items-center">
                                  <AnimatePresence mode="wait">
                                    {confirmingDeleteId === lead.id ? (
                                      <motion.div 
                                        initial={{ x: 10, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        exit={{ x: 10, opacity: 0 }}
                                        className="flex items-center gap-1.5"
                                      >
                                        <button
                                          onClick={() => handleDeleteLead(lead.id!)}
                                          className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors border border-red-100 uppercase tracking-widest"
                                        >
                                          Confirm Delete
                                        </button>
                                        <button
                                          onClick={() => setConfirmingDeleteId(null)}
                                          className="text-[10px] font-bold text-brand-muted hover:text-brand-secondary px-3 py-1.5 rounded-lg border border-slate-100 uppercase tracking-widest"
                                        >
                                          Cancel
                                        </button>
                                      </motion.div>
                                    ) : (
                                      <>
                                        <button 
                                          onClick={() => setRescheduleData({ type: 'lead', data: lead })}
                                          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-brand-border rounded-lg text-xs font-bold text-brand-secondary hover:border-brand-primary/30 transition-all shadow-sm"
                                        >
                                          <RefreshCw size={14} /> Reschedule
                                        </button>
                                        <a href={`tel:${lead.phone.replace(/\D/g, '')}`} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-brand-border rounded-lg text-xs font-bold text-brand-secondary hover:border-brand-primary/30 transition-all shadow-sm">
                                          <Phone size={14} /> Call Now
                                        </a>
                                        <button 
                                          onClick={() => handleMarkLeadVisited(lead.id!)}
                                          className="flex-3 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[#2ecc71] text-white rounded-lg text-xs font-bold hover:bg-[#27ae60] transition-all shadow-md shadow-emerald-500/10"
                                        >
                                          <CheckCircle2 size={14} /> Mark Visited
                                        </button>
                                        <button 
                                          onClick={() => setConfirmingDeleteId(lead.id!)}
                                          className="p-2 text-brand-muted hover:text-red-500 transition-colors"
                                          title="Delete Inquiry"
                                        >
                                          <Trash2 size={18} />
                                        </button>
                                      </>
                                    )}
                                  </AnimatePresence>
                                </div>
                             </div>
                           </motion.div>
                         );
                       })}
                     </div>
                   )}
                   
                   {followUpList.length > 0 ? (
                     <div className="space-y-4 pt-4">
                       <div className="flex items-center gap-2 px-2 text-brand-primary">
                         <Activity size={18} />
                         <h3 className="font-bold text-sm uppercase tracking-widest">Treatment Followup Reminders Due</h3>
                       </div>
                       {followUpList.map((item, idx) => (
                         <motion.div 
                           key={item.id} 
                           initial={{ opacity: 0, x: -10 }}
                           animate={{ opacity: 1, x: 0 }}
                           transition={{ delay: idx * 0.05 }}
                           className="bg-white rounded-2xl border border-brand-border overflow-hidden shadow-sm hover:shadow-md transition-all group"
                         >
                           <div className="p-4 sm:p-6 space-y-4">
                             {/* Client Header */}
                             <div className="flex items-start justify-between border-b border-slate-50 pb-4">
                               <div className="flex items-center gap-3 sm:gap-4">
                                 <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-brand-primary border border-blue-100 flex-shrink-0">
                                   <Users size={20} />
                                 </div>
                                 <div className="min-w-0">
                                   <div className="text-base sm:text-lg font-bold text-brand-secondary leading-tight truncate">
                                     {item.clientName || clientDataMap[item.parentId!]?.name || 'Unknown Patient'}
                                   </div>
                                   <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                                      <a 
                                        href={`tel:${(item.clientPhone || clientDataMap[item.parentId!]?.phone || '').replace(/\D/g, '')}`} 
                                        className="text-xs font-medium text-brand-primary flex items-center gap-1.5 hover:underline bg-blue-50/50 px-2 py-0.5 rounded-full"
                                      >
                                        <Phone size={12} />
                                        {item.clientPhone || clientDataMap[item.parentId!]?.phone || 'No number'}
                                      </a>
                                      {(() => {
                                        const fDate = item.followUpDate?.toDate ? item.followUpDate.toDate() : new Date(item.followUpDate);
                                        return (
                                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            isToday(fDate) 
                                              ? 'bg-emerald-50 text-emerald-600' 
                                              : isBefore(fDate, startOfDay(new Date())) 
                                                ? 'bg-red-50 text-red-600' 
                                                : 'bg-blue-50 text-blue-600'
                                          }`}>
                                            {isToday(fDate) 
                                              ? 'FOLLOW-UP TODAY' 
                                              : isBefore(fDate, startOfDay(new Date())) 
                                                ? 'OVERDUE' 
                                                : 'DUE TOMORROW'}
                                          </span>
                                        );
                                      })()}
                                      {(item.clientAddress || clientDataMap[item.parentId!]?.address) && (
                                        <>
                                          <span className="text-slate-300 hidden sm:inline">•</span>
                                          <div className="text-[11px] text-brand-muted flex items-center gap-1.5">
                                            <MapPin size={12} />
                                            <span className="truncate max-w-[200px] sm:max-w-md">
                                              {item.clientAddress || clientDataMap[item.parentId!]?.address}
                                            </span>
                                          </div>
                                        </>
                                      )}
                                   </div>
                                 </div>
                               </div>
                               <div className="hidden sm:flex flex-col items-end">
                                 <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mb-1">Last Log Date</div>
                                 <div className="text-xs font-bold text-brand-secondary bg-slate-100 px-2 py-1 rounded">
                                   {item.date?.toDate ? format(item.date.toDate(), 'MMM d, yyyy') : 'Recently'}
                                 </div>
                               </div>
                             </div>

                             {/* Treatment Details Grid */}
                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-2 border-t border-slate-50 pt-4">
                               <div className="space-y-4">
                                 <div className="space-y-1">
                                   <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1">
                                     <Activity size={10} className="text-brand-primary" />
                                     Last Treatment performed
                                   </div>
                                   <div className="text-sm font-bold text-brand-secondary">{item.treatmentName}</div>
                                 </div>
                                 <div className="space-y-1">
                                   <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1">
                                     <Zap size={10} className="text-orange-500" />
                                     Energy / Product Usage
                                   </div>
                                   <div className="text-sm font-semibold text-brand-secondary">{item.productUsage || 'Standard'}</div>
                                 </div>
                               </div>

                               <div className="space-y-4">
                                 <div className="space-y-1">
                                   <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1">
                                     <Tag size={10} className="text-brand-primary" />
                                     Patient Acquisition Source
                                   </div>
                                   <div className="text-sm font-bold text-brand-secondary">
                                     {clientDataMap[item.parentId!]?.source || 'Internal Database'}
                                   </div>
                                 </div>
                                 <div className="space-y-1">
                                   <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1">
                                     <MessageSquare size={10} className="text-blue-500" />
                                     Primary Clinical Concern
                                   </div>
                                   <div className="text-sm font-semibold text-brand-secondary italic">
                                     {clientDataMap[item.parentId!]?.concern || 'Routine Review'}
                                   </div>
                                 </div>
                               </div>

                               <div className="space-y-4">
                                 <div className="space-y-1">
                                   <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1">
                                     <Stethoscope size={10} className="text-brand-primary" />
                                     Practitioner in Charge
                                   </div>
                                   <div className="text-sm font-bold text-brand-secondary truncate">{item.doctorName || '--'}</div>
                                 </div>
                                 <div className="space-y-1">
                                   <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1">
                                     <Calendar size={10} className="text-brand-primary" />
                                     Next Scheduled Follow-up
                                   </div>
                                   <div className="text-sm font-bold text-brand-primary flex items-center gap-1">
                                     {item.followUpDate?.toDate ? format(item.followUpDate.toDate(), 'MMMM d, yyyy') : 'No date'}
                                   </div>
                                 </div>
                               </div>
                             </div>

                             {/* Patient Context Notes */}
                             {item.notes && (
                               <div className="bg-brand-primary/5 rounded-2xl p-5 border border-brand-primary/10 mt-2 relative overflow-hidden group/notes">
                                  <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/5 rounded-full -mr-12 -mt-12 transition-transform group-hover/notes:scale-110" />
                                  <div className="text-[10px] font-bold text-brand-primary uppercase tracking-widest flex items-center gap-2 mb-3 relative">
                                    <div className="p-1 px-1.5 bg-brand-primary text-white rounded">
                                      <StickyNote size={10} />
                                    </div>
                                    Client Clinical History Note
                                  </div>
                                  <p className="text-sm text-brand-secondary leading-relaxed relative pl-2 border-l-2 border-brand-primary/20">
                                    {item.notes}
                                  </p>
                               </div>
                             )}

                             {/* Mobile Footer Meta */}
                             <div className="sm:hidden flex items-center justify-between pt-2">
                               <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">Logged: {item.date?.toDate ? format(item.date.toDate(), 'MMM d') : 'N/A'}</div>
                               <button 
                                 onClick={() => {
                                   if (item.parentId) {
                                     handleSelectClientById(item.parentId);
                                   }
                                 }}
                                 className="text-[10px] font-bold text-brand-primary uppercase tracking-widest flex items-center gap-1"
                               >
                                 Full Profile <ChevronRight size={12} />
                               </button>
                             </div>
                           </div>

                           {/* Interactive Action Bar */}
                           <div className="bg-slate-50 border-t border-slate-100 p-4 flex items-center justify-between sm:px-6">
                              <button 
                                onClick={() => {
                                  if (item.parentId) {
                                    handleSelectClientById(item.parentId);
                                  }
                                }}
                                className="hidden sm:flex items-center gap-2 text-xs font-bold text-brand-muted hover:text-brand-primary transition-colors uppercase tracking-widest"
                              >
                                <ChevronRight size={14} />
                                Open Patient Record
                              </button>
                              
                              <div className="flex gap-2 w-full sm:w-auto items-center">
                                <AnimatePresence mode="wait">
                                  {confirmingDeleteId === item.id ? (
                                    <motion.div 
                                      initial={{ x: 10, opacity: 0 }}
                                      animate={{ x: 0, opacity: 1 }}
                                      exit={{ x: 10, opacity: 0 }}
                                      className="flex items-center gap-1.5"
                                    >
                                      <button
                                        onClick={() => handleDeleteTreatmentRecord(item.parentId!, item.id)}
                                        className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors border border-red-100 uppercase tracking-widest"
                                      >
                                        Confirm Delete
                                      </button>
                                      <button
                                        onClick={() => setConfirmingDeleteId(null)}
                                        className="text-[10px] font-bold text-brand-muted hover:text-brand-secondary px-3 py-1.5 rounded-lg border border-slate-100 uppercase tracking-widest"
                                      >
                                        Cancel
                                      </button>
                                    </motion.div>
                                  ) : (
                                    <>
                                      <button 
                                        onClick={() => setRescheduleData({ type: 'followup', data: item })}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-brand-border rounded-lg text-xs font-bold text-brand-secondary hover:border-brand-primary/30 transition-all shadow-sm"
                                      >
                                        <RefreshCw size={14} /> Reschedule
                                      </button>
                                      <a 
                                        href={`tel:${(item.clientPhone || clientDataMap[item.parentId!]?.phone || '').replace(/\D/g, '')}`}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-brand-border rounded-lg text-xs font-bold text-brand-secondary hover:border-brand-primary/30 transition-all shadow-sm"
                                      >
                                        <Phone size={14} />
                                        Call
                                      </a>
                                      <button 
                                        onClick={() => handleCompleteFollowUp(item.parentId!, item.id)}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[#2ecc71] text-white rounded-lg text-xs font-bold hover:bg-[#27ae60] transition-all shadow-md shadow-emerald-500/10"
                                      >
                                        <CheckCircle2 size={14} />
                                        Complete
                                      </button>
                                      <button 
                                        onClick={() => setConfirmingDeleteId(item.id)}
                                        className="p-2 text-brand-muted hover:text-red-500 transition-colors"
                                        title="Delete Record"
                                      >
                                        <Trash2 size={18} />
                                      </button>
                                    </>
                                  )}
                                </AnimatePresence>
                              </div>
                           </div>
                         </motion.div>
                       ))}
                     </div>
                   ) : (
                     <div className="bg-white rounded-3xl border border-brand-border p-12 text-center shadow-sm">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100">
                           <Bell size={40} className="text-slate-200" />
                        </div>
                        <h3 className="text-lg font-bold text-brand-secondary mb-2">Clinical Pipeline Clear</h3>
                        <p className="text-brand-muted max-w-sm mx-auto text-sm leading-relaxed">
                          All patient follow-ups are up to date. New priorities will appear here based on your treatment logs.
                        </p>
                     </div>
                   )}
                </motion.div>
              ) : view === 'dashboard' ? (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <DashboardView 
                    stats={{
                      ...stats,
                      followUpsDue: stats.followUpsDue + stats.leadsDue
                    }}
                    recentTreatments={recentTreatments}
                    upcomingFollowUps={upcomingFollowUpsList}
                    upcomingInquiries={upcomingLeadsList}
                    clientDataMap={clientDataMap}
                    onNewPatient={() => setIsFormOpen(true)}
                    onViewNotifications={() => setView('notifications')}
                    onViewTreatmentsToday={() => setView('notifications')}
                    onSelectPatient={handleSelectClientById}
                    onDeleteTreatment={handleDeleteTreatmentRecord}
                    onMarkLeadVisited={handleMarkLeadVisited}
                    confirmingDeleteId={confirmingDeleteId}
                    setConfirmingDeleteId={setConfirmingDeleteId}
                  />
                </motion.div>
              ) : view === 'leads' ? (
                <motion.div
                  key="leads"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <LeadDashboard userId={user.uid} onMarkVisited={handleMarkLeadVisited} />
                </motion.div>
              ) : (
                <motion.div
                  key="clients"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25 }}
                >
                  <ClientDashboard 
                    userId={user.uid} 
                    onSelectClient={setSelectedClient} 
                    onNewClient={() => setIsFormOpen(true)}
                    onRescheduleClient={handleRescheduleClient}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Global Modal Layer */}
        {isFormOpen && user && (
          <ClientForm 
            userId={user.uid} 
            onClose={() => setIsFormOpen(false)} 
            onSaved={handleClientSaved} 
          />
        )}

        {rescheduleData && user && (
          <RescheduleModal
            isOpen={true}
            onClose={() => setRescheduleData(null)}
            type={rescheduleData.type}
            data={rescheduleData.data}
            userId={user.uid}
            onSuccess={() => {}}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      {user && (
        <nav className="fixed bottom-0 left-0 right-0 lg:hidden bg-white border-t border-brand-border flex items-center justify-around px-2 py-3 z-40 safe-area-inset-bottom">
          <button 
            onClick={() => handleNavClick('dashboard')}
            className={`flex flex-col items-center gap-1 flex-1 transition-all ${
              view === 'dashboard' ? 'text-brand-primary' : 'text-brand-muted'
            }`}
          >
            <div className={`p-1 rounded-lg ${view === 'dashboard' ? 'bg-blue-50' : ''}`}>
              <LayoutDashboard size={20} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
          </button>

          <button 
            onClick={() => handleNavClick('leads')}
            className={`flex flex-col items-center gap-1 flex-1 transition-all ${
              view === 'leads' ? 'text-emerald-600' : 'text-brand-muted'
            }`}
          >
            <div className={`p-1 rounded-lg ${view === 'leads' ? 'bg-emerald-50' : ''}`}>
              <Phone size={20} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">Inquiry</span>
          </button>
          
          <button 
            onClick={() => handleNavClick('clients')}
            className={`flex flex-col items-center gap-1 flex-1 transition-all ${
              view === 'clients' ? 'text-brand-primary' : 'text-brand-muted'
            }`}
          >
            <div className={`p-1 rounded-lg ${view === 'clients' ? 'bg-blue-50' : ''}`}>
              <Users size={20} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">Patients</span>
          </button>

          <button 
            onClick={() => handleNavClick('notifications')}
            className={`flex flex-col items-center gap-1 flex-1 relative transition-all ${
              view === 'notifications' ? 'text-brand-primary' : 'text-brand-muted'
            }`}
          >
            <div className={`p-1 rounded-lg ${view === 'notifications' ? 'bg-blue-50' : ''}`}>
              <Bell size={20} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">Alerts</span>
            {stats.followUpsDue > 0 && (
              <span className="absolute top-0 right-1/2 translate-x-4 w-2 h-2 bg-orange-500 rounded-full border-2 border-white"></span>
            )}
          </button>
        </nav>
      )}

      {/* Decorative Elements */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 z-50 overflow-hidden">
        <div className="w-full h-full opacity-30 animate-pulse bg-white/20"></div>
      </div>
    </div>
  );
}

