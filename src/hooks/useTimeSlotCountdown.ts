import { useState, useEffect, useMemo } from 'react';
import { TimeSlotConfig, BettingCategory, getTimeSlot } from '@/lib/betting-timing';

export interface CountdownResult {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isExpired: boolean;
  isPast: boolean;
  label: string;
}

/**
 * Calculate the next occurrence of a time slot measurement
 */
function getNextMeasurementTime(slot: TimeSlotConfig, targetDate?: string): Date {
  const now = new Date();
  let measurementDate: Date;

  // If target date is provided, use that date
  if (targetDate) {
    measurementDate = new Date(targetDate);
    // Reset to start of that day
    measurementDate.setHours(0, 0, 0, 0);
  } else {
    measurementDate = new Date();
    measurementDate.setHours(0, 0, 0, 0);
  }

  if (slot.isRange) {
    // For range-based measurements, the resolution happens at the end of the range
    const endHour = slot.endHour ?? 23;
    measurementDate.setHours(endHour, 59, 59, 999);
  } else {
    // For point-in-time measurements
    const measurementHour = slot.measurementHour ?? 12;
    measurementDate.setHours(measurementHour, 0, 0, 0);
  }

  // If the measurement time has already passed today and no specific target date
  if (!targetDate && measurementDate <= now) {
    // Move to tomorrow
    measurementDate.setDate(measurementDate.getDate() + 1);
  }

  return measurementDate;
}

/**
 * Format countdown for display
 */
function formatCountdown(totalSeconds: number): { hours: number; minutes: number; seconds: number } {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds };
}

/**
 * Hook to get countdown to next measurement time for a time slot
 */
export function useTimeSlotCountdown(
  category: BettingCategory,
  slotId: string,
  targetDate?: string
): CountdownResult | null {
  const slot = useMemo(() => getTimeSlot(category, slotId), [category, slotId]);
  const [countdown, setCountdown] = useState<CountdownResult | null>(null);

  useEffect(() => {
    if (!slot) return;

    const calculateCountdown = () => {
      const now = new Date();
      const measurementTime = getNextMeasurementTime(slot, targetDate);
      const diffMs = measurementTime.getTime() - now.getTime();
      
      if (diffMs <= 0) {
        setCountdown({
          hours: 0,
          minutes: 0,
          seconds: 0,
          totalSeconds: 0,
          isExpired: true,
          isPast: true,
          label: slot.isRange ? 'Window closed' : 'Resolved'
        });
        return;
      }

      const totalSeconds = Math.floor(diffMs / 1000);
      const { hours, minutes, seconds } = formatCountdown(totalSeconds);

      setCountdown({
        hours,
        minutes,
        seconds,
        totalSeconds,
        isExpired: false,
        isPast: false,
        label: slot.isRange 
          ? `Window ends in ${hours}h ${minutes}m` 
          : `Measures in ${hours}h ${minutes}m`
      });
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);

    return () => clearInterval(interval);
  }, [slot, targetDate]);

  return countdown;
}

/**
 * Get measurement time info without live updates (for static display)
 */
export function getMeasurementTimeInfo(
  category: BettingCategory,
  slotId: string,
  targetDate?: string
): { measurementTime: Date; formattedTime: string } | null {
  const slot = getTimeSlot(category, slotId);
  if (!slot) return null;

  const measurementTime = getNextMeasurementTime(slot, targetDate);
  
  const formattedTime = slot.isRange
    ? `by ${measurementTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : `at ${measurementTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  return { measurementTime, formattedTime };
}
