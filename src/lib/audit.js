export async function logAction({ supabase, userId, userEmail, action, entityType, entityId, entityName, details }) {
  try {
    const { error } = await supabase.from('audit_logs').insert([
      {
        user_id: userId,
        user_email: userEmail,
        action,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        details
      }
    ]);
    return { error };
  } catch (error) {
    console.error('Error logging action:', error);
    return { error };
  }
}
