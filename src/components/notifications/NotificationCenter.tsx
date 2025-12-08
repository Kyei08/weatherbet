import { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, X, Trophy, TrendingUp, TrendingDown, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useNotifications } from '@/hooks/useNotifications';
import { 
  subscribeToPushNotifications, 
  unsubscribeFromPushNotifications,
  isPushNotificationsEnabled 
} from '@/lib/push-notifications';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'bet_won':
      return <Trophy className="h-4 w-4 text-green-500" />;
    case 'bet_lost':
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    case 'cashout':
      return <TrendingUp className="h-4 w-4 text-amber-500" />;
    case 'bonus':
    case 'achievement':
      return <Gift className="h-4 w-4 text-purple-500" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
};

export function NotificationCenter() {
  const { 
    notifications, 
    unreadCount, 
    loading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    clearAll 
  } = useNotifications();
  
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    isPushNotificationsEnabled().then(setPushEnabled);
  }, []);

  const handlePushToggle = async (enabled: boolean) => {
    setPushLoading(true);
    try {
      if (enabled) {
        const success = await subscribeToPushNotifications();
        setPushEnabled(success);
      } else {
        await unsubscribeFromPushNotifications();
        setPushEnabled(false);
      }
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                >
                  <CheckCheck className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={clearAll}
                  title="Clear all"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-muted-foreground text-sm">Loading...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-4">
              <Bell className="h-10 w-10 text-muted-foreground/50 mb-2" />
              <p className="text-muted-foreground text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "flex gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer group",
                    !notification.read && "bg-primary/5"
                  )}
                  onClick={() => {
                    if (!notification.read) {
                      markAsRead(notification.id);
                    }
                  }}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(
                        "text-sm",
                        !notification.read && "font-medium"
                      )}>
                        {notification.title}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <Separator />
        
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Push Notifications</p>
              <p className="text-xs text-muted-foreground">
                Get notified on your device
              </p>
            </div>
            <Switch 
              checked={pushEnabled} 
              onCheckedChange={handlePushToggle}
              disabled={pushLoading}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
