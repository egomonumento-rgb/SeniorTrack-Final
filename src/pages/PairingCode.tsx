import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { logout } from '../lib/firebase';
import { motion } from 'motion/react';
import { Link2, CheckCircle2, LogOut, Copy, ArrowRight } from 'lucide-react';

export const PairingCode: React.FC = () => {
  const { profile, linkByCode } = useAuth();
  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Código copiado al portapapeles");
  };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      setError('Por favor ingresa un código válido de 6 dígitos');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await linkByCode(code);
      if (!result.success) {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || 'Error al vincular la cuenta');
    } finally {
      setLoading(false);
    }
  };

  if (profile?.role === 'caregiver') {
    if (profile.linkedFamilyUids && profile.linkedFamilyUids.length > 0) {
      return <Navigate to="/" />;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-4">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-surface-container-lowest w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl text-center"
        >
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-8 mx-auto">
            <Link2 className="w-8 h-8 text-primary" />
          </div>
          
          <h1 className="text-3xl font-lexend font-black text-primary mb-2">Vincular Cuenta</h1>
          <p className="text-on-surface-variant mb-8">Ingresa el código de 6 dígitos proporcionado por el familiar del paciente para comenzar.</p>

          <form onSubmit={handleLink} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-outline ml-2 text-left block">Código de Vinculación</label>
              <input 
                required
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-2xl px-4 py-4 font-lexend text-3xl text-center tracking-[0.5em] focus:ring-2 focus:ring-primary outline-none"
                placeholder="XXXXXX"
              />
            </div>

            {error && (
              <p className="text-error text-sm font-bold bg-error-container/20 p-3 rounded-xl border border-error/10">
                {error}
              </p>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-on-primary py-5 rounded-2xl font-lexend font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Vincular Ahora
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <button 
              type="button"
              onClick={() => logout()}
              className="w-full bg-surface-container-highest text-error py-4 rounded-2xl font-lexend font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <LogOut className="w-5 h-5" />
              Cerrar Sesión
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (profile?.role === 'family') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-4">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-surface-container-lowest w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl text-center"
        >
          {profile.linkedSeniorId ? (
            <div className="w-16 h-16 bg-secondary/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <CheckCircle2 className="w-8 h-8 text-secondary" />
            </div>
          ) : (
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-8 mx-auto">
              <Link2 className="w-8 h-8 text-primary" />
            </div>
          )}
          
          <h1 className="text-3xl font-lexend font-black text-primary mb-2">
            {profile.linkedSeniorId ? 'Cuenta Vinculada' : 'Código de Vinculación'}
          </h1>
          <p className="text-on-surface-variant mb-8">
            {profile.linkedSeniorId 
              ? 'Tu cuenta está vinculada. Puedes seguir usando este código para vincular a otros cuidadores si es necesario.'
              : 'Comparte este código con tu cuidador para que pueda vincular tu cuenta y permitirte ver la información.'}
          </p>

          <div className="bg-surface-container-low p-8 rounded-[2rem] border-2 border-dashed border-primary/30 mb-8 relative group">
            <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Tu Código</p>
            <p className="text-5xl font-lexend font-black text-primary tracking-[0.2em]">{profile.pairingCode}</p>
            <button 
              onClick={() => copyToClipboard(profile.pairingCode || '')}
              className="absolute top-4 right-4 p-2 bg-primary/10 text-primary rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {profile.linkedSeniorId ? (
              <button 
                onClick={() => window.location.href = '/'}
                className="w-full bg-primary text-on-primary py-4 rounded-2xl font-lexend font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
              >
                Ir al Dashboard
              </button>
            ) : (
              <p className="text-xs text-on-surface-variant font-medium italic">
                * Una vez que el cuidador ingrese este código, tu pantalla se actualizará automáticamente.
              </p>
            )}
            <button 
              onClick={() => logout()}
              className="w-full bg-surface-container-highest text-error py-4 rounded-2xl font-lexend font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <LogOut className="w-5 h-5" />
              Cerrar Sesión
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return <Navigate to="/" />;
};
