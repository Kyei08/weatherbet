import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'moderator' | 'user';

// Check if current user has a specific role
export const hasRole = async (role: AppRole): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: role });

    if (error) throw error;
    return data || false;
  } catch (error) {
    console.error('Error checking role:', error);
    return false;
  }
};

// Check if current user is admin
export const isAdmin = async (): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .rpc('is_admin', { _user_id: user.id });

    if (error) throw error;
    return data || false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// Get user's roles
export const getUserRoles = async (userId?: string) => {
  try {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) return [];

    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', targetUserId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching user roles:', error);
    return [];
  }
};

// Grant role to user (admin only)
export const grantRole = async (userId: string, role: AppRole) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role,
        granted_by: user.id,
      });

    if (error) throw error;

    // Log admin action
    await logAdminAction('grant_role', 'user_roles', userId, { role });
  } catch (error) {
    console.error('Error granting role:', error);
    throw error;
  }
};

// Revoke role from user (admin only)
export const revokeRole = async (userId: string, role: AppRole) => {
  try {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', role);

    if (error) throw error;

    // Log admin action
    await logAdminAction('revoke_role', 'user_roles', userId, { role });
  } catch (error) {
    console.error('Error revoking role:', error);
    throw error;
  }
};

// Log admin action
export const logAdminAction = async (
  action: string,
  targetTable?: string,
  targetId?: string,
  details?: any
) => {
  try {
    const { data, error } = await supabase
      .rpc('log_admin_action', {
        _action: action,
        _target_table: targetTable || null,
        _target_id: targetId || null,
        _details: details ? JSON.stringify(details) : null,
      });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error logging admin action:', error);
  }
};

// Get audit logs (admin only)
export const getAuditLogs = async (limit: number = 50) => {
  try {
    const { data, error } = await supabase
      .from('admin_audit_log')
      .select(`
        *,
        admin:admin_id (
          id,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
};

// Get all users with their roles (admin only)
export const getAllUsersWithRoles = async () => {
  try {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersError) throw usersError;

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');

    if (profilesError) throw profilesError;

    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*');

    if (rolesError) throw rolesError;

    // Merge data
    return users.map(user => ({
      ...user,
      profile: profiles.find(p => p.user_id === user.id),
      roles: roles.filter(r => r.user_id === user.id).map(r => r.role),
    }));
  } catch (error) {
    console.error('Error fetching users with roles:', error);
    return [];
  }
};
