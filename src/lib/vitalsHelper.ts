import { VitalType } from '../types';

export interface VitalLimit {
  min: number;
  max: number;
  unit: string;
  label: string;
}

export const VITAL_LIMITS: Record<VitalType, VitalLimit | { systolic: VitalLimit; diastolic: VitalLimit }> = {
  bp: {
    systolic: { min: 90, max: 140, unit: 'mmHg', label: 'Presión Sistólica' },
    diastolic: { min: 60, max: 90, unit: 'mmHg', label: 'Presión Diastólica' }
  },
  heart: { min: 50, max: 100, unit: 'LPM', label: 'Frecuencia Cardíaca' },
  oxygen: { min: 92, max: 100, unit: '%', label: 'Saturación de Oxígeno' },
  temp: { min: 36.0, max: 37.5, unit: '°C', label: 'Temperatura' },
  glucose: { min: 70, max: 140, unit: 'mg/dL', label: 'Glucosa' },
  weight: { min: 40, max: 150, unit: 'kg', label: 'Peso' }, // Weight is subjective but setting broad limits
  sleep: { min: 5, max: 10, unit: 'h', label: 'Horas de Sueño' }
};

export const checkVitalAlert = (type: VitalType, value: string): { isAlert: boolean; message: string } => {
  if (type === 'bp') {
    const [sys, dia] = value.split('/').map(v => parseInt(v.trim()));
    const limits = VITAL_LIMITS.bp as { systolic: VitalLimit; diastolic: VitalLimit };
    
    if (isNaN(sys) || isNaN(dia)) return { isAlert: false, message: '' };

    if (sys > limits.systolic.max) return { isAlert: true, message: `Presión sistólica alta: ${sys} mmHg` };
    if (sys < limits.systolic.min) return { isAlert: true, message: `Presión sistólica baja: ${sys} mmHg` };
    if (dia > limits.diastolic.max) return { isAlert: true, message: `Presión diastólica alta: ${dia} mmHg` };
    if (dia < limits.diastolic.min) return { isAlert: true, message: `Presión diastólica baja: ${dia} mmHg` };
    
    return { isAlert: false, message: '' };
  }

  const numValue = parseFloat(value);
  if (isNaN(numValue)) return { isAlert: false, message: '' };

  const limit = VITAL_LIMITS[type] as VitalLimit;
  if (!limit) return { isAlert: false, message: '' };

  if (numValue > limit.max) return { isAlert: true, message: `${limit.label} alta: ${numValue} ${limit.unit}` };
  if (numValue < limit.min) return { isAlert: true, message: `${limit.label} baja: ${numValue} ${limit.unit}` };

  return { isAlert: false, message: '' };
};
