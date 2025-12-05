import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock } from "lucide-react";

interface DuplicateBetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  betType?: 'single' | 'parlay' | 'combined';
  remainingSeconds?: number;
}

export const DuplicateBetDialog = ({ open, onOpenChange, betType = 'single', remainingSeconds = 0 }: DuplicateBetDialogProps) => {
  const getBetTypeDisplay = () => {
    switch (betType) {
      case 'parlay':
        return { text: 'parlay', title: 'Parlay' };
      case 'combined':
        return { text: 'combined bet', title: 'Combined Bet' };
      default:
        return { text: 'bet', title: 'Bet' };
    }
  };

  const betDisplay = getBetTypeDisplay();
  
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-full bg-orange-500/10">
              <Clock className="h-5 w-5 text-orange-500" />
            </div>
            <AlertDialogTitle>Duplicate {betDisplay.title} Detected</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base space-y-3">
            <p>
              You've already placed an identical {betDisplay.text} within the last 5 seconds.
            </p>
            {remainingSeconds > 0 && (
              <div className="flex items-center justify-center gap-2 py-3 px-4 bg-muted rounded-lg">
                <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />
                <span className="font-semibold text-foreground">
                  Try again in {remainingSeconds} second{remainingSeconds !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              This protection prevents accidental duplicate bets from being charged to your account.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>Got it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};