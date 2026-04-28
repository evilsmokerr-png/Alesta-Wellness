import { useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { LogIn, LogOut, User as UserIcon, Shield, Users } from 'lucide-react';

export default function Auth({ onAuthChange, onRoleChange }: { onAuthChange: (user: User | null) => void, onRoleChange: (role: 'admin' | 'staff') => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'admin' | 'staff'>((localStorage.getItem('userRole') as any) || 'admin');

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

  if (loading) return <div className="p-4 text-slate-500">Loading...</div>;

  return (
    <div className="flex items-center gap-1.5 sm:gap-4">
      <div className="flex bg-slate-100 p-0.5 sm:p-1 rounded-full border border-slate-200">
        <button
          onClick={() => { setRole('admin'); localStorage.setItem('userRole', 'admin'); onRoleChange('admin'); }}
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
