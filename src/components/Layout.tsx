import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Calendar, Pill, Activity, User, LogOut, MapPin } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { logout } from '../lib/firebase';
import { Logo } from './Logo';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { profile, linkedSeniorProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', icon: Home, label: 'Inicio' },
    { path: '/location', icon: MapPin, label: 'Ubicación' },
    { path: '/calendar', icon: Calendar, label: 'Calendario' },
    { path: '/medications', icon: Pill, label: 'Medicinas' },
    { path: '/vitals', icon: Activity, label: 'Salud' },
  ];

  return (
    <div className="min-h-screen bg-surface pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-outline-variant/10 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <Logo />
        </Link>

        {profile?.role === 'family' && linkedSeniorProfile?.seniorInfo && (
          <div className="hidden md:flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Paciente</span>
            <span className="font-lexend font-black text-primary">{linkedSeniorProfile.seniorInfo.name}</span>
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="px-4 py-1.5 rounded-full bg-secondary-container/30 text-secondary font-lexend font-bold text-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            {profile?.role === 'caregiver' ? 'Cuidador' : 'Familiar'}
          </div>
          <button onClick={() => navigate('/profile')} className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/20">
            <img src={profile?.photoURL || 'https://picsum.photos/seed/user/100'} alt="Profile" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
          </button>
        </div>
      </header>

      {/* Mobile Patient Name Banner */}
      {profile?.role === 'family' && linkedSeniorProfile?.seniorInfo && (
        <div className="md:hidden bg-primary/5 border-b border-primary/10 px-6 py-2 flex items-center justify-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Paciente:</span>
          <span className="font-lexend font-bold text-primary text-sm">{linkedSeniorProfile.seniorInfo.name}</span>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 pt-8">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-between items-center px-2 pb-6 pt-3 bg-white/80 backdrop-blur-xl border-t border-outline-variant/20 shadow-lg rounded-t-[1.5rem]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex-1 flex flex-col items-center justify-center py-2 transition-all active:scale-90 ${
                isActive 
                  ? 'text-primary font-bold' 
                  : 'text-outline hover:text-primary'
              }`}
            >
              <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-primary/10' : ''}`}>
                <Icon className={`w-6 h-6 ${isActive ? 'fill-primary/20' : ''}`} />
              </div>
              <span className="font-lexend text-[9px] mt-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
