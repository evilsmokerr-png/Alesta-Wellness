import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Leaf, Users, LayoutDashboard, Bell, Activity, Calendar, ChevronRight, Phone, Zap, StickyNote, CheckCircle2, MapPin, Stethoscope } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from './lib/firebase';
import { collectionGroup, query, where, onSnapshot, orderBy, limit, doc, getDoc, updateDoc } from 'firebase/firestore';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, format } from 'date-fns';
import Auth from './components/Auth';
import DashboardView from './components/DashboardView';
import ClientDashboard from './components/ClientDashboard';
import ClientDetail from './components/ClientDetail';
import ClientForm from './components/ClientForm';
import { Client } from './types';

type ViewType = 'dashboard' | 'clients' | 'notifications';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [view, setView] = useState<ViewType>('dashboard');
  
  const [stats, setStats] = useState({
    treatmentsToday: 0,
    followUpsDue: 0
  });
  const [followUpList, setFollowUpList] = useState<any[]>([]);
  const [clientDataMap, setClientDataMap] = useState<Record<string, Client>>({});
  const [recentTreatments, setRecentTreatments] = useState<any[]>([]);

  useEffect(() => {
    if (!user) {
      setStats({ treatmentsToday: 0, followUpsDue: 0 });
      setFollowUpList([]);
      setRecentTreatments([]);
      return;
    }

    const todayEnd = endOfDay(new Date());
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
    });

    // 2. Follow-ups Due & Notification List
    const followUpsQuery = query(
      collectionGroup(db, 'treatments'),
      where('ownerId', '==', user.uid),
      where('followUpDate', '<=', todayEnd),
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

    return () => {
      unsubTreatments();
      unsubFollowUps();
      unsubRecent();
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
        followUpDate: null
      });
    } catch (error) {
      console.error("Error completing follow-up:", error);
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
            <div className="text-2xl font-bold text-brand-secondary">{stats.followUpsDue.toString().padStart(2, '0')}</div>
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
                       {followUpList.length} Due
                     </div>
                   </div>
                   
                   {followUpList.length > 0 ? (
                     <div className="space-y-4">
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
                             <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 py-2">
                               <div className="space-y-1">
                                 <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1">
                                   <Activity size={10} className="text-brand-primary" />
                                   Treatment
                                 </div>
                                 <div className="text-sm font-bold text-brand-secondary">{item.treatmentName}</div>
                               </div>
                               <div className="space-y-1">
                                 <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1">
                                   <Zap size={10} className="text-orange-500" />
                                   Intensity
                                 </div>
                                 <div className="text-sm font-semibold text-brand-secondary">{item.productUsage || 'Standard'}</div>
                               </div>
                               <div className="space-y-1">
                                 <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1">
                                   <Stethoscope size={10} className="text-brand-primary" />
                                   Doctor
                                 </div>
                                 <div className="text-sm font-bold text-brand-secondary truncate">{item.doctorName || '--'}</div>
                               </div>
                               <div className="space-y-1">
                                 <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1">
                                   <Calendar size={10} className="text-brand-primary" />
                                   Follow-up Date
                                 </div>
                                 <div className="text-sm font-bold text-brand-primary flex items-center gap-1">
                                   {item.followUpDate?.toDate ? format(item.followUpDate.toDate(), 'MMMM d, yyyy') : 'No date'}
                                 </div>
                               </div>
                             </div>

                             {/* Clinical Notes */}
                             {item.notes && (
                               <div className="bg-slate-50/80 rounded-xl p-4 mt-2">
                                 <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1 mb-2">
                                   <StickyNote size={10} />
                                   Clinical Notes
                                 </div>
                                 <p className="text-sm text-brand-secondary leading-relaxed italic">
                                   "{item.notes}"
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
                              
                              <div className="flex gap-2 w-full sm:w-auto">
                                <a 
                                  href={`tel:${(item.clientPhone || clientDataMap[item.parentId!]?.phone || '').replace(/\D/g, '')}`}
                                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-brand-border rounded-lg text-xs font-bold text-brand-secondary hover:border-brand-primary/30 transition-all shadow-sm"
                                >
                                  <Phone size={14} />
                                  Call
                                </a>
                                <button 
                                  onClick={() => handleCompleteFollowUp(item.parentId!, item.id)}
                                  className="flex-2 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all shadow-md shadow-brand-primary/10"
                                >
                                  <CheckCircle2 size={14} />
                                  Complete Follow-up
                                </button>
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
                    stats={stats}
                    recentTreatments={recentTreatments}
                    onNewPatient={() => setIsFormOpen(true)}
                    onViewNotifications={() => setView('notifications')}
                    onSelectPatient={handleSelectClientById}
                  />
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

