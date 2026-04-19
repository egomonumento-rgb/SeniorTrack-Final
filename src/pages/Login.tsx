import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../lib/firebase';
import { Activity, User as UserIcon, Users, Mail, Lock, ShieldCheck, HeartPulse, HandHelping, ArrowRight, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { Logo } from '../components/Logo';

export const Login: React.FC = () => {
  const { setRole, profile } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (profile) {
      if (profile.role === 'caregiver') {
        navigate('/profile');
      } else if (profile.role === 'family') {
        if (!profile.linkedSeniorId) {
          navigate('/family-onboarding');
        } else {
          navigate('/');
        }
      }
    }
  }, [profile, navigate]);

  const [selectedRole, setSelectedRole] = useState<'caregiver' | 'family' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleGoogleLogin = async () => {
    if (!selectedRole) return;
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      if (user) {
        await setRole(selectedRole, undefined, user.displayName || '');
        navigate(selectedRole === 'caregiver' ? '/profile' : '/family-onboarding');
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      let userFriendlyMessage = "Ocurrió un error al iniciar sesión.";
      
      if (err.code === 'auth/popup-closed-by-user') {
        userFriendlyMessage = "La ventana de inicio de sesión se cerró antes de completar el proceso. Por favor, intenta de nuevo y asegúrate de completar el acceso en la ventana emergente.";
      } else if (err.code === 'auth/cancelled-popup-request') {
        userFriendlyMessage = "Solo se permite una ventana de inicio de sesión a la vez. Por favor, cierra las ventanas anteriores e intenta de nuevo.";
      } else if (err.code === 'auth/popup-blocked') {
        userFriendlyMessage = "Tu navegador bloqueó la ventana emergente de inicio de sesión. Por favor, permite las ventanas emergentes para este sitio.";
      } else if (err.code === 'auth/network-request-failed') {
        userFriendlyMessage = "Error de red. Verifica tu conexión a internet.";
      } else if (err.message) {
        userFriendlyMessage = err.message;
      }
      
      setError(userFriendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    setLoading(true);
    setError(null);
    try {
      let user;
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();
      
      if (isRegistering) {
        user = await signUpWithEmail(trimmedEmail, trimmedPassword, name.trim());
      } else {
        user = await signInWithEmail(trimmedEmail, trimmedPassword);
      }
      if (user) {
        await setRole(selectedRole, undefined, name.trim() || user.displayName || '');
        navigate(selectedRole === 'caregiver' ? '/profile' : '/family-onboarding');
      }
    } catch (err: any) {
      console.error("Email auth failed:", err);
      let userFriendlyMessage = "Error en la autenticación.";
      
      if (err.code === 'auth/invalid-credential') {
        userFriendlyMessage = isRegistering 
          ? "No se pudo crear la cuenta. Verifica que los datos sean correctos o intenta con otro correo." 
          : "Correo o contraseña incorrectos. Si te registraste con Google, intenta usar el botón de Google.";
      } else if (err.code === 'auth/email-already-in-use') {
        userFriendlyMessage = "Este correo electrónico ya está registrado. Intenta iniciar sesión en lugar de registrarte.";
      } else if (err.code === 'auth/weak-password') {
        userFriendlyMessage = "La contraseña es muy débil. Debe tener al menos 6 caracteres.";
      } else if (err.code === 'auth/invalid-email') {
        userFriendlyMessage = "El formato del correo electrónico no es válido. Ej: usuario@ejemplo.com";
      } else if (err.code === 'auth/operation-not-allowed') {
        userFriendlyMessage = "El inicio de sesión con correo y contraseña no está habilitado. Contacta al administrador.";
      } else if (err.code === 'auth/too-many-requests') {
        userFriendlyMessage = "Demasiados intentos fallidos. Tu cuenta ha sido bloqueada temporalmente. Intenta más tarde.";
      } else if (err.code === 'auth/network-request-failed') {
        userFriendlyMessage = "Error de red. No se pudo conectar con los servicios de Google/Firebase. Por favor, verifica tu conexión a internet o si tienes algún bloqueador que impida la conexión.";
      } else if (err.message) {
        userFriendlyMessage = err.message;
      }
      
      setError(userFriendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-primary/5 blur-[100px] -z-10" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full bg-secondary-container/10 blur-[100px] -z-10" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md flex flex-col space-y-12"
      >
        <header className="flex flex-col items-center space-y-6">
          <Logo className="scale-150 mb-4" />
          <p className="text-on-surface-variant font-medium text-center max-w-xs leading-relaxed">
            Conectando cuidados, familia y salud con serena precisión.
          </p>
        </header>

        <main className="space-y-10">
          <section className="space-y-6">
            <h2 className="font-lexend font-bold text-xl text-center text-on-surface">Selecciona tu Rol</h2>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => { setSelectedRole('caregiver'); setError(null); }}
                className={`group flex flex-col items-center justify-center p-6 rounded-2xl transition-all active:scale-95 duration-150 border-2 ${
                  selectedRole === 'caregiver' 
                    ? 'bg-primary/5 border-primary shadow-lg shadow-primary/5' 
                    : 'bg-surface-container-low border-transparent hover:border-primary/20'
                }`}
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${
                  selectedRole === 'caregiver' ? 'bg-secondary-container text-on-secondary-container' : 'bg-secondary-container/30 text-secondary'
                }`}>
                  <HandHelping className="w-8 h-8" />
                </div>
                <span className="font-lexend font-bold text-primary">Cuidador</span>
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">Caregiver</span>
              </button>

              <button 
                onClick={() => { setSelectedRole('family'); setError(null); }}
                className={`group flex flex-col items-center justify-center p-6 rounded-2xl transition-all active:scale-95 duration-150 border-2 ${
                  selectedRole === 'family' 
                    ? 'bg-primary/5 border-primary shadow-lg shadow-primary/5' 
                    : 'bg-surface-container-low border-transparent hover:border-primary/20'
                }`}
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${
                  selectedRole === 'family' ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-tertiary-fixed/30 text-tertiary'
                }`}>
                  <Users className="w-8 h-8" />
                </div>
                <span className="font-lexend font-bold text-primary">Familiar</span>
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">Family</span>
              </button>
            </div>
          </section>

          <div className="space-y-6">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-error-container text-on-error-container rounded-xl text-sm font-medium flex items-center gap-3 border border-error/20"
              >
                <Activity className="w-5 h-5 text-error rotate-45" />
                {error}
              </motion.div>
            )}

            {!showEmailForm ? (
              <div className="space-y-4">
                <button 
                  onClick={handleGoogleLogin}
                  disabled={!selectedRole || loading}
                  className={`w-full h-16 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-2xl font-lexend font-bold text-lg shadow-xl shadow-primary/20 active:scale-[0.98] transition-all hover:brightness-110 flex items-center justify-center gap-3 ${
                    (!selectedRole || loading) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <img src="https://www.gstatic.com/firebase/identity/google_logo.svg" alt="Google" className="w-6 h-6" />
                      Iniciar Sesión con Google
                    </>
                  )}
                </button>

                <button 
                  onClick={() => setShowEmailForm(true)}
                  disabled={!selectedRole || loading}
                  className="w-full h-14 bg-surface-container-highest text-on-surface rounded-2xl font-lexend font-bold text-sm flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                  <Mail className="w-5 h-5" />
                  Usar Correo Electrónico
                </button>
              </div>
            ) : (
              <motion.form 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                onSubmit={handleEmailAuth} 
                className="space-y-4 bg-surface-container-low p-6 rounded-3xl border border-outline-variant/30"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-lexend font-bold text-primary">
                    {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
                  </h3>
                  <button 
                    type="button"
                    onClick={() => setShowEmailForm(false)}
                    className="text-xs font-bold text-on-surface-variant hover:text-primary transition-colors"
                  >
                    Volver
                  </button>
                </div>

                {isRegistering && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-outline ml-2">Nombre</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
                      <input 
                        required
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-2xl pl-12 pr-4 py-3 font-lexend text-sm focus:ring-2 focus:ring-primary outline-none"
                        placeholder="Tu nombre"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-outline ml-2">Correo</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
                    <input 
                      required
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-2xl pl-12 pr-4 py-3 font-lexend text-sm focus:ring-2 focus:ring-primary outline-none"
                      placeholder="ejemplo@correo.com"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-outline ml-2">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
                    <input 
                      required
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-2xl pl-12 pr-4 py-3 font-lexend text-sm focus:ring-2 focus:ring-primary outline-none"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full h-14 bg-primary text-on-primary rounded-2xl font-lexend font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2 mt-4"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      {isRegistering ? 'Registrarse' : 'Entrar'}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <button 
                  type="button"
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="w-full text-xs font-bold text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center gap-2"
                >
                  {isRegistering ? (
                    <>¿Ya tienes cuenta? Inicia sesión</>
                  ) : (
                    <>¿No tienes cuenta? Regístrate <UserPlus className="w-3 h-3" /></>
                  )}
                </button>
              </motion.form>
            )}
          </div>
        </main>

        <footer className="text-center space-y-6">
          <div className="flex items-center justify-center space-x-6 text-outline-variant">
            <ShieldCheck className="w-8 h-8" />
            <HeartPulse className="w-8 h-8" />
            <HandHelping className="w-8 h-8" />
          </div>
        </footer>
      </motion.div>
    </div>
  );
};
