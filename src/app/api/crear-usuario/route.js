import { createClient } from '@supabase/supabase-js';

function getSupabaseUrl() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

export async function POST(request) {
  try {
    const supabaseUrl = getSupabaseUrl();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !anonKey) {
      return Response.json({ error: 'Faltan variables de Supabase en el servidor.' }, { status: 500 });
    }

    if (!serviceRoleKey) {
      return Response.json({
        error: 'Falta SUPABASE_SERVICE_ROLE_KEY en .env.local. Cópiala en Supabase → Project Settings → API → service_role y reinicia npm run dev.'
      }, { status: 500 });
    }

    const { email, password, usuario, rol, display_name } = await request.json();

    if (!email || !password || !usuario) {
      return Response.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    if (!['admin', 'user'].includes(rol)) {
      return Response.json({ error: 'Rol no válido' }, { status: 400 });
    }

    if (String(password).length < 6) {
      return Response.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: authUserData, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !authUserData?.user) {
      return Response.json({ error: 'Sesión no válida' }, { status: 401 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: callerProfile, error: callerError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', authUserData.user.id)
      .single();

    if (callerError || callerProfile?.role !== 'admin') {
      return Response.json({ error: 'Solo un administrador puede crear usuarios' }, { status: 403 });
    }

    const displayName = (display_name || usuario).trim();

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName }
    });

    if (authError) {
      return Response.json({ error: authError.message }, { status: 400 });
    }

    const uid = authData.user?.id;
    if (!uid) {
      return Response.json({ error: 'No se pudo obtener el ID del usuario' }, { status: 500 });
    }

    const { error: perfilError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: uid,
        email,
        display_name: displayName,
        role: rol
      }, { onConflict: 'id' });

    if (perfilError) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      return Response.json({ error: 'Error al crear el perfil: ' + perfilError.message }, { status: 500 });
    }

    return Response.json({ ok: true, id: uid, email });
  } catch {
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
