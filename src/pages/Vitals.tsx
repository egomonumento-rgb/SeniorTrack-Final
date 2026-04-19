import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { collection, query, onSnapshot, orderBy, limit, doc, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { VitalSign, VitalType } from '../types';
import { checkVitalAlert } from '../lib/vitalsHelper';
import { Activity, Heart, Thermometer, Weight, Droplets, Wind, Plus, CheckCircle2, Clock, Moon, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

export const Vitals: React.FC = () => {
  const { user, profile, linkedSeniorProfile } = useAuth();
  const [vitals, setVitals] = useState<VitalSign[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newVital, setNewVital] = useState({ type: 'bp' as VitalType, value: '', unit: '', date: '', time: '' });

  const seniorName = (profile?.role === 'family' ? linkedSeniorProfile?.seniorInfo?.name : profile?.seniorInfo?.name) || 'Paciente';

  useEffect(() => {
    if (!user || !profile) return;

    const seniorId = profile.role === 'family' && profile.linkedSeniorId ? profile.linkedSeniorId : user.uid;

    const vitalsQuery = query(collection(db, `users/${seniorId}/vitals`), orderBy('timestamp', 'desc'), limit(20));
    const unsubVitals = onSnapshot(vitalsQuery, (snap) => {
      setVitals(snap.docs.map(d => ({ id: d.id, ...d.data() } as VitalSign)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${seniorId}/vitals`);
    });

    return () => {
      unsubVitals();
    };
  }, [user, profile]);

  const handleAddVital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || profile.role === 'family') return;

    try {
      const alertStatus = checkVitalAlert(newVital.type, newVital.value);
      const timestamp = newVital.date && newVital.time 
        ? Timestamp.fromDate(new Date(`${newVital.date}T${newVital.time}`))
        : serverTimestamp();

      await addDoc(collection(db, `users/${user.uid}/vitals`), {
        type: newVital.type,
        value: newVital.value,
        unit: newVital.unit,
        timestamp: timestamp,
        isAlert: alertStatus.isAlert,
        alertMessage: alertStatus.message
      });
      setIsAdding(false);
      setNewVital({ type: 'bp', value: '', unit: '', date: '', time: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/vitals`);
    }
  };

  const chartData = vitals.length > 0 
    ? vitals.filter(v => v.type === 'bp').map(v => ({ 
        id: v.id,
        name: new Date(v.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
        value: parseInt(v.value.split('/')[0]) 
      })).reverse()
    : [
        { id: '1', name: '8 AM', value: 110 },
        { id: '2', name: '12 PM', value: 118 },
        { id: '3', name: '4 PM', value: 115 },
        { id: '4', name: '8 PM', value: 122 },
        { id: '5', name: 'AHORA', value: 118 },
      ];

  return (
    <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-lexend font-black text-primary tracking-tighter">Signos Vitales</h1>
          <p className="text-on-surface-variant font-medium">Monitoreo de salud de {seniorName}</p>
        </div>
        <div className="bg-secondary-container/30 text-secondary p-3 rounded-2xl">
          <Activity className="w-6 h-6" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8 bg-surface-container-low rounded-[2rem] p-5 md:p-8 flex flex-col justify-between min-h-[280px] md:min-h-[350px] relative overflow-hidden group border border-outline-variant/10 shadow-sm">
          <div className="flex justify-between items-start mb-2 md:mb-8 relative z-10">
            <div>
              <div className="flex items-center gap-2 text-primary mb-1 md:mb-2">
                <Activity className="w-4 h-4 md:w-5 md:h-5" />
                <span className="font-lexend font-bold text-[9px] md:text-xs uppercase tracking-widest">Presión Arterial</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-lexend font-black text-4xl md:text-6xl tracking-tighter">118/75</span>
                <span className="text-on-surface-variant font-medium text-xs md:text-lg">mmHg</span>
              </div>
            </div>
            <div className="bg-secondary-container text-on-secondary-container px-3 py-1 md:px-4 md:py-1.5 rounded-full text-[9px] md:text-xs font-black uppercase tracking-widest shadow-sm">
              Normal
            </div>
          </div>
          
          <div className="h-28 md:h-40 w-full mt-auto relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2f50a3" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#2f50a3" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke="#2f50a3" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                  itemStyle={{ fontWeight: 'bold', color: '#2f50a3' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between text-[10px] text-on-surface-variant mt-4 font-bold uppercase tracking-widest px-2 relative z-10">
            {chartData.map((d, idx) => <span key={d.id || `chart-${idx}`}>{d.name}</span>)}
          </div>
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
        </div>

        <div className="md:col-span-4 bg-tertiary-container text-on-tertiary-container rounded-[2rem] p-6 md:p-8 flex flex-col justify-between relative overflow-hidden group shadow-lg">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-on-tertiary mb-4 md:mb-8">
              <Heart className="w-6 h-6 fill-current" />
              <span className="font-lexend font-bold text-[10px] md:text-xs uppercase tracking-widest opacity-80">Pulso</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-lexend font-black text-6xl md:text-7xl tracking-tighter">72</span>
              <span className="font-medium text-lg md:text-xl opacity-60">LPM</span>
            </div>
          </div>
          <div className="mt-8 md:mt-12 relative z-10">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">
              <span>Mín: 64</span>
              <span>Máx: 88</span>
            </div>
            <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '70%' }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-white rounded-full" 
              />
            </div>
          </div>
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000" />
        </div>

        <div className="md:col-span-4 bg-surface-container-highest rounded-[2rem] p-6 md:p-8 flex flex-col justify-between border border-outline-variant/10 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-secondary mb-4 md:mb-6">
              <Wind className="w-6 h-6" />
              <span className="font-lexend font-bold text-[10px] md:text-xs uppercase tracking-widest">Oxígeno</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-lexend font-black text-5xl md:text-6xl tracking-tighter text-on-surface">98</span>
              <span className="text-on-surface-variant font-medium text-lg md:text-xl">%</span>
            </div>
          </div>
          <div className="mt-6 md:mt-8 p-4 bg-secondary-container/30 rounded-2xl flex items-center gap-3 border border-secondary/10">
            <CheckCircle2 className="text-secondary w-5 h-5 md:w-6 md:h-6" />
            <span className="text-on-secondary-container text-[10px] md:text-xs font-black uppercase tracking-widest">Nivel Excelente</span>
          </div>
        </div>

        <div className="md:col-span-8 bg-surface-container-low rounded-[2rem] p-6 md:p-8 grid grid-cols-2 gap-3 md:gap-4 border border-outline-variant/10 shadow-sm">
          {[
            { label: 'Temp', value: '36.6°C', icon: Thermometer, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Peso', value: '68.4 kg', icon: Weight, color: 'text-secondary', bg: 'bg-secondary/10' },
            { label: 'Glucosa', value: '95 mg/dL', icon: Droplets, color: 'text-tertiary', bg: 'bg-tertiary/10' },
            { label: 'Sueño', value: '7h 45m', icon: Moon, color: 'text-on-surface', bg: 'bg-surface-container-highest' },
          ].map((item) => (
            <motion.div 
              key={item.label}
              whileHover={{ y: -4 }}
              className="bg-surface-container-lowest p-4 md:p-5 rounded-2xl flex items-center gap-3 md:gap-4 shadow-sm border border-outline-variant/10 cursor-pointer"
            >
              <div className={`${item.bg} p-2.5 md:p-3 rounded-xl ${item.color}`}>
                <item.icon className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <p className="text-[9px] md:text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-0.5">{item.label}</p>
                <p className="font-lexend font-bold text-lg md:text-xl">{item.value}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* History Section */}
      <section className="space-y-4">
        <h3 className="font-lexend font-bold text-xl text-on-surface px-2">Historial Reciente</h3>
        <div className="space-y-3">
          {vitals.length === 0 ? (
            <div className="bg-surface-container-low p-12 rounded-[1.5rem] text-center text-outline-variant border-2 border-dashed border-outline-variant/20">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-lexend font-medium">No hay registros recientes</p>
            </div>
          ) : (
            vitals.map((vital, idx) => (
              <div key={vital.id || `vital-${idx}`} className="bg-surface-container-low p-4 rounded-2xl flex items-center justify-between border border-outline-variant/5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    {vital.type === 'bp' && <Activity className="w-5 h-5" />}
                    {vital.type === 'heart' && <Heart className="w-5 h-5" />}
                    {vital.type === 'oxygen' && <Wind className="w-5 h-5" />}
                    {vital.type === 'temp' && <Thermometer className="w-5 h-5" />}
                    {vital.type === 'weight' && <Weight className="w-5 h-5" />}
                    {vital.type === 'glucose' && <Droplets className="w-5 h-5" />}
                    {vital.type === 'sleep' && <Moon className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-lexend font-bold text-sm text-on-surface">
                        {vital.type === 'bp' ? 'Presión Arterial' : 
                         vital.type === 'heart' ? 'Pulso' :
                         vital.type === 'oxygen' ? 'Oxígeno' :
                         vital.type === 'temp' ? 'Temperatura' :
                         vital.type === 'weight' ? 'Peso' :
                         vital.type === 'glucose' ? 'Glucosa' : 'Sueño'}
                      </p>
                      {vital.isAlert && (
                        <div className="bg-error/10 text-error p-1 rounded-full">
                          <AlertTriangle className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-on-surface-variant font-medium">
                      {vital.timestamp?.toDate ? vital.timestamp.toDate().toLocaleString() : 'Recién registrado'}
                    </p>
                    {vital.isAlert && (
                      <p className="text-[9px] text-error font-bold mt-0.5">{vital.alertMessage}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-lexend font-black text-lg text-primary">{vital.value}</p>
                  <p className="text-[10px] font-bold text-outline uppercase tracking-widest">{vital.unit}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

    {/* Add Vital Modal */}
    <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface-container-lowest w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl"
            >
              <h2 className="text-3xl font-lexend font-black text-primary mb-6">Nueva Lectura</h2>
              <form onSubmit={handleAddVital} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-outline ml-2">Tipo de Signo</label>
                  <select 
                    value={newVital.type}
                    onChange={e => {
                      const type = e.target.value as VitalType;
                      let unit = '';
                      if (type === 'bp') unit = 'mmHg';
                      if (type === 'heart') unit = 'LPM';
                      if (type === 'temp') unit = '°C';
                      if (type === 'weight') unit = 'kg';
                      if (type === 'oxygen') unit = '%';
                      if (type === 'glucose') unit = 'mg/dL';
                      if (type === 'sleep') unit = 'h';
                      setNewVital({...newVital, type, unit});
                    }}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-2xl px-4 py-3 font-lexend text-sm focus:ring-2 focus:ring-primary outline-none appearance-none"
                  >
                    <option value="bp">Presión Arterial</option>
                    <option value="heart">Pulso (LPM)</option>
                    <option value="temp">Temperatura (°C)</option>
                    <option value="oxygen">Oxígeno (%)</option>
                    <option value="weight">Peso (kg)</option>
                    <option value="glucose">Glucosa (mg/dL)</option>
                    <option value="sleep">Sueño (horas)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-outline ml-2">Valor</label>
                  <input 
                    required
                    value={newVital.value}
                    onChange={e => setNewVital({...newVital, value: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-2xl px-4 py-3 font-lexend text-sm focus:ring-2 focus:ring-primary outline-none"
                    placeholder={newVital.type === 'bp' ? "Ej: 120/80" : "Ej: 72"}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-outline ml-2">Fecha</label>
                    <input 
                      required
                      type="date"
                      value={newVital.date}
                      onChange={e => setNewVital({...newVital, date: e.target.value})}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-2xl px-4 py-3 font-lexend text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-outline ml-2">Hora</label>
                    <input 
                      required
                      type="time"
                      value={newVital.time}
                      onChange={e => setNewVital({...newVital, time: e.target.value})}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-2xl px-4 py-3 font-lexend text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 py-4 rounded-2xl font-lexend font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-primary text-on-primary py-4 rounded-2xl font-lexend font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FAB */}
      {profile?.role === 'caregiver' && (
        <div className="fixed bottom-28 right-8 z-40">
          <button 
            onClick={() => setIsAdding(true)}
            className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-2xl shadow-primary/40 hover:scale-110 active:scale-90 transition-all"
          >
            <Plus className="w-8 h-8" />
          </button>
        </div>
      )}
    </div>
  );
};