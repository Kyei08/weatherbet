import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Shield, Users, Activity, Settings, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { getAllUsersWithRoles, getAuditLogs, grantRole, revokeRole, logAdminAction } from '@/lib/admin';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const Admin = () => {
  const navigate = useNavigate();
  const { isAdminUser, loading } = useAdminCheck();
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBets: 0,
    activeBets: 0,
    totalPoints: 0,
  });
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !isAdminUser) {
      toast({
        title: 'Access Denied',
        description: 'You do not have admin permissions.',
        variant: 'destructive',
      });
      navigate('/');
    }
  }, [loading, isAdminUser, navigate, toast]);

  useEffect(() => {
    if (isAdminUser) {
      loadData();
    }
  }, [isAdminUser]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      // Load users with roles
      const usersData = await getAllUsersWithRoles();
      setUsers(usersData);

      // Load audit logs
      const logs = await getAuditLogs(100);
      setAuditLogs(logs);

      // Load stats
      const { data: betsData } = await supabase
        .from('bets')
        .select('result, stake');

      const totalBets = betsData?.length || 0;
      const activeBets = betsData?.filter(b => b.result === 'pending').length || 0;

      setStats({
        totalUsers: usersData.length,
        totalBets,
        activeBets,
        totalPoints: usersData.reduce((sum, u) => sum + (u.points || 0), 0),
      });
    } catch (error) {
      console.error('Error loading admin data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load admin data',
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleGrantRole = async (userId: string, role: 'admin' | 'moderator' | 'user') => {
    try {
      await grantRole(userId, role);
      toast({
        title: 'Role Granted',
        description: `Successfully granted ${role} role`,
      });
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to grant role',
        variant: 'destructive',
      });
    }
  };

  const handleRevokeRole = async (userId: string, role: 'admin' | 'moderator' | 'user') => {
    try {
      await revokeRole(userId, role);
      toast({
        title: 'Role Revoked',
        description: `Successfully revoked ${role} role`,
      });
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to revoke role',
        variant: 'destructive',
      });
    }
  };

  if (loading || !isAdminUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Shield className="h-8 w-8 text-primary" />
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground">Platform management and monitoring</p>
            </div>
          </div>
          <Badge variant="default" className="gap-2">
            <CheckCircle className="h-3 w-3" />
            Admin Access
          </Badge>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Bets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBets}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Bets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeBets}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Points</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPoints.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <Activity className="h-4 w-4" />
              Audit Logs
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Manage user roles and permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingData ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading users...</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Points</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.username}</TableCell>
                          <TableCell>{user.points.toLocaleString()}</TableCell>
                          <TableCell>Level {user.level}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {user.roles.length > 0 ? (
                                user.roles.map((role: string) => (
                                  <Badge key={role} variant="secondary" className="text-xs">
                                    {role}
                                  </Badge>
                                ))
                              ) : (
                                <Badge variant="outline" className="text-xs">user</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Select
                                onValueChange={(value) => {
                                  if (value === 'admin' || value === 'moderator') {
                                    handleGrantRole(user.id, value);
                                  }
                                }}
                              >
                                <SelectTrigger className="w-32 h-8 text-xs">
                                  <SelectValue placeholder="Grant role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="moderator">Moderator</SelectItem>
                                </SelectContent>
                              </Select>
                              {user.roles.length > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const roleToRevoke = user.roles[0];
                                    handleRevokeRole(user.id, roleToRevoke);
                                  }}
                                >
                                  Revoke
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>Audit Logs</CardTitle>
                <CardDescription>
                  Track all administrative actions on the platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingData ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading audit logs...</p>
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No audit logs yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {auditLogs.map((log: any) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{log.action.replace(/_/g, ' ').toUpperCase()}</p>
                          <p className="text-sm text-muted-foreground">
                            {log.target_table && `Table: ${log.target_table}`}
                            {log.details && ` • ${JSON.stringify(log.details)}`}
                          </p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Platform Settings</CardTitle>
                <CardDescription>
                  Configure platform-wide settings and features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Platform settings management coming soon. Use Supabase dashboard for database configuration.
                  </AlertDescription>
                </Alert>
                
                <div className="grid gap-4">
                  <Button
                    variant="outline"
                    onClick={() => window.open('https://supabase.com/dashboard/project/imyzcwgskjngwvcadrjn/editor', '_blank')}
                  >
                    Open Supabase Editor
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open('https://supabase.com/dashboard/project/imyzcwgskjngwvcadrjn/auth/users', '_blank')}
                  >
                    Manage Auth Users
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
