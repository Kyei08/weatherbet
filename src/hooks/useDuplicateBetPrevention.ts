import { useRef, useState, useCallback, useEffect } from 'react';

interface DuplicateCheckResult {
  isDuplicate: boolean;
  recordBet: () => void;
}

/**
 * Hook to prevent duplicate bet placements within a cooldown period.
 * Returns methods to check for duplicates and record bet attempts.
 */
export function useDuplicateBetPrevention(cooldownMs: number = 5000) {
  const lastBetDetailsRef = useRef<string>('');
  const lastBetTimeRef = useRef<number>(0);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [remainingCooldown, setRemainingCooldown] = useState(0);

  // Update remaining cooldown every 100ms when dialog is open
  useEffect(() => {
    if (!showDuplicateDialog) {
      setRemainingCooldown(0);
      return;
    }

    const updateCooldown = () => {
      const elapsed = Date.now() - lastBetTimeRef.current;
      const remaining = Math.max(0, Math.ceil((cooldownMs - elapsed) / 1000));
      setRemainingCooldown(remaining);
      
      if (remaining === 0) {
        setShowDuplicateDialog(false);
      }
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 100);
    return () => clearInterval(interval);
  }, [showDuplicateDialog, cooldownMs]);

  /**
   * Check if a bet with the given signature is a duplicate.
   * Returns isDuplicate flag and a function to record the bet if proceeding.
   */
  const checkDuplicate = useCallback((betSignature: string): DuplicateCheckResult => {
    const now = Date.now();
    const timeSinceLastBet = now - lastBetTimeRef.current;
    
    const isDuplicate = lastBetDetailsRef.current === betSignature && timeSinceLastBet < cooldownMs;
    
    return {
      isDuplicate,
      recordBet: () => {
        lastBetDetailsRef.current = betSignature;
        lastBetTimeRef.current = now;
      }
    };
  }, [cooldownMs]);

  /**
   * Unified check that also triggers the dialog if duplicate.
   * Returns true if should proceed, false if duplicate detected.
   */
  const checkAndRecord = useCallback((betSignature: string): boolean => {
    const { isDuplicate, recordBet } = checkDuplicate(betSignature);
    
    if (isDuplicate) {
      setShowDuplicateDialog(true);
      return false;
    }
    
    recordBet();
    return true;
  }, [checkDuplicate]);

  return {
    showDuplicateDialog,
    setShowDuplicateDialog,
    remainingCooldown,
    checkDuplicate,
    checkAndRecord,
  };
}
