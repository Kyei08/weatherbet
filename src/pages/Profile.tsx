import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { getUser, updateUsername, getProfile, updateProfile } from '@/lib/supabase-auth-storage';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, User, Bell, Volume2, Vibrate, Shield, LogOut, Save, Loader2, Camera, Sun, Moon, Monitor } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm';

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const {
    preferences,
    setSoundEnabled,
    setHapticsEnabled,
    setNotifyOnWins,
    setNotifyOnLosses,
    setNotifyOnCashouts,
  } = useUserPreferences();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState('');
  const [originalUsername, setOriginalUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [originalBio, setOriginalBio] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [points, setPoints] = useState(0);
  const [level, setLevel] = useState(1);

  useEffect(() => {
    const load = async () => {
      try {
        const [u, profile] = await Promise.all([getUser(), getProfile()]);
        if (u) {
          setUsername(u.username);
          setOriginalUsername(u.username);
          setPoints(u.points);
          setLevel(u.level);
        }
        if (profile?.avatar_url) {
          setAvatarUrl(profile.avatar_url);
        }
      } catch (e) {
        console.error('Failed to load user:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSaveUsername = async () => {
    if (!username.trim() || username === originalUsername) return;
    setSaving(true);
    try {
      await updateUsername(username.trim());
      setOriginalUsername(username.trim());
      toast.success('Username updated!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to update username');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only JPG, PNG and WebP are supported');
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${ext}`;

      // Upload (upsert to replace existing)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Add cache-busting param
      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;

      // Save to profile
      await updateProfile({ avatar_url: urlWithCacheBust });
      setAvatarUrl(urlWithCacheBust);
      toast.success('Avatar updated!');
    } catch (e: any) {
      console.error('Avatar upload error:', e);
      toast.error(e.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const hasUsernameChanged = username.trim() !== originalUsername;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold truncate">Profile & Settings</h1>
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 pb-24 space-y-4 max-w-lg mx-auto"
      >
        {/* Profile Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-primary" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="relative h-16 w-16 rounded-full shrink-0 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                    {username.charAt(0).toUpperCase()}
                  </div>
                )}
                {/* Overlay */}
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploadingAvatar ? (
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5 text-white" />
                  )}
                </div>
                {uploadingAvatar && (
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  </div>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <div className="min-w-0">
                <p className="font-semibold truncate">{username}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="text-xs text-primary font-medium mt-0.5 hover:underline"
                >
                  {uploadingAvatar ? 'Uploading…' : 'Change photo'}
                </button>
              </div>
            </div>

            <Separator />

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-2xl font-bold text-primary">{points.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Points</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-2xl font-bold text-primary">{level}</p>
                <p className="text-xs text-muted-foreground">Level</p>
              </div>
            </div>

            <Separator />

            {/* Username edit */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm">Username</Label>
              <div className="flex gap-2">
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="min-h-[44px]"
                  maxLength={20}
                />
                <Button
                  size="icon"
                  onClick={handleSaveUsername}
                  disabled={!hasUsernameChanged || saving}
                  className="min-h-[44px] min-w-[44px] shrink-0"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sun className="h-4 w-4 text-primary" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ThemeSelector />
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-primary" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SettingToggle
              icon={<Volume2 className="h-4 w-4" />}
              label="Sound Effects"
              description="Play sounds for bet results"
              checked={preferences.soundEnabled}
              onCheckedChange={setSoundEnabled}
            />
            <SettingToggle
              icon={<Vibrate className="h-4 w-4" />}
              label="Haptic Feedback"
              description="Vibrate on interactions"
              checked={preferences.hapticsEnabled}
              onCheckedChange={setHapticsEnabled}
            />

            <Separator />

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notify me about</p>

            <SettingToggle
              label="Wins"
              checked={preferences.notifyOnWins}
              onCheckedChange={setNotifyOnWins}
            />
            <SettingToggle
              label="Losses"
              checked={preferences.notifyOnLosses}
              onCheckedChange={setNotifyOnLosses}
            />
            <SettingToggle
              label="Cashouts"
              checked={preferences.notifyOnCashouts}
              onCheckedChange={setNotifyOnCashouts}
            />
          </CardContent>
        </Card>

        {/* Change Password */}
        <ChangePasswordForm />

        {/* Account Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start min-h-[44px]"
              onClick={() => navigate('/transactions')}
            >
              💳 Transaction History
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start min-h-[44px]"
              onClick={() => navigate('/purchase-history')}
            >
              🛒 Purchase History
            </Button>
            <Separator />
            <Button
              variant="destructive"
              className="w-full min-h-[44px]"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

/* Theme selector */
function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: 'light', icon: <Sun className="h-4 w-4" />, label: 'Light' },
    { value: 'dark', icon: <Moon className="h-4 w-4" />, label: 'Dark' },
    { value: 'system', icon: <Monitor className="h-4 w-4" />, label: 'System' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={`flex flex-col items-center gap-1.5 rounded-lg p-3 min-h-[44px] transition-colors border ${
            theme === opt.value
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
          }`}
        >
          {opt.icon}
          <span className="text-xs font-medium">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

/* Reusable toggle row */
function SettingToggle({
  icon,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  icon?: React.ReactNode;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-[44px]">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export default Profile;
