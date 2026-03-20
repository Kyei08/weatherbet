import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Swords } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ChallengesList from '@/components/betting/ChallengesList';
import { MobileBottomNav } from '@/components/MobileBottomNav';

const Challenges = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-lg mx-auto p-4 space-y-4"
      >
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Head-to-Head Challenges</h1>
          </div>
        </div>

        <ChallengesList />
      </motion.div>
      <MobileBottomNav />
    </div>
  );
};

export default Challenges;
