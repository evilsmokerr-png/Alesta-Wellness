import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Users, Calendar, TrendingUp, Clock, ChevronRight, ChevronDown, Plus, History, Stethoscope, Trash2, Tag, MessageSquare, CheckCircle2, IndianRupee, Wallet, Phone, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { Client } from '../types';

interface DashboardViewProps {
  stats: {
    treatmentsToday: number;
    followUpsDue: number;
    todaySales: number;
    monthSales: number;
    totalDues: number;
  };
  userRole?: 'admin' | 'staff';
  recentTreatments: any[];
  dueTreatments: any[];
  upcomingFollowUps: any[];
  upcomingInquiries: any[];
  pendingPayments: any[];
  treatmentsToday: any[];
  clientDataMap: Record<string, Client>;
  onNewPatient: () => void;
  onViewNotifications: () => void;
  onViewTreatmentsToday: () => void;
  onViewMonthSales: () => void;
  onSelectPatient: (id: string) => void;
  onFinalizePayment: (treatment: any) => void;
  onDeleteTreatment: (clientId: string, treatmentId: string) => void;
  onMarkLeadVisited: (leadId: string) => void;
  confirmingDeleteId: string | null;
  setConfirmingDeleteId: (id: string | null) => void;
}

export default function DashboardView({ 
  stats, 
  userRole = 'admin',
  recentTreatments, 
  dueTreatments,
  upcomingFollowUps,
  upcomingInquiries,
  pendingPayments,
  treatmentsToday,
  clientDataMap,
  onNewPatient, 
  onViewNotifications, 
  onViewTreatmentsToday,
  onViewMonthSales,
  onSelectPatient, 
  onFinalizePayment,
  onDeleteTreatment, 
  onMarkLeadVisited,
  confirmingDeleteId, 
  setConfirmingDeleteId 
}: DashboardViewProps) {
  const today = format(new Date(), 'EEEE, MMMM do');
  const [showUpcomingInquiries, setShowUpcomingInquiries] = useState(false);
  const [showUpcomingFollowUps, setShowUpcomingFollowUps] = useState(false);
  const [showOutstandingDues, setShowOutstandingDues] = useState(false);
  const [adminTab, setAdminTab] = useState<'pending' | 'staff' | 'calling'>('pending');

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-brand-secondary tracking-tight">Clinical Overview</h2>
          <p className="text-brand-muted text-xs sm:text-sm mt-1">{today}</p>
        </div>
        <div className="w-full sm:w-auto">
           <button 
             onClick={onNewPatient}
             className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-brand-primary rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors border border-blue-100/50 shadow-sm"
           >
             <Plus size={18} />
             New Patient
           </button>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <button 
          onClick={onViewTreatmentsToday}
          className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-border shadow-sm group hover:border-brand-primary/30 transition-all text-left outline-none"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-brand-primary group-hover:bg-blue-100 transition-colors">
              <Activity size={20} />
            </div>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Live</span>
          </div>
          <div className="text-3xl font-bold text-brand-secondary mb-1">{stats.treatmentsToday.toString().padStart(2, '0')}</div>
          <div className="text-xs font-semibold text-brand-muted uppercase tracking-wider group-hover:text-brand-primary transition-colors">Treatments Today</div>
        </button>

        <button 
          onClick={onViewNotifications}
          className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-border shadow-sm group hover:border-brand-primary/30 transition-all text-left"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 group-hover:bg-orange-100 transition-colors">
              <Clock size={20} />
            </div>
            {stats.followUpsDue > 0 && (
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
            )}
          </div>
          <div className="text-3xl font-bold text-brand-secondary mb-1">{stats.followUpsDue.toString().padStart(2, '0')}</div>
          <div className="text-xs font-semibold text-brand-muted uppercase tracking-wider group-hover:text-brand-primary transition-colors">Pending Follow-ups</div>
        </button>
      </div>

      {/* Admin Operations Center */}
      {userRole === 'admin' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-brand-border shadow-sm overflow-hidden"
        >
          <div className="bg-slate-50 border-b border-brand-border p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-widest flex items-center gap-2">
                <Zap size={16} className="text-brand-primary" />
                Operations Control Center
              </h3>
              <p className="text-[10px] text-brand-muted font-bold uppercase tracking-widest mt-1">Review activity & finalize billing</p>
            </div>
            <div className="flex bg-white p-1 rounded-xl border border-brand-border shadow-sm">
              {[
                { id: 'pending', label: 'Pending Billing', count: pendingPayments.length },
                { id: 'staff', label: 'Staff Inputs', count: treatmentsToday.filter(t => t.addedByRole === 'staff').length },
                { id: 'calling', label: 'Calling updates', count: upcomingInquiries.length + upcomingFollowUps.length }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setAdminTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 ${
                    adminTab === tab.id 
                      ? 'bg-blue-50 text-brand-primary shadow-sm' 
                      : 'text-brand-muted hover:text-brand-secondary'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[8px] ${adminTab === tab.id ? 'bg-brand-primary text-white' : 'bg-slate-100 text-brand-muted'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <AnimatePresence mode="wait">
              {adminTab === 'pending' && (
                <motion.div 
                  key="pending"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-3"
                >
                  {pendingPayments.length > 0 ? (
                    pendingPayments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between bg-orange-50/30 p-3 rounded-2xl border border-orange-100 group">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-10 h-10 rounded-xl bg-orange-50 flex-shrink-0 flex items-center justify-center text-orange-600 border border-orange-100">
                             <IndianRupee size={18} />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold text-brand-secondary truncate">
                              {p.clientName || clientDataMap[p.parentId!]?.name || 'Patient'} - {p.treatmentName}
                            </div>
                            <div className="text-[10px] text-brand-muted font-medium mt-0.5">
                              Added by Staff • {format(p.date?.toDate ? p.date.toDate() : new Date(p.date), 'MMM d, h:mm a')}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => onFinalizePayment(p)}
                          className="px-4 py-1.5 bg-brand-primary text-white rounded-lg text-[10px] font-bold shadow-lg shadow-brand-primary/20 hover:scale-105 transition-all whitespace-nowrap"
                        >
                          Add Payment Info
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-[11px] font-bold text-brand-muted uppercase tracking-widest">No pending billing entries</p>
                    </div>
                  )}
                </motion.div>
              )}

              {adminTab === 'staff' && (
                <motion.div 
                  key="staff"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-3"
                >
                  {treatmentsToday.filter(t => t.addedByRole === 'staff').length > 0 ? (
                    treatmentsToday.filter(t => t.addedByRole === 'staff').map((t) => (
                      <div key={t.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-brand-border hover:border-brand-primary/20 transition-all cursor-pointer" onClick={() => t.parentId && onSelectPatient(t.parentId)}>
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-10 h-10 rounded-xl bg-white flex-shrink-0 flex items-center justify-center text-brand-muted border border-brand-border">
                             <Users size={18} />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold text-brand-secondary truncate">
                              {t.clientName || clientDataMap[t.parentId!]?.name || 'Patient'}
                            </div>
                            <div className="text-[10px] text-brand-muted font-medium mt-0.5">
                              {t.treatmentName} • {format(t.date?.toDate ? t.date.toDate() : new Date(t.date), 'h:mm a')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           {t.paymentPending ? (
                             <span className="text-[8px] font-black bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full uppercase">Pending Billing</span>
                           ) : (
                             <span className="text-[8px] font-black bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full uppercase">Finalized</span>
                           )}
                           <ChevronRight size={14} className="text-brand-muted" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-[11px] font-bold text-brand-muted uppercase tracking-widest">No staff activity today yet</p>
                    </div>
                  )}
                </motion.div>
              )}

              {adminTab === 'calling' && (
                <motion.div 
                  key="calling"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-emerald-600 uppercase tracking-widest ml-1">Planned Inquiries</label>
                      <div className="space-y-2">
                        {upcomingInquiries.length > 0 ? (
                          upcomingInquiries.slice(0, 5).map(lead => (
                            <div key={lead.id} className="bg-white p-2.5 rounded-xl border border-brand-border flex items-center justify-between">
                               <div className="min-w-0">
                                 <div className="text-[10px] font-bold text-brand-secondary truncate">{lead.name}</div>
                                 <div className="text-[9px] text-brand-muted mt-0.5 flex items-center gap-1">
                                    <Clock size={8} /> {format(lead.appointmentDate?.toDate ? lead.appointmentDate.toDate() : new Date(lead.appointmentDate), 'MMM d')}
                                 </div>
                               </div>
                               <a href={`tel:${lead.phone}`} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                                 <Phone size={12} />
                               </a>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-[10px] text-brand-muted italic text-center">No inquires to call</div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-brand-primary uppercase tracking-widest ml-1">Scheduled Follow-ups</label>
                      <div className="space-y-2">
                        {upcomingFollowUps.length > 0 ? (
                          upcomingFollowUps.slice(0, 5).map(item => (
                            <div key={item.id} className="bg-white p-2.5 rounded-xl border border-brand-border flex items-center justify-between">
                               <div className="min-w-0">
                                 <div className="text-[10px] font-bold text-brand-secondary truncate">{item.clientName || clientDataMap[item.parentId!]?.name}</div>
                                 <div className="text-[9px] text-brand-muted mt-0.5 flex items-center gap-1">
                                    <Clock size={8} /> {format(item.followUpDate?.toDate ? item.followUpDate.toDate() : new Date(item.followUpDate), 'MMM d')}
                                 </div>
                               </div>
                               <button onClick={() => item.parentId && onSelectPatient(item.parentId)} className="p-1.5 bg-blue-50 text-brand-primary rounded-lg border border-blue-100">
                                 <History size={12} />
                               </button>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-[10px] text-brand-muted italic text-center">No follow-ups to call</div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Sales Metrics Grid */}
      {userRole === 'admin' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-6 sm:mt-8">
          <button 
            onClick={onViewTreatmentsToday}
            className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-border shadow-sm group hover:border-emerald-500/30 transition-all text-left outline-none"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                <IndianRupee size={20} />
              </div>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider text-center">Gross Sales Today</span>
            </div>
            <div className="text-3xl font-black text-brand-secondary mb-1 font-mono group-hover:text-emerald-600 transition-colors">₹{(stats.todaySales || 0).toLocaleString()}</div>
            <div className="text-xs font-semibold text-brand-muted uppercase tracking-wider">Total (Received + Due) Today</div>
          </button>

          <button 
            onClick={onViewMonthSales}
            className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-border shadow-sm group hover:border-brand-primary/30 transition-all text-left overflow-hidden relative outline-none"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full -mr-16 -mt-16 pointer-events-none" />
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-brand-primary">
                <TrendingUp size={20} />
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1 text-[10px] font-bold text-brand-primary bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  <Wallet size={10} />
                  Monthly Sales
                </div>
                <div className="mt-1 text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Outstanding: ₹{(stats.totalDues || 0).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="text-3xl font-black text-brand-secondary mb-1 font-mono group-hover:text-brand-primary transition-colors">₹{(stats.monthSales || 0).toLocaleString()}</div>
            <div className="text-xs font-semibold text-brand-muted uppercase tracking-wider text-wrap">Expected Revenue ({format(new Date(), 'MMMM')})</div>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Recent Activity Timeline */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs sm:text-sm font-bold text-brand-secondary uppercase tracking-wider flex items-center gap-2">
              <History className="text-brand-primary" size={16} />
              Recent Activity
            </h3>
            <span className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">Recent 10</span>
          </div>

          <div className="bg-white rounded-2xl border border-brand-border overflow-hidden shadow-sm">
            {recentTreatments.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {recentTreatments.map((treatment, idx) => (
                  <motion.div 
                    key={treatment.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => treatment.parentId && onSelectPatient(treatment.parentId)}
                    className="p-4 sm:p-5 hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-50 flex-shrink-0 flex items-center justify-center text-brand-muted border border-slate-100 group-hover:border-brand-primary/20 group-hover:text-brand-primary transition-colors">
                        <Calendar size={16} className="sm:hidden" />
                        <Calendar size={18} className="hidden sm:block" />
                      </div>
                      <div className="truncate">
                        <div className="text-sm font-bold text-brand-secondary truncate">{treatment.treatmentName}</div>
                        <div className="text-[10px] sm:text-[11px] text-brand-muted mt-0.5 flex items-center gap-2">
                          {format(treatment.date?.toDate ? treatment.date.toDate() : new Date(treatment.date), 'MMM d, h:mm a')}
                          {treatment.doctorName && (
                            <>
                              <span className="text-slate-300">•</span>
                              <div className="flex items-center gap-1">
                                <Stethoscope size={10} className="text-brand-primary" />
                                <span className="font-medium">{treatment.doctorName}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                      <AnimatePresence mode="wait">
                        {confirmingDeleteId === treatment.id ? (
                          <motion.div 
                            initial={{ x: 10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 10, opacity: 0 }}
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                if (treatment.parentId) {
                                  onDeleteTreatment(treatment.parentId, treatment.id);
                                }
                              }}
                              className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors border border-red-100"
                            >
                              Del
                            </button>
                            <button
                              onClick={() => setConfirmingDeleteId(null)}
                              className="text-[10px] font-bold text-brand-muted hover:text-brand-secondary px-2 py-1"
                            >
                              No
                            </button>
                          </motion.div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmingDeleteId(treatment.id);
                            }}
                            className="p-2 text-brand-muted hover:text-red-500 transition-colors"
                            title="Delete Log"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="p-10 sm:p-12 text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                   <Activity size={28} className="text-slate-200" />
                </div>
                <p className="text-sm font-medium text-brand-muted">No recent activity detected.</p>
                <p className="text-[11px] text-brand-muted mt-1">New treatments will appear here.</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Agenda Panel */}
        <div className="space-y-6 sm:space-y-8">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-brand-secondary uppercase tracking-wider flex items-center gap-2 mb-4">
              <Calendar className="text-brand-primary" size={16} />
              Upcoming Agenda
            </h3>
            
            <div className="space-y-6">
              {/* Category: Inquiries */}
              <div className="space-y-3">
                <button 
                  onClick={() => setShowUpcomingInquiries(!showUpcomingInquiries)}
                  className="w-full flex items-center justify-between px-1 group"
                >
                  <div className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 group-hover:text-emerald-500 transition-colors">
                    <span className="w-1 h-1 bg-emerald-500 rounded-full"></span>
                    Planned Inquiries
                    {showUpcomingInquiries ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </div>
                  {upcomingInquiries.length > 0 && (
                    <span className="text-[10px] font-bold text-brand-muted">{upcomingInquiries.length} Total Future</span>
                  )}
                </button>
                
                <AnimatePresence>
                  {showUpcomingInquiries && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      {upcomingInquiries.length > 0 ? (
                        upcomingInquiries.slice(0, 4).map((lead) => (
                          <div key={lead.id} className="bg-white p-3.5 rounded-xl border border-brand-border shadow-sm flex items-start justify-between group hover:border-brand-primary/20 transition-all">
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-2">
                                <div className="text-xs font-bold text-brand-secondary truncate">{lead.name}</div>
                                <span className="text-[8px] font-black bg-slate-100 text-brand-muted px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                  {lead.status.replace('_', ' ')}
                                </span>
                              </div>
                              <div className="text-[10px] text-brand-muted mt-1 font-medium italic truncate">
                                {lead.concern || 'General Wellness Enquiry'}
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <div className="text-[9px] font-bold text-brand-primary flex items-center gap-1 bg-blue-50/50 px-1.5 py-0.5 rounded">
                                  <Calendar size={10} />
                                  {format(lead.appointmentDate?.toDate ? lead.appointmentDate.toDate() : new Date(lead.appointmentDate), 'MMM d, h:mm a')}
                                </div>
                                <div className="text-[9px] font-bold text-brand-muted flex items-center gap-1">
                                  <Tag size={10} className="opacity-50" />
                                  {lead.source || 'Direct'}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); onMarkLeadVisited(lead.id!); }}
                                className="p-1 px-2.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-all flex items-center gap-1.5"
                                title="Mark as Visited"
                              >
                                <CheckCircle2 size={12} />
                                <span className="text-[10px] font-bold uppercase tracking-tighter hidden sm:inline">Visit</span>
                              </button>
                              <ChevronRight size={12} className="text-slate-300 cursor-pointer group-hover:text-brand-primary transition-colors" />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-[11px] text-brand-muted italic px-1">No upcoming inquiries scheduled.</div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Category: Treatments */}
              <div className="space-y-3">
                <button 
                   onClick={() => setShowUpcomingFollowUps(!showUpcomingFollowUps)}
                   className="w-full flex items-center justify-between px-1 group"
                >
                  <div className="text-[10px] font-extrabold text-brand-primary uppercase tracking-widest flex items-center gap-1.5 group-hover:text-blue-500 transition-colors">
                    <span className="w-1 h-1 bg-brand-primary rounded-full"></span>
                    Scheduled Follow-ups
                    {showUpcomingFollowUps ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </div>
                  {upcomingFollowUps.length > 0 && (
                    <span className="text-[10px] font-bold text-brand-muted">{upcomingFollowUps.length} Total Future</span>
                  )}
                </button>
                
                <AnimatePresence>
                  {showUpcomingFollowUps && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      {upcomingFollowUps.length > 0 ? (
                        upcomingFollowUps.slice(0, 4).map((item) => (
                          <div 
                            key={item.id} 
                            onClick={() => item.parentId && onSelectPatient(item.parentId)}
                            className="bg-white p-3.5 rounded-xl border border-brand-border shadow-sm flex items-start justify-between group cursor-pointer hover:border-brand-primary/20 transition-all"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="text-xs font-bold text-brand-secondary truncate">
                                {item.clientName || clientDataMap[item.parentId!]?.name || 'Patient'}
                              </div>
                              <div className="text-[10px] text-brand-muted mt-1 font-medium truncate flex items-center gap-1">
                                <Activity size={10} className="text-brand-primary opacity-50" />
                                {item.treatmentName} 
                                <span className="text-slate-300 mx-1">•</span>
                                <span className="italic">{clientDataMap[item.parentId!]?.concern || 'Routine Review'}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <div className="text-[9px] font-bold text-brand-primary flex items-center gap-1 bg-blue-50/50 px-1.5 py-0.5 rounded">
                                  <Calendar size={10} />
                                  {format(item.followUpDate?.toDate ? item.followUpDate.toDate() : new Date(item.followUpDate), 'MMMM d')}
                                </div>
                                <div className="text-[9px] font-bold text-brand-muted flex items-center gap-1">
                                  <Tag size={10} className="opacity-50" />
                                  {clientDataMap[item.parentId!]?.source || 'Direct'}
                                </div>
                              </div>
                            </div>
                            <ChevronRight size={12} className="text-slate-300 mt-1 cursor-pointer group-hover:text-brand-primary transition-colors" />
                          </div>
                        ))
                      ) : (
                        <div className="text-[11px] text-brand-muted italic px-1">No upcoming clinical follow-ups.</div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Category: Outstanding Dues */}
              <div className="space-y-3">
                <button 
                  onClick={() => setShowOutstandingDues(!showOutstandingDues)}
                  className="w-full flex items-center justify-between px-1 group"
                >
                  <div className="text-[10px] font-extrabold text-red-500 uppercase tracking-widest flex items-center gap-1.5 group-hover:text-red-400 transition-colors">
                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                    Outstanding Dues
                    {showOutstandingDues ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </div>
                  {dueTreatments.length > 0 && (
                    <span className="text-[10px] font-bold text-brand-muted">{dueTreatments.length} Pending</span>
                  )}
                </button>
                
                <AnimatePresence>
                  {showOutstandingDues && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      {dueTreatments.length > 0 ? (
                        dueTreatments.slice(0, 4).map((item) => (
                          <div 
                            key={item.id} 
                            onClick={() => item.parentId && onSelectPatient(item.parentId)}
                            className="bg-white p-3.5 rounded-xl border border-red-100 shadow-sm flex items-start justify-between group cursor-pointer hover:border-red-400/20 transition-all border-l-4 border-l-red-400"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-2">
                                <div className="text-xs font-bold text-brand-secondary truncate">
                                  {item.clientName || clientDataMap[item.parentId!]?.name || 'Patient'}
                                </div>
                                <span className="text-[9px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                  ₹{item.balanceAmount} Due
                                </span>
                              </div>
                              <div className="text-[10px] text-brand-muted mt-1 font-medium truncate flex items-center gap-1">
                                <Activity size={10} className="text-red-400 opacity-50" />
                                {item.treatmentName}
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <div className="text-[9px] font-bold text-brand-muted flex items-center gap-1">
                                  <Phone size={10} className="opacity-50" />
                                  {item.clientPhone || clientDataMap[item.parentId!]?.phone || 'No Phone'}
                                </div>
                              </div>
                            </div>
                            <ChevronRight size={12} className="text-red-200 mt-1 cursor-pointer group-hover:text-red-500 transition-colors" />
                          </div>
                        ))
                      ) : (
                        <div className="text-[11px] text-brand-muted italic px-1">No outstanding dues recorded.</div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Clinical Efficiency Panel */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="text-emerald-500" size={16} />
              Insights
            </h3>
            <div className="bg-gradient-to-br from-brand-primary to-blue-700 rounded-2xl p-6 text-white shadow-lg shadow-brand-primary/20 relative overflow-hidden group">
               <div className="relative z-10">
                  <h4 className="font-bold text-lg mb-2">Patient Growth</h4>
                  <p className="text-blue-100 text-sm leading-relaxed mb-6">
                    Maintain high patient retention by responding to follow-up notifications within 24 hours.
                  </p>
                  <button 
                    onClick={onViewNotifications}
                    className="w-full py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 border border-white/10"
                  >
                    View Agenda
                    <ChevronRight size={14} />
                  </button>
               </div>
               <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
