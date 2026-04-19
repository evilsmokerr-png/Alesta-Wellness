import { useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { LogIn, LogOut, User as UserIcon } from 'lucide-react';

export default function Auth({ onAuthChange }: { onAuthChange: (user: User | null) => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      onAuthChange(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [onAuthChange]);

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
    <div className="flex items-center gap-4">
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
