-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table (separate from profiles/users for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  granted_by UUID REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create SECURITY DEFINER function to check roles (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can grant roles"
ON public.user_roles FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can revoke roles"
ON public.user_roles FOR DELETE
USING (public.is_admin(auth.uid()));

-- Add admin policies to sensitive tables
-- Shop items management
CREATE POLICY "Admins can manage shop items"
ON public.shop_items FOR ALL
USING (public.is_admin(auth.uid()));

-- Challenges management
CREATE POLICY "Admins can manage challenges"
ON public.challenges FOR ALL
USING (public.is_admin(auth.uid()));

-- Achievements management
CREATE POLICY "Admins can manage achievements"
ON public.achievements FOR ALL
USING (public.is_admin(auth.uid()));

-- Perks management
CREATE POLICY "Admins can manage perks"
ON public.perks FOR ALL
USING (public.is_admin(auth.uid()));

-- Admins can view all bets for support/moderation
CREATE POLICY "Admins can view all bets"
ON public.bets FOR SELECT
USING (public.is_admin(auth.uid()));

-- Admins can view all parlays for support/moderation
CREATE POLICY "Admins can view all parlays"
ON public.parlays FOR SELECT
USING (public.is_admin(auth.uid()));

-- Admins can view all user data for platform management
CREATE POLICY "Admins can view all user records"
ON public.users FOR SELECT
USING (public.is_admin(auth.uid()));

-- Admins can view all profiles for moderation
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.is_admin(auth.uid()));

-- Create audit log table for admin actions
CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) NOT NULL,
  action TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
ON public.admin_audit_log FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can create audit logs"
ON public.admin_audit_log FOR INSERT
WITH CHECK (public.is_admin(auth.uid()) AND auth.uid() = admin_id);

-- Create function to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action TEXT,
  _target_table TEXT DEFAULT NULL,
  _target_id UUID DEFAULT NULL,
  _details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _log_id UUID;
BEGIN
  INSERT INTO public.admin_audit_log (admin_id, action, target_table, target_id, details)
  VALUES (auth.uid(), _action, _target_table, _target_id, _details)
  RETURNING id INTO _log_id;
  
  RETURN _log_id;
END;
$$;