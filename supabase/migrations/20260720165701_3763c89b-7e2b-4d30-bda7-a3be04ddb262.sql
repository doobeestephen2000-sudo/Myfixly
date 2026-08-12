ALTER TABLE public.mechanics ADD COLUMN IF NOT EXISTS trade text NOT NULL DEFAULT 'generator_mechanic';
CREATE INDEX IF NOT EXISTS mechanics_trade_idx ON public.mechanics(trade);
CREATE INDEX IF NOT EXISTS mechanics_trade_status_idx ON public.mechanics(trade, status);