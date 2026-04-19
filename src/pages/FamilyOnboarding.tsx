import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle2, ArrowRight, ShieldCheck, Heart, LayoutDashboard, Zap } from 'lucide-react';
import { Logo } from '../components/Logo';

export const FamilyOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const [paymentCode, setPaymentCode] = useState('');

  const handleActivate = () => {
    window.open('https://checkout.wompi.co/l/test_kmF2Ni', '_blank');
  };

  const handleContinue = () => {
    navigate('/pairing');
  };

  const benefits = [
    {
      icon: <Zap className="w-5 h-5 text-primary" />,
      title: "Registro de medicamentos",
      description: "Control detallado de dosis y horarios."
    },
    {
      icon: <LayoutDashboard className="w-5 h-5 text-secondary" />,
      title: "Seguimiento diario",
      description: "Actividades y estado de salud en tiempo real."
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-tertiary" />,
      title: "Información organizada",
      description: "Todo lo que necesitas saber en un solo lugar."
    }
  ];

  return (
    <div className="min-h-screen bg-surface flex flex-col relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px] -z-10" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-secondary-container/10 blur-[120px] -z-10" />

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-6 py-12 sm:py-20">
        <header className="mb-12 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Logo className="mb-8 scale-110" />
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl sm:text-4xl font-lexend font-bold text-on-surface leading-tight mb-4"
          >
            Sabe cómo está tu familiar, <span className="text-primary">sin estar presente</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-on-surface-variant text-lg leading-relaxed mb-2"
          >
            Recibe actualizaciones en tiempo real sobre medicamentos, actividades y cuidados diarios.
          </motion.p>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-primary font-medium italic"
          >
            “Evita la incertidumbre. Ten información clara en todo momento.”
          </motion.p>
        </header>

        <motion.section 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-6 mb-12"
        >
          {benefits.map((benefit, index) => (
            <div key={index} className="flex items-start gap-4 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30">
              <div className="mt-1 p-2 rounded-xl bg-surface-container-highest">
                {benefit.icon}
              </div>
              <div>
                <h3 className="font-lexend font-bold text-on-surface">{benefit.title}</h3>
                <p className="text-sm text-on-surface-variant">{benefit.description}</p>
              </div>
            </div>
          ))}
        </motion.section>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-auto space-y-4"
        >
          <button 
            onClick={handleActivate}
            className="w-full group relative overflow-hidden bg-primary text-on-primary h-20 rounded-3xl font-lexend font-bold text-xl shadow-2xl shadow-primary/30 active:scale-[0.98] transition-all hover:brightness-110 flex items-center justify-center gap-3"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <span>Activar seguimiento – $20.000</span>
            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </button>

          <div className="space-y-2">
            <label htmlFor="paymentCode" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-2">
              Código de activación (enviado por mail)
            </label>
            <input 
              id="paymentCode"
              type="text"
              value={paymentCode}
              onChange={(e) => setPaymentCode(e.target.value)}
              placeholder="Ingresa tu código aquí"
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-2xl px-6 py-4 font-lexend text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>

          <button 
            onClick={handleContinue}
            disabled={!paymentCode.trim()}
            className={`w-full h-14 rounded-2xl font-lexend font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              paymentCode.trim() 
                ? 'bg-secondary text-on-secondary shadow-lg shadow-secondary/20 active:scale-95' 
                : 'bg-surface-container-highest text-on-surface/30 cursor-not-allowed'
            }`}
          >
            Ya realicé el pago / Continuar
          </button>
          
          <div className="text-center">
            <p className="text-sm font-medium text-on-surface-variant flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-secondary" />
              Pago único. Sin suscripciones.
            </p>
          </div>
        </motion.div>
      </div>

      <footer className="p-8 text-center">
        <div className="flex items-center justify-center gap-8 opacity-30 grayscale">
          <Heart className="w-6 h-6" />
          <ShieldCheck className="w-6 h-6" />
          <Zap className="w-6 h-6" />
        </div>
      </footer>
    </div>
  );
};
