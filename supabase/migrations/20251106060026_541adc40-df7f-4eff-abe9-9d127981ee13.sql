-- Add foreign key relationship between user_purchases and shop_items
ALTER TABLE public.user_purchases
ADD CONSTRAINT user_purchases_item_id_fkey
FOREIGN KEY (item_id)
REFERENCES public.shop_items(id)
ON DELETE CASCADE;