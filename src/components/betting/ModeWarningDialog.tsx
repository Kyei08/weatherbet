import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Coins, Banknote, ArrowRightLeft } from 'lucide-react';
import { CurrencyMode } from '@/contexts/CurrencyModeContext';

interface ModeWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetMode: CurrencyMode;
  onConfirm: () => void;
}

export const ModeWarningDialog = ({ 
  open, 
  onOpenChange, 
  targetMode, 
  onConfirm 
}: ModeWarningDialogProps) => {
  const isGoingToReal = targetMode === 'real';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
            <AlertDialogTitle className="text-xl">
              {isGoingToReal ? 'Switch to Real Money Mode?' : 'Switch to Virtual Mode?'}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-4 text-left">
            {isGoingToReal ? (
              <>
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Banknote className="h-5 w-5 text-green-600" />
                    <span>Switching to Real Money Mode</span>
                  </div>
                  <p className="text-sm">
                    You are about to switch to Real Money betting where you use South African Rands (R).
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-red-500 font-bold text-sm">✗</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Virtual Points Cannot Be Converted</p>
                      <p className="text-sm text-muted-foreground">
                        Your virtual points cannot be transferred or converted to real money. They are for practice only.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Separate Balances</p>
                      <p className="text-sm text-muted-foreground">
                        Virtual and Real balances are completely independent. Your bets and transactions are tracked separately.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Banknote className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Real Money = Real Stakes</p>
                      <p className="text-sm text-muted-foreground">
                        In Real Money mode, you bet with actual Rands and can win real prizes. You may need to deposit funds.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Coins className="h-5 w-5 text-primary" />
                    <span>Switching to Virtual Mode</span>
                  </div>
                  <p className="text-sm">
                    You are switching back to practice mode with virtual points. Perfect for learning and testing strategies!
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Coins className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Free to Play</p>
                      <p className="text-sm text-muted-foreground">
                        Virtual points are free - practice as much as you want without any risk!
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-red-500 font-bold text-sm">✗</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">No Real Money Conversion</p>
                      <p className="text-sm text-muted-foreground">
                        Remember: Virtual points have no monetary value and cannot be converted to real money.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> You can switch between modes at any time. Each mode maintains its own balance and betting history.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className={isGoingToReal ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            {isGoingToReal ? 'Switch to Real Money' : 'Switch to Virtual'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
