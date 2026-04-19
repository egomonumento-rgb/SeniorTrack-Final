import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, formatTimestamp } from '../lib/firebase';
import { Medication } from '../types';
import { Pill, CheckCircle2, Clock, Plus } from 'lucide-react';
import { motion } from 'motion/react';

export const Medications: React.FC = () => {
  const { profile, user } = useAuth();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [isAddingMed, setIsAddingMed] = useState(false);
  const [newMed, setNewMed] = useState({ name: '', dosage: '', time: '', notes: '' });

  useEffect(() => {
    if (!user || !profile) return;

    const seniorId = profile.role === 'family' && profile.linkedSeniorId ? profile.linkedSeniorId : user.uid;

    const medsQuery = query(collection(db, `users/${seniorId}/medications`), orderBy('time', 'asc'));
    const unsubMeds = onSnapshot(medsQuery, (snap) => {
      setMeds(snap.docs.map(d => ({ id: d.id, ...d.data() } as Medication)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${seniorId}/medications`);
    });

    return () => unsubMeds();
  }, [user, profile]);

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
        lastAdministered: newStatus === 'completed' ? serverTimestamp() : null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${seniorId}/medications/${med.id}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-lexend font-black text-primary tracking-tighter">Medicamentos</h1>
          <p className="text-on-surface-variant font-medium">Gestión de dosis y horarios</p>
        </div>
        {profile?.role === 'caregiver' && (
          <button 
            onClick={() => setIsAddingMed(true)}
            className="bg-primary text-on-primary w-12 h-12 rounded-full flex items-center justify-center shadow-lg shadow-primary/20 active:scale-90 transition-all"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}
      </div>

      {isAddingMed && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-container-high p-6 rounded-[2rem] border-2 border-primary/20"
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
                Guardar
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="space-y-4">
        {meds.length === 0 ? (
          <div className="bg-surface-container-low p-12 rounded-[2rem] text-center text-outline-variant border-2 border-dashed border-outline-variant/20">
            <Pill className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-lexend font-medium">No hay medicamentos programados</p>
          </div>
        ) : (
          meds.map((med) => (
            <motion.div 
              key={med.id}
              whileHover={{ scale: 1.01 }}
              className={`bg-surface-container-low hover:bg-surface-container-lowest transition-all duration-300 rounded-[2rem] p-6 flex items-center justify-between gap-6 border border-transparent hover:shadow-xl hover:shadow-primary/5 ${
                med.status === 'completed' ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-center gap-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform ${
                  med.status === 'completed' ? 'bg-secondary-container text-secondary' : 'bg-primary-fixed text-primary'
                }`}>
                  <Pill className="w-8 h-8" />
                </div>
                <div>
                  <p className={`font-lexend font-extrabold text-xl text-on-surface ${med.status === 'completed' ? 'line-through' : ''}`}>
                    {med.name}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-on-surface-variant font-medium text-sm">
                      {med.dosage}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-outline-variant" />
                    <span className="text-primary font-bold text-sm flex items-center gap-1">
                      <Clock className="w-4 h-4" /> {med.time}
                    </span>
                    {med.status === 'completed' && med.lastAdministered && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-outline-variant" />
                        <span className="text-secondary font-bold text-sm bg-secondary/10 px-3 py-1 rounded-full flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Suministrado {formatTimestamp(med.lastAdministered)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {profile?.role === 'caregiver' ? (
                <button 
                  onClick={() => toggleMedStatus(med)}
                  className={`flex items-center gap-2 px-8 py-4 rounded-full font-lexend font-bold shadow-lg transition-all active:scale-95 ${
                    med.status === 'completed' 
                      ? 'bg-secondary/10 text-secondary' 
                      : 'bg-secondary text-on-secondary shadow-secondary/20 hover:brightness-110'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {med.status === 'completed' ? 'Registrado' : 'Administrar'}
                </button>
              ) : (
                <div className={`flex flex-col items-end gap-1 ${
                  med.status === 'completed' ? 'text-secondary' : 'text-outline'
                }`}>
                  <div className={`flex items-center gap-2 px-6 py-3 rounded-full font-lexend font-bold ${
                    med.status === 'completed' ? 'bg-secondary/10' : 'bg-surface-container-highest'
                  }`}>
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm">{med.status === 'completed' ? 'Suministrado' : 'Pendiente'}</span>
                  </div>
                  {med.status === 'completed' && med.lastAdministered && (
                    <span className="text-[10px] font-bold opacity-70 px-2">
                      {formatTimestamp(med.lastAdministered)}
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
