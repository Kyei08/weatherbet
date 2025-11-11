-- Add foreign key constraint for combined_bet_categories
ALTER TABLE public.combined_bet_categories
ADD CONSTRAINT fk_combined_bet_categories_combined_bet
FOREIGN KEY (combined_bet_id) 
REFERENCES public.combined_bets(id) 
ON DELETE CASCADE;