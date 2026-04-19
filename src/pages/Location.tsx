import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { GeofenceStatus } from '../types';
import { MapPin, Navigation, AlertTriangle, PhoneCall, ShieldCheck, History, Settings, Save, Clock, Activity, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Haversine formula to calculate distance between two coordinates in meters
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

const DEFAULT_HOME = {
  name: 'Casa',
  lat: 40.7128,
  lng: -74.0060,
  radius: 200 // meters
};

type LocationState = 'En casa' | 'Fuera de zona' | 'En movimiento' | 'Sin actividad';

export const Location: React.FC = () => {
  const { user, profile, linkedSeniorProfile, updateProfile } = useAuth();
  const [geofence, setGeofence] = useState<GeofenceStatus | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditingContacts, setIsEditingContacts] = useState(false);
  const [isEditingHome, setIsEditingHome] = useState(false);
  const [homeConfig, setHomeConfig] = useState({
    lat: DEFAULT_HOME.lat,
    lng: DEFAULT_HOME.lng,
    radius: DEFAULT_HOME.radius,
    name: DEFAULT_HOME.name
  });
  const [emergencyContacts, setEmergencyContacts] = useState({
    police: profile?.emergencyContacts?.police || '911',
    medical: profile?.emergencyContacts?.medical || '107'
  });

  const [currentPos, setCurrentPos] = useState<GeolocationCoordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationState>('Sin actividad');
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const [distanceFromHome, setDistanceFromHome] = useState<number | null>(null);
  const [isSimulatingAlert, setIsSimulatingAlert] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSharing, setIsSharing] = useState(false);
  
  const lastPosRef = useRef<GeolocationCoordinates | null>(null);
  const lastMoveTimeRef = useRef<number>(Date.now());
  const homeConfigRef = useRef(homeConfig);
  const watchIdRef = useRef<number | null>(null);

  const startSharing = () => {
    if (!navigator.geolocation) {
      alert("La geolocalización no es compatible con este navegador.");
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setIsSharing(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed } = position.coords;
        setCurrentPos(position.coords);
        setLastUpdateTime(new Date());

        // Use Ref to avoid stale closure issues during rapid updates
        const targetLat = homeConfigRef.current.lat;
        const targetLng = homeConfigRef.current.lng;
        const targetRadius = homeConfigRef.current.radius;

        const dist = getDistance(latitude, longitude, targetLat, targetLng);
        setDistanceFromHome(dist);

        let newStatus: LocationState = 'Sin actividad';

        // Zone priority logic
        if (dist <= targetRadius) {
          newStatus = 'En casa';
        } else {
          newStatus = 'Fuera de zona';
        }

        // Movement detection (only if not in alert state or to show activity)
        const isMoving = (speed && speed > 0.5) || 
          (lastPosRef.current && getDistance(latitude, longitude, lastPosRef.current.latitude, lastPosRef.current.longitude) > 5);

        if (isMoving) {
          lastMoveTimeRef.current = Date.now();
          if (newStatus !== 'Fuera de zona') {
            newStatus = 'En movimiento';
          }
        } else if (newStatus === 'En casa' && Date.now() - lastMoveTimeRef.current > 60000) {
          newStatus = 'Sin actividad';
        }

        setLocationStatus(newStatus);
        lastPosRef.current = position.coords;

        // Sync with Firestore if senior
        if (user && profile?.role === 'caregiver') {
          const geofenceRef = doc(db, `users/${user.uid}/geofence/status`);
          setDoc(geofenceRef, {
            status: dist <= targetRadius ? 'safe' : 'unsafe',
            lastUpdate: serverTimestamp(),
            currentLat: latitude,
            currentLng: longitude,
            distance: Math.round(dist),
            statusText: newStatus
          }, { merge: true }).catch(err => console.error('Error syncing location:', err));
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsOnline(false);
        setIsSharing(false);
        if (error.code === 1) {
          alert("Por favor, permite el acceso a la ubicación para compartir.");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
      }
    );
  };

  const stopSharing = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsSharing(false);
  };

  // Keep ref in sync with state
  useEffect(() => {
    homeConfigRef.current = homeConfig;
  }, [homeConfig]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (profile?.emergencyContacts) {
      setEmergencyContacts({
        police: profile.emergencyContacts.police,
        medical: profile.emergencyContacts.medical
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!user || !profile) return;

    const seniorId = profile.role === 'family' && profile.linkedSeniorId ? profile.linkedSeniorId : user.uid;

    const geofenceRef = doc(db, `users/${seniorId}/geofence/status`);
    const unsubGeofence = onSnapshot(geofenceRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as GeofenceStatus;
        setGeofence(data);
        
        // If family, sync status from Firestore
        if (profile.role === 'family') {
          if (data.statusText) setLocationStatus(data.statusText as LocationState);
          if (data.distance !== undefined) setDistanceFromHome(data.distance);
          if (data.lastUpdate) setLastUpdateTime(data.lastUpdate.toDate ? data.lastUpdate.toDate() : new Date(data.lastUpdate));
        }

        if (data.center && data.radius) {
          setHomeConfig({
            lat: data.center.lat,
            lng: data.center.lng,
            radius: data.radius,
            name: 'Casa'
          });
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${seniorId}/geofence/status`);
    });

    // Automatically start sharing for caregiver
    if (profile.role === 'caregiver') {
      startSharing();
    }

    return () => {
      unsubGeofence();
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [user, profile, homeConfig.lat, homeConfig.lng, homeConfig.radius]);

  const seniorName = (profile?.role === 'family' ? linkedSeniorProfile?.seniorInfo?.name : profile?.seniorInfo?.name) || 'Paciente';

  const handleSaveContacts = async () => {
    if (!user || profile?.role !== 'caregiver') return;
    try {
      await updateProfile({
        emergencyContacts
      });
      setIsEditingContacts(false);
    } catch (error) {
      console.error('Error saving emergency contacts:', error);
    }
  };

  const handleSaveHome = async () => {
    if (!user || profile?.role !== 'caregiver') return;
    setIsUpdating(true);
    try {
      const seniorId = user.uid;
      const geofenceRef = doc(db, `users/${seniorId}/geofence/status`);
      await setDoc(geofenceRef, {
        center: { lat: homeConfig.lat, lng: homeConfig.lng },
        radius: homeConfig.radius,
        lastUpdate: new Date()
      }, { merge: true });
      setIsEditingHome(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/geofence/status`);
    } finally {
      setIsUpdating(false);
    }
  };

  const setHomeToCurrent = () => {
    if (navigator.geolocation) {
      setIsUpdating(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          setCurrentPos(pos.coords);
          
          const newHome = {
            ...homeConfig,
            lat: latitude,
            lng: longitude
          };

          // Update local state and Ref immediately to prevent race conditions
          setHomeConfig(newHome);
          homeConfigRef.current = newHome;

          // Immediately save to Firestore if caregiver (Don't await to keep UI snappy)
          if (user && profile?.role === 'caregiver') {
            const seniorId = user.uid;
            const geofenceRef = doc(db, `users/${seniorId}/geofence/status`);
            
            // Force local state update to 'En casa' immediately
            setLocationStatus('En casa');
            setDistanceFromHome(0);

            setDoc(geofenceRef, {
              center: { lat: latitude, lng: longitude },
              radius: homeConfig.radius,
              status: 'safe',
              statusText: 'En casa',
              distance: 0,
              lastUpdate: new Date(),
              currentLat: latitude,
              currentLng: longitude
            }, { merge: true }).catch(error => {
              console.error("Error saving home location:", error);
              // Don't alert here to avoid interrupting the user if it's just a background sync
            });
            
            setIsEditingHome(false);
          }
          
          setIsUpdating(false);
        },
        (err) => {
          console.error("Error getting current position:", err);
          setIsUpdating(false);
          alert("No se pudo obtener la ubicación actual. Por favor, asegúrese de que el GPS esté activado y haya dado permisos.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      alert("La geolocalización no es compatible con este navegador.");
    }
  };

  const handleSimulateAlert = async () => {
    if (!user || profile?.role !== 'caregiver') return;
    
    setIsSimulatingAlert(true);
    const seniorId = user.uid;
    const geofenceRef = doc(db, `users/${seniorId}/geofence/status`);

    try {
      // Temporarily set status to unsafe in Firestore
      await setDoc(geofenceRef, {
        status: 'unsafe',
        statusText: 'Fuera de zona',
        distance: homeConfig.radius + 50,
        lastUpdate: new Date()
      }, { merge: true });

      // Reset after 5 seconds
      setTimeout(async () => {
        setIsSimulatingAlert(false);
        // The watchPosition will naturally overwrite this with real data on next tick
      }, 5000);
    } catch (error) {
      console.error("Error simulating alert:", error);
      setIsSimulatingAlert(false);
    }
  };

  const currentContacts = profile?.role === 'family' 
    ? linkedSeniorProfile?.emergencyContacts || { police: '911', medical: '107' }
    : profile?.emergencyContacts || { police: '911', medical: '107' };

  const getStatusColor = (status: LocationState) => {
    switch (status) {
      case 'En casa': return 'bg-secondary text-on-secondary';
      case 'En movimiento': return 'bg-amber-500 text-white';
      case 'Fuera de zona': return 'bg-error text-on-error';
      case 'Sin actividad': return 'bg-outline text-white';
      default: return 'bg-surface-container-highest text-on-surface';
    }
  };

  const getStatusIcon = (status: LocationState) => {
    switch (status) {
      case 'En casa': return <Home className="w-8 h-8" />;
      case 'En movimiento': return <Activity className="w-8 h-8" />;
      case 'Fuera de zona': return <AlertTriangle className="w-8 h-8" />;
      case 'Sin actividad': return <Clock className="w-8 h-8" />;
      default: return <MapPin className="w-8 h-8" />;
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-lexend font-black text-primary tracking-tighter">Estado de Ubicación</h1>
          <p className="text-on-surface-variant font-medium">Monitoreo inteligente sin mapas</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 ${isOnline ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-secondary' : 'bg-error animate-pulse'}`} />
              {isOnline ? 'En Línea' : 'Sin Conexión'}
            </div>
            <div className={`px-4 py-2 rounded-full font-lexend font-bold text-xs flex items-center gap-2 ${locationStatus === 'Fuera de zona' || isSimulatingAlert ? 'bg-error/10 text-error' : 'bg-secondary/10 text-secondary'}`}>
              <div className={`w-2 h-2 rounded-full ${locationStatus === 'Fuera de zona' || isSimulatingAlert ? 'bg-error animate-pulse' : 'bg-secondary'}`} />
              {locationStatus === 'Fuera de zona' || isSimulatingAlert ? 'Alerta de Seguridad' : 'Sistema Protegido'}
            </div>
          </div>
          {profile?.role === 'caregiver' && (
            <button 
              onClick={isSharing ? stopSharing : startSharing}
              className={`px-4 py-2 rounded-full font-lexend font-bold text-xs flex items-center gap-2 transition-all active:scale-95 ${isSharing ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'bg-surface-container-highest text-outline'}`}
            >
              <MapPin className={`w-4 h-4 ${isSharing ? 'animate-bounce' : ''}`} />
              {isSharing ? 'Compartiendo Ubicación' : 'Compartir Ubicación'}
            </button>
          )}
        </div>
      </div>

      {/* Main Status Display */}
      <section className="bg-surface-container-low rounded-[2.5rem] p-8 md:p-12 shadow-2xl border-4 border-white flex flex-col items-center text-center gap-8">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`w-32 h-32 rounded-full flex items-center justify-center shadow-2xl ${getStatusColor(isSimulatingAlert ? 'Fuera de zona' : locationStatus)}`}
        >
          {getStatusIcon(isSimulatingAlert ? 'Fuera de zona' : locationStatus)}
        </motion.div>

        <div className="space-y-2">
          <p className="text-outline font-black uppercase tracking-[0.2em] text-xs">Estado Actual</p>
          <h2 className="text-6xl font-lexend font-black text-on-surface tracking-tighter">
            {isSimulatingAlert ? 'Fuera de zona' : locationStatus}
          </h2>
          <p className="text-on-surface-variant font-medium text-lg">
            {seniorName} se encuentra en <span className="text-primary font-bold">{homeConfig.name}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl">
          <div className="bg-white p-6 rounded-3xl border border-outline-variant/10 shadow-sm">
            <p className="text-[10px] font-black text-outline uppercase tracking-widest mb-1">Zona</p>
            <p className="font-lexend font-bold text-on-surface">{homeConfig.name}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-outline-variant/10 shadow-sm">
            <p className="text-[10px] font-black text-outline uppercase tracking-widest mb-1">Distancia</p>
            <p className="font-lexend font-bold text-on-surface">
              {distanceFromHome !== null ? `${Math.round(distanceFromHome)}m` : '---'}
            </p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-outline-variant/10 shadow-sm">
            <p className="text-[10px] font-black text-outline uppercase tracking-widest mb-1">Actualizado</p>
            <p className="font-lexend font-bold text-on-surface">
              {lastUpdateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-outline-variant/10 shadow-sm">
            <p className="text-[10px] font-black text-outline uppercase tracking-widest mb-1">Precisión</p>
            <p className="font-lexend font-bold text-on-surface">
              {currentPos?.accuracy ? `${Math.round(currentPos.accuracy)}m` : '---'}
            </p>
          </div>
        </div>

        <AnimatePresence>
          {(locationStatus === 'Fuera de zona' || isSimulatingAlert) && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="w-full bg-error text-on-error p-6 rounded-3xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <div className="text-left">
                  <h3 className="font-lexend font-black text-xl leading-tight">
                    {isSimulatingAlert ? 'PRUEBA DE ALERTA' : '¡ALERTA DE SEGURIDAD!'}
                  </h3>
                  <p className="opacity-90 text-sm font-medium">
                    {isSimulatingAlert 
                      ? 'Simulando salida del perímetro seguro...' 
                      : `${seniorName} ha salido del radio de ${homeConfig.radius}m.`}
                  </p>
                </div>
              </div>
              <button className="bg-white text-error px-8 py-4 rounded-full font-lexend font-black text-sm flex items-center gap-2 shadow-xl active:scale-95 transition-all w-full md:w-auto">
                <PhoneCall className="w-5 h-5" />
                LLAMAR AHORA
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {profile?.role === 'caregiver' && (
          <button 
            onClick={handleSimulateAlert}
            disabled={isSimulatingAlert}
            className="mt-4 text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors flex items-center gap-2"
          >
            <AlertTriangle className="w-3 h-3" />
            Probar Alerta de Perímetro
          </button>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-container-low rounded-[2rem] p-8 border border-outline-variant/10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-secondary w-6 h-6" />
              <h2 className="font-lexend font-bold text-xl text-on-surface">Configuración de Seguridad</h2>
            </div>
            {profile?.role === 'caregiver' && (
              <button 
                onClick={() => isEditingHome ? handleSaveHome() : setIsEditingHome(true)}
                className={`p-2 rounded-xl transition-all ${isEditingHome ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-primary'}`}
              >
                {isEditingHome ? <Save className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
              </button>
            )}
          </div>
          <div className="space-y-4">
            {isEditingHome ? (
              <div className="space-y-4 p-4 bg-white rounded-2xl border border-primary/20">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-outline uppercase tracking-widest ml-2">Latitud</label>
                    <input 
                      type="number"
                      step="any"
                      value={homeConfig.lat}
                      onChange={e => setHomeConfig({...homeConfig, lat: parseFloat(e.target.value)})}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-outline uppercase tracking-widest ml-2">Longitud</label>
                    <input 
                      type="number"
                      step="any"
                      value={homeConfig.lng}
                      onChange={e => setHomeConfig({...homeConfig, lng: parseFloat(e.target.value)})}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-outline uppercase tracking-widest ml-2">Radio (Metros)</label>
                  <input 
                    type="number"
                    value={homeConfig.radius}
                    onChange={e => setHomeConfig({...homeConfig, radius: parseInt(e.target.value)})}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button 
                  onClick={setHomeToCurrent}
                  disabled={isUpdating}
                  className="w-full py-3 bg-secondary/10 text-secondary rounded-xl font-lexend font-bold text-xs flex items-center justify-center gap-2 hover:bg-secondary/20 transition-all disabled:opacity-50"
                >
                  <Navigation className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
                  {isUpdating ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'}
                </button>
                <button 
                  onClick={() => setIsEditingHome(false)}
                  className="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-error"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-outline-variant/10">
                  <div>
                    <p className="font-lexend font-bold text-sm">Radio de Alerta</p>
                    <p className="text-xs text-on-surface-variant">Zona segura alrededor de {homeConfig.name}</p>
                  </div>
                  <span className="bg-primary/10 text-primary px-4 py-1.5 rounded-full font-lexend font-black text-xs">{homeConfig.radius} Metros</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-outline-variant/10">
                  <div>
                    <p className="font-lexend font-bold text-sm">Coordenadas Casa</p>
                    <p className="text-xs text-on-surface-variant">{homeConfig.lat.toFixed(4)}°, {homeConfig.lng.toFixed(4)}°</p>
                  </div>
                  <span className="bg-secondary/10 text-secondary px-4 py-1.5 rounded-full font-lexend font-black text-xs">Fijado</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-outline-variant/10">
              <div>
                <p className="font-lexend font-bold text-sm">Modo de Rastreo</p>
                <p className="text-xs text-on-surface-variant">Frecuencia de actualización optimizada</p>
              </div>
              <span className="bg-secondary/10 text-secondary px-4 py-1.5 rounded-full font-lexend font-black text-xs">Alta Precisión</span>
            </div>
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <p className="text-xs text-on-surface-variant leading-relaxed">
                El sistema utiliza geolocalización de alta precisión para detectar cambios de estado sin necesidad de visualizar mapas, ahorrando batería y priorizando la privacidad.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-low rounded-[2rem] p-8 border border-outline-variant/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Settings className="text-outline w-6 h-6" />
                <h2 className="font-lexend font-bold text-xl text-on-surface">Contactos de Emergencia</h2>
              </div>
              {profile?.role === 'caregiver' && (
                <button 
                  onClick={() => isEditingContacts ? handleSaveContacts() : setIsEditingContacts(true)}
                  className={`p-2 rounded-xl transition-all ${isEditingContacts ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-primary'}`}
                >
                  {isEditingContacts ? <Save className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
                </button>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-4 p-3 bg-white rounded-2xl border border-outline-variant/10">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">P</div>
                <div className="flex-1">
                  <p className="text-sm font-bold">Policía Local</p>
                  {isEditingContacts ? (
                    <input 
                      type="text"
                      value={emergencyContacts.police}
                      onChange={e => setEmergencyContacts({...emergencyContacts, police: e.target.value})}
                      className="text-xs bg-surface-container-low border border-outline-variant/30 rounded-lg px-2 py-1 w-full mt-1 outline-none focus:ring-1 focus:ring-primary"
                    />
                  ) : (
                    <p className="text-[10px] text-on-surface-variant">{currentContacts.police}</p>
                  )}
                </div>
                <a href={`tel:${currentContacts.police}`} className="p-2 hover:bg-primary/10 rounded-full transition-colors">
                  <PhoneCall className="w-4 h-4 text-primary" />
                </a>
              </div>
              <div className="flex items-center gap-4 p-3 bg-white rounded-2xl border border-outline-variant/10">
                <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-bold">S</div>
                <div className="flex-1">
                  <p className="text-sm font-bold">Servicio Médico</p>
                  {isEditingContacts ? (
                    <input 
                      type="text"
                      value={emergencyContacts.medical}
                      onChange={e => setEmergencyContacts({...emergencyContacts, medical: e.target.value})}
                      className="text-xs bg-surface-container-low border border-outline-variant/30 rounded-lg px-2 py-1 w-full mt-1 outline-none focus:ring-1 focus:ring-secondary"
                    />
                  ) : (
                    <p className="text-[10px] text-on-surface-variant">{currentContacts.medical}</p>
                  )}
                </div>
                <a href={`tel:${currentContacts.medical}`} className="p-2 hover:bg-secondary/10 rounded-full transition-colors">
                  <PhoneCall className="w-4 h-4 text-secondary" />
                </a>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-on-surface-variant italic mt-6">
            * En caso de alerta, se notificará automáticamente a todos los familiares vinculados.
          </p>
        </div>
      </div>
    </div>
  );
};
