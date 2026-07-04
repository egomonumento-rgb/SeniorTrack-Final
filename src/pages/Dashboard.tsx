import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { collection, query, onSnapshot, orderBy, limit, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, logout, handleFirestoreError, OperationType, formatTimestamp } from '../lib/firebase';
import { Medication, VitalSign, GeofenceStatus, Appointment } from '../types';
import { Pill, Activity, MapPin, AlertTriangle, CheckCircle2, Clock, ChevronRight, TrendingUp, Battery, PhoneCall, Plus, LogOut, ShieldCheck, Calendar as CalendarIcon, Heart, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateHealthSummary } from '../lib/gemini';
import ReactMarkdown from 'react-markdown';

export const Dashboard: React.FC = () => {
  const { profile, user, justRegistered, setJustRegistered, linkedSeniorProfile } = useAuth();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [vitals, setVitals] = useState<VitalSign[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [geofence, setGeofence] = useState<GeofenceStatus | null>(null);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [isAddingMed, setIsAddingMed] = useState(false);
  const [newMed, setNewMed] = useState({ name: '', dosage: '', time: '', notes: '' });
  const [medToDelete, setMedToDelete] = useState<string | null>(null);

  const seniorName = (profile?.role === 'family' ? linkedSeniorProfile?.seniorInfo?.name : profile?.seniorInfo?.name) || 'Paciente';

  useEffect(() => {
    if (!user || !profile) return;

    const seniorId = profile.role === 'family' && profile.linkedSeniorId ? profile.linkedSeniorId : user.uid;

    const medsQuery = query(collection(db, `users/${seniorId}/medications`), orderBy('time', 'asc'));
    const unsubMeds = onSnapshot(medsQuery, (snap) => {
      const now = new Date();
      const medsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Medication));
      
      // Daily reset logic: If lastAdministered is from a previous day, reset status to pending
      if (profile.role === 'caregiver') {
        medsData.forEach(async (med) => {
          if (med.status === 'completed' && med.lastAdministered) {
            const lastDate = med.lastAdministered.toDate();
            const isDifferentDay = lastDate.getDate() !== now.getDate() || 
                                   lastDate.getMonth() !== now.getMonth() || 
                                   lastDate.getFullYear() !== now.getFullYear();
            
            if (isDifferentDay) {
              try {
                const medRef = doc(db, `users/${seniorId}/medications/${med.id}`);
                await updateDoc(medRef, {
                  status: 'pending',
                  lastAdministered: null
                });
              } catch (error) {
                console.error("Error resetting medication:", error);
              }
            }
          }
        });
      }

      setMeds(medsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${seniorId}/medications`);
    });

    const vitalsQuery = query(collection(db, `users/${seniorId}/vitals`), orderBy('timestamp', 'desc'), limit(30));
    const unsubVitals = onSnapshot(vitalsQuery, (snap) => {
      setVitals(snap.docs.map(d => ({ id: d.id, ...d.data() } as VitalSign)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${seniorId}/vitals`);
    });

    const geofenceRef = doc(db, `users/${seniorId}/geofence/status`);
    const unsubGeofence = onSnapshot(geofenceRef, (snap) => {
      if (snap.exists()) setGeofence(snap.data() as GeofenceStatus);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${seniorId}/geofence/status`);
    });

    const apptsQuery = query(collection(db, `users/${seniorId}/appointments`), orderBy('date', 'asc'));
    const unsubAppts = onSnapshot(apptsQuery, (snap) => {
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${seniorId}/appointments`);
    });

    return () => {
      unsubMeds();
      unsubVitals();
      unsubGeofence();
      unsubAppts();
    };
  }, [user, profile]);

  useEffect(() => {
    const fetchSummary = async () => {
      if (vitals.length > 0 && !aiSummary) {
        setLoadingSummary(true);
        const nameToUse = profile?.role === 'family' ? linkedSeniorProfile?.seniorInfo?.name : profile?.seniorInfo?.name;
        const summary = await generateHealthSummary(vitals, nameToUse || 'el paciente');
        setAiSummary(summary);
        setLoadingSummary(false);
      }
    };
    fetchSummary();
  }, [vitals, profile, linkedSeniorProfile, aiSummary]);

  useEffect(() => {
    if (justRegistered && profile?.role === 'caregiver') {
      setJustRegistered(false);
      window.location.href = '/profile';
    }
  }, [justRegistered, profile, setJustRegistered]);

  // Variables dinámicas basadas en los datos reales de la base de datos
  const latestBP = vitals.find(v => v.type === 'bp');
  const latestHeart = vitals.find(v => v.type === 'heart');
  const latestAlert = vitals.find(v => v.isAlert);
  
  // Cálculo de inventario real (Medicación con menos de 5 unidades, por ejemplo)
  const lowInventoryMedsCount = meds.filter(m => (m.inventoryCount ?? 30) <= 5).length;

  const handleAddMed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || profile.role === 'family') return;

    try {
      await addDoc(collection(db, `users/${user.uid}/medications`), {
        ...newMed,
        status: 'pending',
        inventoryCount: 30,
        createdAt: serverTimestamp()
      });
      setIsAddingMed(false);
      setNewMed({ name: '', dosage: '', time: '', notes: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/medications`);
    }
  };

  const toggleMedStatus = async (med: Medication) => {
    if (!user || !profile) return;
    if (profile.role === 'family') return;

    const seniorId = user.uid;
    const medRef = doc(db, `users/${seniorId}/medications/${med.id}`);
    const newStatus = med.status === 'completed' ? 'pending' : 'completed';
    try {
      await updateDoc(medRef, { 
        status: newStatus,
        lastAdministered: newStatus === 'completed' ? serverTimestamp() : null,
        inventoryCount: newStatus === 'completed' ? Math.max((med.inventoryCount ?? 30) - 1, 0) : (med.inventoryCount ?? 30)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${seniorId}/medications/${med.id}`);
    }
  };

  const handleDeleteMed = async (medId: string) => {
    if (!user || !profile || profile.role === 'family') return;
    
    const seniorId = user.uid;
    const medRef = doc(db, `users/${seniorId}/medications/${medId}`);
    try {
      await deleteDoc(medRef);
      setMedToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${seniorId}/medications/${medId}`);
    }
  };

  const isUnsafe = geofence?.status === 'unsafe';

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header with Logout */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-lexend font-black text-on-surface">
            Hola, {profile?.name?.split(' ')[0] || (profile?.role === 'caregiver' ? 'Cuidador' : 'Familiar')}
          </h1>
          <p className="text-on-surface-variant font-medium">
            {profile?.role === 'family' && linkedSeniorProfile?.seniorInfo 
              ? `Monitoreando a ${linkedSeniorProfile.seniorInfo.name}` 
              : 'Panel de Control'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleLogout}
            className="p-4 bg-surface-container-highest text-error rounded-full shadow-lg active:scale-90 transition-all hover:bg-error/10"
            title="Cerrar Sesión"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Health Alert Banner */}
      <AnimatePresence>
        {latestAlert && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-error-container border-l-8 border-error p-5 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 overflow-hidden"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-error rounded-full flex items-center justify-center animate-pulse">
                <Heart className="text-on-error w-8 h-8" />
              </div>
              <div>
                <h2 className="font-lexend font-black text-on-error-container text-xl leading-tight">
                  ALERTA DE SALUD DETECTADA
                </h2>
                <p className="text-on-error-container opacity-80 font-medium">
                  {latestAlert.alertMessage}
                </p>
              </div>
            </div>
            <button 
              onClick={() => window.location.href = '/vitals'}
              className="bg-error text-on-primary px-8 py-4 rounded-full font-lexend font-black text-sm tracking-wide active:scale-95 transition-all flex items-center gap-2 shadow-md"
            >
              VER DETALLES
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alert Banner if Unsafe */}
      {isUnsafe && (
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-error-container border-l-8 border-error p-5 rounded-2xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-error rounded-full flex items-center justify-center animate-pulse">
              <AlertTriangle className="text-on-error w-8 h-8" />
            </div>
            <div>
              <h2 className="font-lexend font-black text-on-error-container text-xl leading-tight">
                {geofence?.statusText === 'Fuera de zona' ? 'ALERTA: Perímetro Traspasado' : `ALERTA: ${geofence?.statusText || 'Fuera de Perímetro'}`}
              </h2>
              <p className="text-on-error-container opacity-80 font-medium">
                {seniorName} está {geofence?.statusText?.toLowerCase() || 'fuera de la zona segura'}.
              </p>
            </div>
          </div>
          <button className="bg-error text-on-primary px-8 py-4 rounded-full font-lexend font-black text-sm tracking-wide active:scale-95 transition-all flex items-center gap-2">
            <PhoneCall className="w-5 h-5" />
            LLAMAR AHORA
          </button>
        </motion.div>
      )}

      {/* AI Health Summary */}
      <section className="bg-gradient-to-br from-primary via-primary-container to-tertiary-container p-[2px] rounded-[2rem]">
        <div className="bg-surface-container-lowest rounded-[1.9rem] p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="text-primary w-6 h-6" />
            <h2 className="font-lexend font-bold text-2xl text-primary tracking-tight">Resumen de Salud (IA Gemini)</h2>
          </div>
          <div className="prose prose-slate max-w-none">
            {loadingSummary ? (
              <div className="flex items-center gap-3 text-outline animate-pulse">
                <div className="w-4 h-4 bg-primary/20 rounded-full animate-bounce" />
                <div className="w-4 h-4 bg-primary/20 rounded-full animate-bounce delay-100" />
                <div className="w-4 h-4 bg-primary/20 rounded-full animate-bounce delay-200" />
                <span>Analizando signos vitales...</span>
              </div>
            ) : (
              <div className="text-on-surface text-lg leading-relaxed font-body">
                <ReactMarkdown>
                  {aiSummary || "No hay suficientes datos para generar un resumen."}
                </ReactMarkdown>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 bg-secondary-container/30 px-4 py-2 rounded-full border border-secondary/10">
                <CheckCircle2 className="text-secondary w-4 h-4" />
                <span className="text-on-secondary-container font-semibold text-xs">
                  {latestAlert ? 'Revisión Requerida' : 'Estado Estable'}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-tertiary-fixed px-4 py-2 rounded-full border border-tertiary/10">
                <Pill className="text-tertiary w-4 h-4" />
                <span className="text-on-tertiary-fixed-variant font-semibold text-xs">
                  {lowInventoryMedsCount > 0 ? 'Revisar Inventarios' : 'Medicamentos al día'}
                </span>
              </div>
            </div>
            <button 
              onClick={() => window.location.href = '/vitals'}
              className="text-primary font-lexend font-bold text-sm flex items-center gap-1 hover:underline"
            >
              Ver detalle <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Main Stats Bento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Medical Appointments */}
        <div className="bg-surface-container-lowest rounded-[1.5rem] p-8 shadow-xl shadow-on-surface/5 border border-outline-variant/10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="font-lexend font-bold text-2xl tracking-tight text-on-surface mb-1">Citas Médicas</h2>
              <p className="text-on-surface-variant text-sm">Próximas y cumplidas</p>
            </div>
            <div className="bg-primary/10 text-primary px-4 py-2 rounded-xl flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              <span className="font-lexend font-bold text-sm">{appointments.length} Total</span>
            </div>
          </div>
          
          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 scrollbar-hide">
            {appointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 opacity-40">
                <CalendarIcon className="w-10 h-10 mb-2" />
                <p className="font-lexend font-medium text-sm">No hay citas programadas</p>
              </div>
            ) : (
              appointments.map((appt) => {
                const apptDate = appt.date.toDate();
                const isPast = apptDate < new Date();
                return (
                  <div key={appt.id} className={`flex items-center gap-4 p-3 rounded-2xl border ${isPast ? 'bg-surface-container-high/50 border-transparent opacity-60' : 'bg-surface-container-low border-outline-variant/10'}`}>
                    <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center ${isPast ? 'bg-outline-variant text-on-surface-variant' : 'bg-primary-container text-primary'}`}>
                      <span className="text-xs font-black leading-none">{apptDate.getDate()}</span>
                      <span className="text-[8px] font-black uppercase tracking-tighter">{apptDate.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-lexend font-bold text-sm text-on-surface truncate">{appt.doctor}</p>
                      <p className="text-[10px] text-on-surface-variant font-medium truncate">{appt.specialty}</p>
                      {appt.location && (
                        <div className="flex items-center gap-1 mt-1 opacity-60">
                          <MapPin className="w-2.5 h-2.5" />
                          <p className="text-[9px] font-medium truncate">{appt.location}</p>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-primary uppercase tracking-wider">{appt.time}</p>
                      {isPast && <span className="text-[8px] font-bold text-secondary uppercase tracking-widest">Cumplida</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Inventory / Quick Info (Dinamizado) */}
        <div className={`rounded-[1.5rem] p-8 flex flex-col justify-between relative overflow-hidden group transition-colors duration-500 ${
          lowInventoryMedsCount > 0 ? 'bg-error-container text-on-error-container' : 'bg-tertiary-container text-on-tertiary-container'
        }`}>
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
          <Pill className="w-12 h-12 mb-4 opacity-80" />
          <div>
            <p className="font-lexend text-5xl font-black mb-1">
              {String(lowInventoryMedsCount).padStart(2, '0')}
            </p>
            <p className="font-body font-medium text-sm leading-tight opacity-90">
              {lowInventoryMedsCount === 1 ? 'Medicamento con bajo inventario (5 o menos)' : 'Medicamentos con bajo inventario (5 o menos)'}
            </p>
          </div>
          <button className="mt-6 text-xs font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 transition-colors py-3 rounded-xl border border-white/10">
            Revisar Inventarios
          </button>
        </div>
      </div>

      {/* Medication List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-lexend font-bold text-xl text-on-surface">Lista de Medicamentos</h3>
          {profile?.role === 'caregiver' && (
            <button 
              onClick={() => setIsAddingMed(true)}
              className="bg-primary text-on-primary px-4 py-2 rounded-full font-lexend font-bold text-xs flex items-center gap-2 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              Añadir Medicamento
            </button>
          )}
        </div>
        
        {isAddingMed && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-container-high p-6 rounded-[1.5rem] border-2 border-primary/20 mb-6"
          >
            <form onSubmit={handleAddMed} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-outline ml-2">Nombre</label>
                  <input 
                    required
                    value={newMed.name}
                    onChange={e => setNewMed({...newMed, name: e.target.value})}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-2xl px-4 py-3 font-lexend text-sm focus:ring-2 focus:ring-primary outline-none"
                    placeholder="Ej: Atorvastatina"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-outline ml-2">Dosis</label>
                  <input 
                    required
                    value={newMed.dosage}
                    onChange={e => setNewMed({...newMed, dosage: e.target.value})}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-2xl px-4 py-3 font-lexend text-sm focus:ring-2 focus:ring-primary outline-none"
                    placeholder="Ej: 20mg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-outline ml-2">Horario</label>
                  <input 
                    required
                    type="time"
                    value={newMed.time}
                    onChange={e => setNewMed({...newMed, time: e.target.value})}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-2xl px-4 py-3 font-lexend text-sm focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-outline ml-2">Notas</label>
                  <input 
                    value={newMed.notes}
                    onChange={e => setNewMed({...newMed, notes: e.target.value})}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-2xl px-4 py-3 font-lexend text-sm focus:ring-2 focus:ring-primary outline-none"
                    placeholder="Ej: Con el desayuno"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-4">
                <button 
                  type="button"
                  onClick={() => setIsAddingMed(false)}
                  className="px-6 py-3 rounded-full font-lexend font-bold text-xs text-on-surface-variant hover:bg-surface-container-highest transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="bg-primary text-on-primary px-8 py-3 rounded-full font-lexend font-bold text-xs shadow-lg shadow-primary/20 active:scale-95 transition-all"
                >
                  Guardar Medicamento
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {meds.length === 0 && (
          <div className="bg-surface-container-low p-12 rounded-[1.5rem] text-center text-outline-variant border-2 border-dashed border-outline-
