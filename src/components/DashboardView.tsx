import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Users, Calendar, TrendingUp, Clock, ChevronRight, Plus, History, Stethoscope, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface DashboardViewProps {
  stats: {
    treatmentsToday: number;
    followUpsDue: number;
  };
  recentTreatments: any[];
  onNewPatient: () => void;
  onViewNotifications: () => void;
  onSelectPatient: (id: string) => void;
  onDeleteTreatment: (clientId: string, treatmentId: string) => void;
  confirmingDeleteId: string | null;
  setConfirmingDeleteId: (id: string | null) => void;
}

export default function DashboardView({ stats, recentTreatments, onNewPatient, onViewNotifications, onSelectPatient, onDeleteTreatment, confirmingDeleteId, setConfirmingDeleteId }: DashboardViewProps) {
  const today = format(new Date(), 'EEEE, MMMM do');

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
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-border shadow-sm group hover:border-brand-primary/30 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-brand-primary">
              <Activity size={20} />
            </div>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Live</span>
          </div>
          <div className="text-3xl font-bold text-brand-secondary mb-1">{stats.treatmentsToday.toString().padStart(2, '0')}</div>
          <div className="text-xs font-semibold text-brand-muted uppercase tracking-wider">Treatments Today</div>
        </div>

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

        {/* Quick Insights / Help Card */}
        <div className="space-y-6">
          <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="text-emerald-500" size={16} />
            Clinical Efficiency
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
                  View Priorities
                  <ChevronRight size={14} />
                </button>
             </div>
             {/* Decorative abstract shape */}
             <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
          </div>

          <div className="bg-white border border-brand-border rounded-2xl p-6 shadow-sm">
             <h4 className="text-xs font-bold text-brand-muted uppercase tracking-widest mb-4">Quick Tip</h4>
             <p className="text-sm text-brand-secondary leading-relaxed italic">
               "Standardize your treatment notes to include energy parameters for better longitudinal results tracking."
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
