import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { logout, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { User, ShieldCheck, AlertCircle, Heart, LogOut, Edit, ChevronRight, Verified, Database, Save, X, Link as LinkIcon, RefreshCw, Copy, Users, Plus, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const Profile: React.FC = () => {
  const { profile, user, updateProfile, linkedSeniorProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editData, setEditData] = useState({
    name: profile?.name || '',
    photoURL: profile?.photoURL || '',
    relationship: profile?.relationship || '',
    age: profile?.seniorInfo?.age || 82,
    bloodType: profile?.seniorInfo?.bloodType || 'O+',
    chronicDiseases: profile?.seniorInfo?.chronicDiseases?.join(', ') || '',
    allergies: profile?.seniorInfo?.allergies?.join(', ') || '',
  });

  const handleLogout = async () => {
    await logout();
  };

  const handleSwitchRole = async () => {
    // To switch role, we just log out and let them choose again at login
    await logout();
  };

  const handleSave = async () => {
    if (!user) return;
    
    if (profile?.role === 'caregiver') {
      await updateProfile({
        name: editData.name,
        photoURL: editData.photoURL,
        seniorInfo: {
          name: editData.name,
          age: Number(editData.age),
          bloodType: editData.bloodType,
          chronicDiseases: editData.chronicDiseases.split(',').map(s => s.trim()).filter(Boolean),
          allergies: editData.allergies.split(',').map(s => s.trim()).filter(Boolean),
          lastUpdate: serverTimestamp()
        }
      });
    } else {
      await updateProfile({
        name: editData.name,
        photoURL: editData.photoURL,
        relationship: editData.relationship
      });
    }
    setIsEditing(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 500KB for Base64 in Firestore)
    if (file.size > 500 * 1024) {
      alert("La imagen es demasiado grande. Por favor, elige una de menos de 500KB.");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditData(prev => ({ ...prev, photoURL: reader.result as string }));
      setIsUploading(false);
    };
    reader.onerror = () => {
      alert("Error al leer el archivo.");
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Código copiado al portapapeles");
  };

  const seedData = async () => {
    if (!user) return;
    const medsRef = collection(db, `users/${user.uid}/medications`);
    const vitalsRef = collection(db, `users/${user.uid}/vitals`);
    const geofenceRef = doc(db, `users/${user.uid}/geofence/status`);

    try {
      await addDoc(medsRef, { name: 'Atorvastatina', dosage: '500mg', time: '08:00 AM', status: 'pending', inventoryCount: 10 });
      await addDoc(medsRef, { name: 'Lisinopril', dosage: '10mg', time: '12:30 PM', status: 'pending', inventoryCount: 5 });
      await addDoc(medsRef, { name: 'Metformina', dosage: '1000mg', time: '07:15 AM', status: 'completed', lastAdministered: serverTimestamp() });
      await addDoc(medsRef, { name: 'Vitamina D3', dosage: '2000 IU', time: '08:00 AM', status: 'skipped' });

      const now = new Date();
      for (let i = 0; i < 5; i++) {
        const time = new Date(now.getTime() - i * 4 * 60 * 60 * 1000);
        await addDoc(vitalsRef, { type: 'bp', value: `${110 + Math.floor(Math.random() * 20)}/75`, timestamp: time });
        await addDoc(vitalsRef, { type: 'heart', value: `${70 + Math.floor(Math.random() * 15)}`, timestamp: time });
      }

      await setDoc(geofenceRef, { 
        status: 'safe', 
        radius: 200, 
        center: { lat: -34.6037, lng: -58.3816 },
        lastUpdate: serverTimestamp(),
        currentLocation: { lat: -34.6037, lng: -58.3816, address: 'Calle Oak Ridge, Edificio 4C' }
      });

      alert("Datos de demostración cargados con éxito.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/seed_data`);
    }
  };

  return (
    <div className="space-y-10 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-lexend font-black tracking-tight text-on-surface">Mi Perfil</h1>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className={`flex items-center justify-center p-4 rounded-full shadow-xl active:scale-90 transition-all ${
            isEditing ? 'bg-error text-on-error' : 'bg-primary-container text-on-primary-container'
          }`}
        >
          {isEditing ? <X className="w-6 h-6" /> : <Edit className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.section 
            key="edit-form"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-surface-container-low rounded-[2.5rem] p-8 space-y-6 shadow-2xl border-2 border-primary/10"
          >
            <h3 className="font-lexend font-black text-2xl text-primary mb-4">Editar Información</h3>
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4 p-6 bg-surface-container-lowest rounded-3xl border-2 border-dashed border-primary/20">
                <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-lg border-2 border-primary/10 relative group">
                  <img 
                    src={editData.photoURL || 'https://picsum.photos/seed/profile/200'} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                  />
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <RefreshCw className="w-8 h-8 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center gap-2">
                  <label className="cursor-pointer bg-primary text-on-primary px-6 py-2 rounded-xl font-lexend font-bold text-xs shadow-lg active:scale-95 transition-all">
                    {isUploading ? 'Procesando...' : 'Subir desde dispositivo'}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileChange}
                      disabled={isUploading}
                    />
                  </label>
                  <p className="text-[9px] text-on-surface-variant font-medium">Formatos: JPG, PNG. Máx 500KB.</p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-outline uppercase tracking-widest ml-2">O pegar URL de Foto</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={editData.photoURL}
                    onChange={(e) => setEditData({...editData, photoURL: e.target.value})}
                    placeholder="https://ejemplo.com/foto.jpg"
                    className="w-full bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 focus:border-primary outline-none font-medium text-sm pr-12"
                  />
                  <Camera className="absolute right-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-outline uppercase tracking-widest ml-2">Mi Nombre</label>
                <input 
                  type="text" 
                  value={editData.name}
                  onChange={(e) => setEditData({...editData, name: e.target.value})}
                  className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 focus:border-primary outline-none font-bold text-lg"
                />
              </div>

              {profile?.role === 'family' && (
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-outline uppercase tracking-widest ml-2">Parentezco con el Paciente</label>
                  <select 
                    value={editData.relationship}
                    onChange={(e) => setEditData({...editData, relationship: e.target.value})}
                    className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 focus:border-primary outline-none font-bold text-lg appearance-none"
                  >
                    <option value="">Seleccionar parentezco</option>
                    <option value="Hijo/a">Hijo/a</option>
                    <option value="Cónyuge">Cónyuge</option>
                    <option value="Nieto/a">Nieto/a</option>
                    <option value="Hermano/a">Hermano/a</option>
                    <option value="Sobrino/a">Sobrino/a</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              )}

              {profile?.role === 'caregiver' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-outline uppercase tracking-widest ml-2">Edad del Paciente</label>
                      <input 
                        type="number" 
                        value={editData.age}
                        onChange={(e) => setEditData({...editData, age: Number(e.target.value)})}
                        className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 focus:border-primary outline-none font-bold text-lg"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-outline uppercase tracking-widest ml-2">Tipo de Sangre</label>
                      <input 
                        type="text" 
                        value={editData.bloodType}
                        onChange={(e) => setEditData({...editData, bloodType: e.target.value})}
                        className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 focus:border-primary outline-none font-bold text-lg"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-outline uppercase tracking-widest ml-2">Enfermedades (separadas por coma)</label>
                    <textarea 
                      value={editData.chronicDiseases}
                      onChange={(e) => setEditData({...editData, chronicDiseases: e.target.value})}
                      className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 focus:border-primary outline-none font-bold text-lg h-24 resize-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-outline uppercase tracking-widest ml-2">Alergias (separadas por coma)</label>
                    <textarea 
                      value={editData.allergies}
                      onChange={(e) => setEditData({...editData, allergies: e.target.value})}
                      className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 focus:border-primary outline-none font-bold text-lg h-24 resize-none"
                    />
                  </div>
                </>
              )}
            </div>
            <button 
              onClick={handleSave}
              className="w-full py-5 bg-primary text-on-primary rounded-2xl font-lexend font-black text-xl shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-all"
            >
              <Save className="w-6 h-6" />
              Guardar Cambios
            </button>
          </motion.section>
        ) : (
          <motion.div 
            key="profile-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-10"
          >
            <section className="text-center relative">
              <div className="relative inline-block group cursor-pointer" onClick={() => setIsEditing(true)}>
                <div className="w-40 h-40 rounded-[2.5rem] overflow-hidden shadow-2xl mx-auto ring-8 ring-surface-container-lowest border-4 border-primary/10 relative">
                  <img 
                    alt={profile?.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    src={profile?.photoURL || 'https://picsum.photos/seed/profile/200'} 
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="text-white w-10 h-10" />
                  </div>
                </div>
                <div className="absolute -bottom-2 -right-2 bg-secondary-container text-on-secondary-container p-3 rounded-2xl shadow-xl border-4 border-surface">
                  <Verified className="w-6 h-6 fill-current" />
                </div>
              </div>
              <h2 className="mt-8 text-4xl font-lexend font-black text-on-surface tracking-tight">{profile?.name || 'Usuario'}</h2>
              <p className="text-on-surface-variant font-bold text-xl mt-2">
                {profile?.role === 'caregiver' 
                  ? `${profile?.seniorInfo?.age || 82} años • ${profile?.seniorInfo?.bloodType || 'O Positivo'}`
                  : profile?.relationship ? `Parentezco: ${profile.relationship}` : profile?.email}
              </p>
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-widest">
                {profile?.role === 'caregiver' ? 'Rol: Cuidador' : 'Rol: Familiar'}
              </div>
            </section>

            <div className="grid grid-cols-1 gap-8">
              {/* Family Linked Info */}
              {profile?.role === 'family' && (
                <div className="space-y-6">
                  {/* Pairing Code Section */}
                  <div className="bg-surface-container-low rounded-[2.5rem] p-8 space-y-6 shadow-xl shadow-on-surface/5 border border-outline-variant/10">
                    <div className="flex items-center gap-4">
                      <div className="bg-primary-container/20 p-3 rounded-2xl text-primary">
                        <LinkIcon className="w-6 h-6" />
                      </div>
                      <h3 className="font-lexend font-bold text-2xl">Código de Vinculación</h3>
                    </div>
                    <div className="bg-surface-container-lowest rounded-2xl p-6 flex items-center justify-between border border-primary/10 group">
                      <div>
                        <p className="text-[10px] font-black text-outline uppercase tracking-widest mb-1">Tu Código</p>
                        <p className="text-3xl font-lexend font-black text-primary tracking-widest">{profile.pairingCode}</p>
                      </div>
                      <button 
                        onClick={() => copyToClipboard(profile.pairingCode || '')}
                        className="p-4 bg-primary/10 text-primary rounded-2xl hover:bg-primary/20 transition-all active:scale-90"
                        title="Copiar Código"
                      >
                        <Copy className="w-6 h-6" />
                      </button>
                    </div>
                    <p className="text-xs text-on-surface-variant font-medium px-2">
                      Comparte este código con tu cuidador para vincular las cuentas.
                    </p>
                  </div>

                  {linkedSeniorProfile ? (
                    <div className="bg-primary-container/10 border-2 border-primary/20 rounded-[2.5rem] p-8 space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary text-on-primary p-3 rounded-2xl shadow-lg">
                          <ShieldCheck className="w-6 h-6" />
                        </div>
                        <h3 className="font-lexend font-bold text-2xl text-primary">Paciente Vinculado</h3>
                      </div>
                      <div className="flex items-center gap-6 bg-surface-container-lowest rounded-2xl p-6 border border-primary/10">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-primary/20">
                          <img 
                            src={linkedSeniorProfile.photoURL || 'https://picsum.photos/seed/senior/100'} 
                            alt={linkedSeniorProfile.seniorInfo?.name} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-outline uppercase tracking-widest mb-1">Nombre del Paciente</p>
                          <p className="text-2xl font-lexend font-black text-primary truncate">{linkedSeniorProfile.seniorInfo?.name}</p>
                          <p className="text-sm text-on-surface-variant font-medium">
                            {linkedSeniorProfile.seniorInfo?.age} años • {linkedSeniorProfile.seniorInfo?.bloodType}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Caregiver Specific Sections */}
              {profile?.role === 'caregiver' && (
                <>
                  {/* Caregiver Pairing Section */}
                  <div className="bg-primary-container/10 border-2 border-primary/20 rounded-[2.5rem] p-8 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary text-on-primary p-3 rounded-2xl shadow-lg">
                          <Users className="w-6 h-6" />
                        </div>
                        <h3 className="font-lexend font-bold text-2xl text-primary">Familiares Vinculados</h3>
                      </div>
                    </div>
                    
                    {profile.linkedFamilyUids && profile.linkedFamilyUids.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-on-surface-variant">
                          <span className="text-xs font-black uppercase tracking-widest">Familiares ({profile.linkedFamilyUids.length}/2)</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {profile.linkedFamilyUids.map(uid => (
                            <div key={uid} className="bg-surface-container-highest px-4 py-2 rounded-xl text-[10px] font-bold text-on-surface truncate max-w-[150px]">
                              ID: {uid}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-on-surface-variant text-sm font-medium text-center py-4">
                        No hay familiares vinculados. Usa el botón superior para añadir uno.
                      </p>
                    )}
                  </div>

                  {/* Personal Data */}
                  <div className="bg-surface-container-low rounded-[2.5rem] p-8 space-y-6 shadow-xl shadow-on-surface/5">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="bg-primary-container/20 p-3 rounded-2xl text-primary">
                        <User className="w-6 h-6" />
                      </div>
                      <h3 className="font-lexend font-bold text-2xl">Datos del Paciente</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-surface-container-lowest rounded-2xl p-5 flex flex-col gap-1 border border-outline-variant/10">
                        <span className="text-[10px] font-black text-outline uppercase tracking-widest">Nombre Completo</span>
                        <span className="text-xl font-bold">{profile?.name || 'Manuel Roa'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-surface-container-lowest rounded-2xl p-5 flex flex-col gap-1 border border-outline-variant/10">
                          <span className="text-[10px] font-black text-outline uppercase tracking-widest">Edad</span>
                          <span className="text-xl font-bold">{profile?.seniorInfo?.age || 82} años</span>
                        </div>
                        <div className="bg-surface-container-lowest rounded-2xl p-5 flex flex-col gap-1 border border-outline-variant/10">
                          <span className="text-[10px] font-black text-outline uppercase tracking-widest">Sangre</span>
                          <span className="text-xl font-bold">{profile?.seniorInfo?.bloodType || 'O+'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chronic Diseases */}
                  <div className="bg-error-container/10 border-2 border-error/10 rounded-[2.5rem] p-8">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="bg-error text-on-error p-3 rounded-2xl shadow-lg shadow-error/20">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <h3 className="font-lexend font-bold text-2xl text-on-error-container">Enfermedades Crónicas</h3>
                    </div>
                    <div className="space-y-3">
                      {profile?.seniorInfo?.chronicDiseases?.map((disease) => (
                        <div key={disease} className="bg-surface-container-lowest border-l-8 border-error px-6 py-4 rounded-2xl shadow-sm flex items-center justify-between group cursor-pointer hover:bg-error/5 transition-colors">
                          <div>
                            <span className="text-xl font-black text-on-surface">{disease}</span>
                            <p className="text-sm text-on-surface-variant font-medium">Tratamiento activo</p>
                          </div>
                          <ChevronRight className="text-error opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )) || (
                        <p className="text-on-surface-variant font-medium text-center py-4">No hay enfermedades registradas</p>
                      )}
                    </div>
                  </div>

                  {/* Allergies */}
                  <div className="bg-[#fff7e6] border-2 border-[#ff9800]/10 rounded-[2.5rem] p-8">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="bg-[#ff9800] text-white p-3 rounded-2xl shadow-lg shadow-[#ff9800]/20">
                        <Heart className="w-6 h-6 fill-current" />
                      </div>
                      <h3 className="font-lexend font-bold text-2xl text-[#663c00]">Alergias</h3>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {profile?.seniorInfo?.allergies?.map((allergy) => (
                        <motion.span 
                          key={allergy}
                          whileHover={{ scale: 1.05 }}
                          className="bg-[#ff9800] text-white font-lexend font-black px-8 py-4 rounded-2xl shadow-xl text-lg tracking-tight"
                        >
                          {allergy.toUpperCase()}
                        </motion.span>
                      )) || (
                        <p className="text-on-surface-variant font-medium text-center py-4 w-full">No hay alergias registradas</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4 pt-8">
        {profile?.role === 'caregiver' && (
          <button 
            onClick={seedData}
            className="w-full py-6 bg-secondary/10 text-secondary font-lexend font-black text-xl rounded-[2rem] hover:bg-secondary/20 transition-all flex items-center justify-center gap-3 active:scale-95"
          >
            <Database className="w-6 h-6" />
            Cargar Datos Demo
          </button>
        )}

        <button 
          onClick={handleSwitchRole}
          className="w-full py-6 bg-primary/10 text-primary font-lexend font-black text-xl rounded-[2rem] hover:bg-primary/20 transition-all flex items-center justify-center gap-3 active:scale-95"
        >
          <RefreshCw className="w-6 h-6" />
          Cambiar de Rol
        </button>

        <button 
          onClick={handleLogout}
          className="w-full py-6 bg-surface-container-highest text-error font-lexend font-black text-xl rounded-[2rem] hover:bg-error/5 transition-all flex items-center justify-center gap-3 active:scale-95"
        >
          <LogOut className="w-6 h-6" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
};

