import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Leaf, Users, LayoutDashboard, Bell, Activity, Calendar, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from './lib/firebase';
import { collectionGroup, query, where, onSnapshot, orderBy, limit, doc, getDoc } from 'firebase/firestore';
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
  const [recentTreatments, setRecentTreatments] = useState<any[]>([]);

  const handleSelectClientById = async (clientId: string) => {
    try {
      const docRef = doc(db, 'clients', clientId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSelectedClient({ id: docSnap.id, ...docSnap.data() } as Client);
      }
    } catch (error) {
      console.error("Error fetching client for navigation:", error);
    }
  };

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
      setFollowUpList(snapshot.docs.map(doc => ({ 
        id: doc.id, 
        parentId: doc.ref.parent.parent?.id,
        ...doc.data() 
      })));
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

  return (
    <div className="min-h-screen font-sans flex">
      {/* Sidebar - Professional Polish Style */}
      <aside className="fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-brand-border hidden lg:flex flex-col p-6 z-40">
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
      <main className="lg:pl-60 flex-1 min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-brand-border px-8 py-4 flex items-center justify-between shadow-sm shadow-slate-200/20">
          <div className="flex items-center gap-3 lg:hidden">
             <div className="w-8 h-8 bg-brand-primary rounded-lg flex items-center justify-center text-white shadow-md shadow-brand-primary/20">
              <Leaf size={18} />
            </div>
            <h1 className="font-bold text-brand-secondary tracking-tight">Alesta Wellness</h1>
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
        <div className="flex-1 p-8">
          {!user ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-20 flex flex-col items-center text-center max-w-2xl mx-auto"
            >
              <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center text-brand-primary mb-8 border border-blue-100">
                <Leaf size={40} />
              </div>
              <h2 className="text-5xl font-extrabold text-brand-secondary mb-6 tracking-tight">Elite Patient Management.</h2>
              <p className="text-brand-muted text-lg mb-10 leading-relaxed font-medium">
                Our precision-built dashboard empowers professionals to track clinical records with absolute clarity and control.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                <div className="flex-1 bg-white border border-brand-border p-6 rounded-xl text-left shadow-sm">
                    <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded flex items-center justify-center mb-3">
                      <LayoutDashboard size={16} />
                    </div>
                    <h3 className="font-bold text-brand-secondary mb-2">Clinical Oversight</h3>
                    <p className="text-xs text-brand-muted leading-relaxed">Secure, searchable database for treatment protocols and outcomes.</p>
                </div>
                <div className="flex-1 bg-white border border-brand-border p-6 rounded-xl text-left shadow-sm">
                    <div className="w-8 h-8 bg-green-50 text-green-600 rounded flex items-center justify-center mb-3">
                      <Activity size={16} />
                    </div>
                    <h3 className="font-bold text-brand-secondary mb-2">Outcome Tracking</h3>
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
                   className="max-w-4xl mx-auto"
                >
                   <div className="bg-white rounded-2xl border border-brand-border overflow-hidden shadow-sm">
                      <div className="p-6 border-b border-brand-border bg-slate-50/50 flex items-center justify-between">
                         <h3 className="font-bold text-brand-secondary uppercase tracking-tight flex items-center gap-2">
                            <Bell size={18} className="text-brand-primary" />
                            Pending Follow-ups
                         </h3>
                         <span className="bg-brand-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{followUpList.length}</span>
                      </div>
                      
                      {followUpList.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                          {followUpList.map((item) => (
                            <div key={item.id} className="p-6 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-brand-primary border border-blue-100">
                                  <Calendar size={20} />
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-brand-secondary">{item.treatmentName}</div>
                                  <div className="text-xs text-brand-muted flex items-center gap-2 mt-1">
                                    <span className="mono font-bold text-brand-primary bg-blue-50 px-1.5 py-0.5 rounded">
                                      {item.followUpDate?.toDate ? format(item.followUpDate.toDate(), 'MMM d, yyyy') : 'Invalid Date'}
                                    </span>
                                    <span>•</span>
                                    <span>Follow-up scheduled</span>
                                  </div>
                                </div>
                              </div>
                              <button 
                                onClick={() => {
                                  // In a real app, logic to navigate to patient detail
                                  setView('clients');
                                }}
                                className="p-2 rounded-lg bg-slate-100 text-brand-muted opacity-0 group-hover:opacity-100 transition-all hover:bg-brand-primary hover:text-white"
                              >
                                <ChevronRight size={18} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-12 text-center text-brand-muted">
                           <Bell size={48} className="mx-auto mb-4 opacity-20" />
                           <p className="font-medium">All follow-ups are up to date.</p>
                           <p className="text-sm">Patient callbacks will appear here based on treatment logs.</p>
                        </div>
                      )}
                   </div>
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

      {/* Decorative Elements */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 z-50 overflow-hidden">
        <div className="w-full h-full opacity-30 animate-pulse bg-white/20"></div>
      </div>
    </div>
  );
}

