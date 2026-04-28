import React, { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, X, AlertTriangle } from 'lucide-react';

interface PasswordVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
}

export default function PasswordVerificationModal({ isOpen, onClose, onConfirm, title, description }: PasswordVerificationModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (password === 'Alesta') {
      onConfirm();
      setPassword('');
      setError('');
    } else {
      setError('Invalid master password');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4"
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-red-100"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-red-500">
                  <Lock size={20} />
                  <h3 className="font-bold text-brand-secondary">{title}</h3>
                </div>
                <button 
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="bg-red-50 p-4 rounded-2xl mb-6 flex gap-3">
                 <AlertTriangle className="text-red-500 shrink-0" size={18} />
                 <p className="text-[11px] text-red-700 font-bold leading-relaxed uppercase tracking-tight">
                   {description}
                 </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest block ml-1">Master Password Required</label>
                  <input 
                    type="password"
                    autoFocus
                    placeholder="Enter password to confirm"
                    className={`w-full px-4 py-3 bg-slate-50 border ${error ? 'border-red-400 ring-4 ring-red-50' : 'border-slate-200'} rounded-2xl text-sm font-black tracking-widest focus:ring-4 focus:ring-red-100 focus:border-red-400 transition-all outline-none text-brand-secondary`}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if(error) setError(''); }}
                  />
                  {error && <p className="text-[10px] font-bold text-red-500 ml-1 mt-1">{error}</p>}
                </div>
                
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 bg-slate-100 text-brand-secondary rounded-2xl text-xs font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-3 bg-red-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-red-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Confirm Permanent Delete
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
