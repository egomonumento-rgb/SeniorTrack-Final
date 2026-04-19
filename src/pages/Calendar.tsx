import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, MapPin, Clock, Info, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, deleteDoc, doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Appointment } from '../types';
import { CheckCircle2, XCircle } from 'lucide-react';

export const Calendar: React.FC = () => {
  const { user, profile, linkedSeniorProfile } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newAppt, setNewAppt] = useState({ doctor: '', specialty: '', date: '', time: '', location: '', notes: '' });
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    if (!user || !profile) return;

    const seniorId = profile.role === 'family' && profile.linkedSeniorId ? profile.linkedSeniorId : user.uid;
    const q = query(collection(db, `users/${seniorId}/appointments`), orderBy('date', 'asc'));

    const unsubscribe = onSnapshot(q, (snap) => {
      const appts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));
      
      // Auto-delete appointments older than 24 hours
      const now = new Date();
      appts.forEach(async (appt) => {
        const apptDate = appt.date.toDate();
        const diffHours = (now.getTime() - apptDate.getTime()) / (1000 * 60 * 60);
        if (diffHours > 24 && profile.role === 'caregiver') {
          try {
            await deleteDoc(doc(db, `users/${user.uid}/appointments/${appt.id}`));
          } catch (error) {
            handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/appointments/${appt.id}`);
          }
        }
      });

      setAppointments(appts);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${seniorId}/appointments`);
    });

    return () => unsubscribe();
  }, [user, profile]);

  const handleAddAppt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || profile.role === 'family') return;

    try {
      await addDoc(collection(db, `users/${user.uid}/appointments`), {
        ...newAppt,
        date: Timestamp.fromDate(new Date(newAppt.date)),
        createdAt: serverTimestamp()
      });
      setIsAdding(false);
      setNewAppt({ doctor: '', specialty: '', date: '', time: '', location: '', notes: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/appointments`);
    }
  };

  const deleteAppointment = async (id: string) => {
    if (!user || profile?.role === 'family') return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/appointments/${id}`));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/appointments/${id}`);
    }
  };

  const toggleAttendance = async (id: string, attended: boolean) => {
    if (!user || profile?.role === 'family') return;
    const seniorId = user.uid;
    try {
      await updateDoc(doc(db, `users/${seniorId}/appointments/${id}`), {
        attended: attended
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${seniorId}/appointments/${id}`);
    }
  };

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1));

  const isPast = (appt: Appointment) => {
    const apptDate = appt.date.toDate();
    return apptDate < new Date();
  };

  const isPastOneHour = (appt: Appointment) => {
    const apptDate = appt.date.toDate();
    const oneHourLater = new Date(apptDate.getTime() + 60 * 60 * 1000);
    return new Date() > oneHourLater;
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-lexend font-black text-primary tracking-tighter">
            {monthNames[month]} {year}
          </h1>
          <p className="text-on-surface-variant font-medium mt-2 flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            {appointments.filter(a => !isPast(a)).length} citas médicas próximas 
            {profile?.role === 'family' && linkedSeniorProfile?.seniorInfo ? ` para ${linkedSeniorProfile.seniorInfo.name}` : ''}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Calendar Grid */}
        <div className="lg:col-span-8 bg-surface-container-lowest rounded-[2.5rem] p-8 shadow-2xl shadow-on-surface/5 border border-outline-variant/10">
          <div className="flex items-center justify-between mb-8">
            <button onClick={prevMonth} className="p-2 hover:bg-surface-container-low rounded-full transition-colors"><ChevronLeft /></button>
            <h2 className="font-lexend font-bold text-lg">{monthNames[month]}</h2>
            <button onClick={nextMonth} className="p-2 hover:bg-surface-container-low rounded-full transition-colors"><ChevronRight /></button>
          </div>
          
          <div className="grid grid-cols-7 gap-2 mb-4">
            {weekDays.map(d => (
              <div key={d} className="text-center font-lexend font-bold text-outline text-[10px] uppercase tracking-widest py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-3">
            {Array.from({ length: firstDayOfMonth(year, month) }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            
            {Array.from({ length: daysInMonth(year, month) }).map((_, i) => {
              const day = i + 1;
              const dayAppts = appointments.filter(a => {
                const d = a.date.toDate();
                return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
              });
              const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
              
              return (
                <motion.div 
                  key={day}
                  whileHover={{ scale: 1.05 }}
                  className={`aspect-square rounded-2xl p-3 flex flex-col items-start justify-between font-lexend text-sm relative cursor-pointer transition-all ${
                    isToday 
                      ? 'bg-primary text-on-primary shadow-xl ring-4 ring-primary-fixed' 
                      : dayAppts.length > 0
                        ? 'bg-secondary-container/20 text-secondary border-2 border-secondary/10' 
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  <span>{day}</span>
                  {dayAppts.length > 0 && (
                    <div className="flex gap-1">
                      {dayAppts.map(a => (
                        <div key={a.id} className={`w-2 h-2 rounded-full ${isPast(a) ? 'bg-outline' : 'bg-secondary animate-pulse'}`} />
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Upcoming List */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-surface-container-low rounded-[2.5rem] p-8 h-full flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-lexend font-black text-primary tracking-tight">Próximas Citas</h2>
              {profile?.role === 'family' && (
                <span className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-lexend font-black uppercase tracking-widest">Solo Lectura</span>
              )}
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px] pr-2 scrollbar-hide">
              {appointments.length === 0 && (
                <div className="text-center py-12 opacity-30">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-2" />
                  <p className="font-lexend font-bold text-sm">No hay citas agendadas</p>
                </div>
              )}
              {appointments.map((appt, idx) => {
                const apptDate = appt.date.toDate();
                const past = isPast(appt);
                return (
                  <motion.div 
                    key={appt.id || `appt-${idx}`}
                    whileHover={{ x: 4 }}
                    className={`bg-surface-container-lowest rounded-2xl p-5 flex gap-5 items-center shadow-sm border border-outline-variant/10 relative ${past ? 'opacity-60 grayscale' : ''}`}
                  >
                    <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center ${past ? 'bg-surface-container-highest' : 'bg-secondary-container'}`}>
                      <span className="font-lexend font-black text-xl leading-tight">{apptDate.getDate()}</span>
                      <span className="font-lexend text-[10px] font-black uppercase tracking-tighter opacity-70">
                        {apptDate.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="font-lexend font-bold text-on-surface leading-snug">{appt.doctor}</h3>
                        {profile?.role === 'caregiver' && (
                          <button onClick={() => deleteAppointment(appt.id)} className="text-outline hover:text-error transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant font-medium opacity-70">{appt.specialty}</p>
                      {appt.location && (
                        <div className="flex items-center gap-1.5 mt-1 opacity-60">
                          <MapPin className="w-3 h-3 text-secondary" />
                          <p className="text-[10px] font-medium truncate">{appt.location}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-2">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[11px] font-black text-primary uppercase tracking-wider">{appt.time}</span>
                        {past && !isPastOneHour(appt) && (
                          <span className="ml-2 text-[10px] font-bold text-secondary uppercase tracking-widest">En curso</span>
                        )}
                        {isPastOneHour(appt) && (
                          <div className="ml-auto flex items-center gap-2">
                            {appt.attended === true ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-secondary uppercase tracking-widest">
                                <CheckCircle2 className="w-3 h-3" /> Asistió
                              </span>
                            ) : appt.attended === false ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-error uppercase tracking-widest">
                                <XCircle className="w-3 h-3" /> No asistió
                              </span>
                            ) : (
                              profile?.role === 'caregiver' ? (
                                <div className="flex gap-1">
                                  <button 
                                    onClick={() => toggleAttendance(appt.id, true)}
                                    className="p-1 bg-secondary/10 text-secondary rounded-md hover:bg-secondary hover:text-white transition-colors"
                                    title="Asistió"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => toggleAttendance(appt.id, false)}
                                    className="p-1 bg-error/10 text-error rounded-md hover:bg-error hover:text-white transition-colors"
                                    title="No asistió"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] font-bold text-outline uppercase tracking-widest">Pendiente</span>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Map Preview */}
            <div className="mt-10 relative h-48 rounded-[2rem] overflow-hidden shadow-2xl group cursor-pointer">
              <img 
                alt="Map Preview" 
                className="w-full h-full object-cover grayscale opacity-40 group-hover:scale-110 transition-transform duration-1000" 
                src="https://picsum.photos/seed/clinics/400/300" 
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-primary/10 group-hover:bg-primary/0 transition-colors" />
              <div className="absolute inset-0 flex items-center justify-center">
                <button className="bg-primary text-on-primary px-6 py-3 rounded-full font-lexend font-black text-xs flex items-center gap-2 shadow-2xl active:scale-95 transition-all">
                  <MapPin className="w-4 h-4" />
                  Ver Mapas de Instalaciones
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Appointment Modal/Form */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface-container-lowest w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl"
            >
              <h2 className="text-3xl font-lexend font-black text-primary mb-6">Nueva Cita</h2>
              <form onSubmit={handleAddAppt} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-outline ml-2">Doctor/a</label>
                  <input 
                    required
                    value={newAppt.doctor}
                    onChange={e => setNewAppt({...newAppt, doctor: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-2xl px-4 py-3 font-lexend text-sm focus:ring-2 focus:ring-primary outline-none"
                    placeholder="Nombre del médico"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-outline ml-2">Especialidad</label>
                  <input 
                    required
                    value={newAppt.specialty}
                    onChange={e => setNewAppt({...newAppt, specialty: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-2xl px-4 py-3 font-lexend text-sm focus:ring-2 focus:ring-primary outline-none"
                    placeholder="Ej: Cardiología"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-outline ml-2">Fecha</label>
                    <input 
                      required
                      type="date"
                      value={newAppt.date}
                      onChange={e => setNewAppt({...newAppt, date: e.target.value})}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-2xl px-4 py-3 font-lexend text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-outline ml-2">Hora</label>
                    <input 
                      required
                      type="time"
                      value={newAppt.time}
                      onChange={e => setNewAppt({...newAppt, time: e.target.value})}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-2xl px-4 py-3 font-lexend text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-outline ml-2">Ubicación / Dirección</label>
                  <input 
                    value={newAppt.location}
                    onChange={e => setNewAppt({...newAppt, location: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-2xl px-4 py-3 font-lexend text-sm focus:ring-2 focus:ring-primary outline-none"
                    placeholder="Ej: Clínica Mayo, Calle 123"
                  />
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
                    Agendar
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
