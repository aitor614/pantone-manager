-- Migracion de seguridad y auditoria para Pantone Manager.
-- Ejecutar en Supabase SQL Editor despues de schema.sql.

-- Permite registrar importaciones sin romper los logs existentes.
ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'IMPORT', 'BACKUP'));

-- Vista con los nombres solicitados para consultar el historial de auditoria.
CREATE OR REPLACE VIEW public.logs_auditoria AS
SELECT
  id,
  user_id AS usuario_id,
  action AS accion,
  entity_type AS entidad,
  details AS detalles,
  created_at
FROM public.audit_logs;

-- Nombre alternativo para integraciones que esperan logs_actividad.
CREATE OR REPLACE VIEW public.logs_actividad AS
SELECT
  id,
  user_id AS usuario_id,
  action AS accion,
  details AS detalle,
  created_at
FROM public.audit_logs;

-- El historial solo puede leerlo un administrador. Los usuarios autenticados
-- pueden registrar sus propias acciones desde la aplicacion.
ALTER VIEW public.logs_auditoria SET (security_invoker = true);
ALTER VIEW public.logs_actividad SET (security_invoker = true);

DROP POLICY IF EXISTS "Authenticated insert logs" ON public.audit_logs;
CREATE POLICY "Authenticated insert logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin reads logs" ON public.audit_logs;
CREATE POLICY "Admin reads logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());
