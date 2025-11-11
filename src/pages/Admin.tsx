import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Shield, Users, Activity, Settings, AlertTriangle, CheckCircle, Package, Target, Award, Plus, Pencil, Trash2 } from 'lucide-react';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { getAllUsersWithRoles, getAuditLogs, grantRole, revokeRole, logAdminAction } from '@/lib/admin';
import { getAllShopItems, getAllChallenges, getAllAchievements, deleteShopItem, deleteChallenge, deleteAchievement } from '@/lib/admin-content';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ShopItemForm } from '@/components/admin/ShopItemForm';
import { ChallengeForm } from '@/components/admin/ChallengeForm';
import { AchievementForm } from '@/components/admin/AchievementForm';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const Admin = () => {
  const navigate = useNavigate();
  const { isAdminUser, loading } = useAdminCheck();
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBets: 0,
    activeBets: 0,
    totalPoints: 0,
  });
  const [loadingData, setLoadingData] = useState(true);
  
  // Form states
  const [shopItemFormOpen, setShopItemFormOpen] = useState(false);
  const [challengeFormOpen, setChallengeFormOpen] = useState(false);
  const [achievementFormOpen, setAchievementFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: string; id: string; title: string }>({
    open: false,
    type: '',
    id: '',
    title: '',
  });

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

      // Load content
      const [shopData, challengeData, achievementData] = await Promise.all([
        getAllShopItems(),
        getAllChallenges(),
        getAllAchievements(),
      ]);
      setShopItems(shopData);
      setChallenges(challengeData);
      setAchievements(achievementData);

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

  const handleDelete = async () => {
    try {
      switch (deleteDialog.type) {
        case 'shop':
          await deleteShopItem(deleteDialog.id);
          break;
        case 'challenge':
          await deleteChallenge(deleteDialog.id);
          break;
        case 'achievement':
          await deleteAchievement(deleteDialog.id);
          break;
      }

      toast({
        title: 'Success',
        description: `${deleteDialog.type} deleted successfully`,
      });
      await loadData();
      setDeleteDialog({ open: false, type: '', id: '', title: '' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete item',
        variant: 'destructive',
      });
    }
  };

  const openShopItemForm = (item?: any) => {
    setEditingItem(item || null);
    setShopItemFormOpen(true);
  };

  const openChallengeForm = (challenge?: any) => {
    setEditingItem(challenge || null);
    setChallengeFormOpen(true);
  };

  const openAchievementForm = (achievement?: any) => {
    setEditingItem(achievement || null);
    setAchievementFormOpen(true);
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
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="shop" className="gap-2">
              <Package className="h-4 w-4" />
              Shop Items
            </TabsTrigger>
            <TabsTrigger value="challenges" className="gap-2">
              <Target className="h-4 w-4" />
              Challenges
            </TabsTrigger>
            <TabsTrigger value="achievements" className="gap-2">
              <Award className="h-4 w-4" />
              Achievements
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

          {/* Shop Items Tab */}
          <TabsContent value="shop">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Shop Items Management</CardTitle>
                    <CardDescription>Create and manage shop items</CardDescription>
                  </div>
                  <Button onClick={() => openShopItemForm()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingData ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading shop items...</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Icon</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shopItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-2xl">{item.item_icon}</TableCell>
                          <TableCell className="font-medium">{item.title}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{item.item_type}</Badge>
                          </TableCell>
                          <TableCell>{item.item_value}x</TableCell>
                          <TableCell>{item.price} pts</TableCell>
                          <TableCell>{item.duration_hours}h</TableCell>
                          <TableCell>
                            <Badge variant={item.is_active ? 'default' : 'secondary'}>
                              {item.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openShopItemForm(item)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  setDeleteDialog({
                                    open: true,
                                    type: 'shop',
                                    id: item.id,
                                    title: item.title,
                                  })
                                }
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
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

          {/* Challenges Tab */}
          <TabsContent value="challenges">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Challenges Management</CardTitle>
                    <CardDescription>Create and manage daily challenges</CardDescription>
                  </div>
                  <Button onClick={() => openChallengeForm()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Challenge
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingData ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading challenges...</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Reward</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {challenges.map((challenge) => (
                        <TableRow key={challenge.id}>
                          <TableCell className="font-medium">{challenge.title}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{challenge.challenge_type}</Badge>
                          </TableCell>
                          <TableCell>{challenge.target_value}</TableCell>
                          <TableCell>{challenge.reward_points} pts</TableCell>
                          <TableCell>
                            <Badge variant={challenge.is_active ? 'default' : 'secondary'}>
                              {challenge.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openChallengeForm(challenge)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  setDeleteDialog({
                                    open: true,
                                    type: 'challenge',
                                    id: challenge.id,
                                    title: challenge.title,
                                  })
                                }
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
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

          {/* Achievements Tab */}
          <TabsContent value="achievements">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Achievements Management</CardTitle>
                    <CardDescription>Create and manage player achievements</CardDescription>
                  </div>
                  <Button onClick={() => openAchievementForm()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Achievement
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingData ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading achievements...</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Badge</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Requirement</TableHead>
                        <TableHead>Reward</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {achievements.map((achievement) => (
                        <TableRow key={achievement.id}>
                          <TableCell className="text-2xl">{achievement.badge_icon}</TableCell>
                          <TableCell className="font-medium">{achievement.title}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{achievement.requirement_type}</Badge>
                            <span className="ml-2 text-muted-foreground">{achievement.requirement_value}</span>
                          </TableCell>
                          <TableCell>{achievement.points_reward} pts</TableCell>
                          <TableCell>
                            <Badge variant={achievement.is_active ? 'default' : 'secondary'}>
                              {achievement.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openAchievementForm(achievement)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  setDeleteDialog({
                                    open: true,
                                    type: 'achievement',
                                    id: achievement.id,
                                    title: achievement.title,
                                  })
                                }
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
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

        {/* Forms */}
        <ShopItemForm
          open={shopItemFormOpen}
          onOpenChange={setShopItemFormOpen}
          item={editingItem}
          onSuccess={loadData}
        />

        <ChallengeForm
          open={challengeFormOpen}
          onOpenChange={setChallengeFormOpen}
          challenge={editingItem}
          onSuccess={loadData}
        />

        <AchievementForm
          open={achievementFormOpen}
          onOpenChange={setAchievementFormOpen}
          achievement={editingItem}
          onSuccess={loadData}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{deleteDialog.title}". This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default Admin;
