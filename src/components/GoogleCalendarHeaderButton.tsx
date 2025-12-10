import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useGoogleCalendarStore } from "@/stores/googleCalendarStore";
import { formatDistanceToNow } from "date-fns";
import { 
  Calendar, 
  RefreshCw, 
  Unlink, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const GoogleCalendarHeaderButton = () => {
  const { 
    isConnected, 
    isSyncing, 
    lastSyncTime,
    syncError,
    checkConnectionStatus,
    connect,
    disconnect,
    syncNow
  } = useGoogleCalendarStore();
  
  const { toast } = useToast();

  useEffect(() => {
    checkConnectionStatus();
  }, [checkConnectionStatus]);

  const handleConnect = async () => {
    try {
      const authUrl = await connect();
      // 在新窗口打开授权页面
      window.location.href = authUrl;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "连接失败",
        description: error.message || "无法连接到 Google Calendar",
      });
    }
  };

  const handleSync = async () => {
    try {
      const result = await syncNow();
      toast({
        title: "同步成功",
        description: `已同步 ${(result as any).synced} 个事件`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "同步失败",
        description: error.message || "无法同步 Google Calendar",
      });
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("确定要断开 Google Calendar 连接吗？")) return;
    
    try {
      await disconnect();
      toast({
        title: "已断开连接",
        description: "Google Calendar 已断开连接",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "断开失败",
        description: error.message || "无法断开连接",
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={isConnected ? "default" : "outline"} 
          size="sm" 
          className="relative"
        >
          <Calendar className="w-4 h-4 mr-2" />
          Google Calendar
          {isConnected && (
            <Badge 
              variant="secondary" 
              className="ml-2 h-5 px-1.5 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
            >
              <CheckCircle2 className="w-3 h-3" />
            </Badge>
          )}
          {!isConnected && (
            <Badge 
              variant="secondary" 
              className="ml-2 h-5 px-1.5 text-xs bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
            >
              <AlertCircle className="w-3 h-3" />
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="font-medium">Google Calendar</span>
            {isConnected && (
              <Badge variant="secondary" className="text-xs">
                Connected
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isConnected 
              ? "Sync your tasks automatically" 
              : "Connect to sync tasks with Google Calendar"
            }
          </p>
          {lastSyncTime && (
            <p className="text-xs text-muted-foreground mt-1">
              上次同步: {formatDistanceToNow(lastSyncTime, { addSuffix: true, locale: undefined })}
            </p>
          )}
          {syncError && (
            <p className="text-xs text-red-500 mt-1">
              错误: {syncError}
            </p>
          )}
        </div>
        
        <DropdownMenuSeparator />
        
        {!isConnected ? (
          <DropdownMenuItem onClick={handleConnect}>
            <Calendar className="w-4 h-4 mr-2" />
            Connect Calendar
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem 
              onClick={handleSync} 
              disabled={isSyncing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleDisconnect}
              className="text-destructive focus:text-destructive"
            >
              <Unlink className="w-4 h-4 mr-2" />
              Disconnect
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
