
-- Products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  urls JSONB NOT NULL DEFAULT '{}',
  is_monitored BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Price entries table
CREATE TABLE public.price_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  store TEXT NOT NULL,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TND',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Price alerts table
CREATE TABLE public.price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  product_name TEXT NOT NULL,
  store TEXT NOT NULL,
  old_price NUMERIC NOT NULL,
  new_price NUMERIC NOT NULL,
  change_percent NUMERIC NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('up', 'down')),
  recommendation TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Monitoring status table (single row)
CREATE TABLE public.monitoring_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_auto_monitoring BOOLEAN NOT NULL DEFAULT true,
  last_check TIMESTAMPTZ,
  next_check TIMESTAMPTZ,
  total_checks INTEGER NOT NULL DEFAULT 0
);

-- Insert default monitoring row
INSERT INTO public.monitoring_status (is_auto_monitoring, total_checks) VALUES (true, 0);

-- RLS: Make all tables publicly accessible (no auth required for this app)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access price_entries" ON public.price_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access price_alerts" ON public.price_alerts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access monitoring_status" ON public.monitoring_status FOR ALL USING (true) WITH CHECK (true);
