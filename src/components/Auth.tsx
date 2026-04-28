import { useState, useEffect, FormEvent } from 'react';
import { auth } from '../lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { LogIn, LogOut, User as UserIcon, Shield, Users, Lock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Auth({ onAuthChange, onRoleChange }: { onAuthChange: (user: User | null) => void, onRoleChange: (role: 'admin' | 'staff') => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'admin' | 'staff'>((localStorage.getItem('userRole') as any) || 'staff');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      onAuthChange(currentUser);
      onRoleChange(role);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [onAuthChange, onRoleChange, role]);

  const toggleRole = () => {
    const newRole = role === 'admin' ? 'staff' : 'admin';
    setRole(newRole);
    localStorage.setItem('userRole', newRole);
    onRoleChange(newRole);
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleAdminSwitch = () => {
    if (role === 'admin') return;
    setShowPasswordPrompt(true);
  };

  const confirmAdmin = (e: FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'Alesta') {
      setRole('admin');
      localStorage.setItem('userRole', 'admin');
      onRoleChange('admin');
      setShowPasswordPrompt(false);
      setPasswordInput('');
      setError('');
    } else {
      setError('Invalid password');
    }
  };

  if (loading) return <div className="p-4 text-slate-500">Loading...</div>;

  return (
    <div className="flex items-center gap-1.5 sm:gap-4">
      <AnimatePresence>
        {showPasswordPrompt && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-brand-primary">
                    <Lock size={18} />
                    <h3 className="font-bold text-brand-secondary">Admin Access</h3>
                  </div>
                  <button 
                    onClick={() => { setShowPasswordPrompt(false); setPasswordInput(''); setError(''); }}
                    className="p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-full transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
                
                <p className="text-xs text-brand-muted mb-6 leading-relaxed">
                  Switching to Admin mode reveals sensitive financial analytics and history. Please verify your credentials.
                </p>

                <form onSubmit={confirmAdmin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest block ml-1">Master Password</label>
                    <input 
                      type="password"
                      autoFocus
                      placeholder="••••••••"
                      className={`w-full px-4 py-2.5 bg-slate-50 border ${error ? 'border-red-300 ring-4 ring-red-50' : 'border-slate-200'} rounded-xl text-sm focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none text-brand-secondary`}
                      value={passwordInput}
                      onChange={(e) => { setPasswordInput(e.target.value); if(error) setError(''); }}
                    />
                    {error && <p className="text-[10px] font-bold text-red-500 ml-1 mt-1">{error}</p>}
                  </div>
                  
                  <button 
                    type="submit"
                    className="w-full py-3 bg-brand-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Unlock Admin Suite
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex bg-slate-100 p-0.5 sm:p-1 rounded-full border border-slate-200">
        <button
          onClick={handleAdminSwitch}
          className={`flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
            role === 'admin' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'
          }`}
          title="Admin Mode"
        >
          <Shield size={12} />
          <span className="hidden sm:inline">Admin</span>
        </button>
        <button
          onClick={() => { setRole('staff'); localStorage.setItem('userRole', 'staff'); onRoleChange('staff'); }}
          className={`flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
            role === 'staff' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
          }`}
          title="Staff Mode"
        >
          <Users size={12} />
          <span className="hidden sm:inline">Staff</span>
        </button>
      </div>

      {user ? (
        <div className="flex items-center gap-3 bg-white/50 backdrop-blur-sm p-1 pr-4 rounded-full border border-slate-200">
          <img 
            src={user.photoURL || ''} 
            alt={user.displayName || ''} 
            className="w-8 h-8 rounded-full border border-slate-100"
            referrerPolicy="no-referrer"
          />
          <span className="text-sm font-medium text-slate-700 hidden sm:inline">{user.displayName}</span>
          <button 
            onClick={handleLogout}
            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      ) : (
        <button
          onClick={handleLogin}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-all font-medium text-sm shadow-sm"
        >
          <LogIn size={16} />
          Sign In
        </button>
      )}
    </div>
  );
}
