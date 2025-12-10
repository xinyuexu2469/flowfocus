import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useGoogleCalendarStore } from "@/stores/googleCalendarStore";
import { getApiClient } from "@/lib/clerk-api";
import { Loader2 } from "lucide-react";

export const CalendarOAuthHandler = () => {
  const { toast } = useToast();
  const { checkConnectionStatus, syncNow } = useGoogleCalendarStore();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      // 处理用户拒绝授权
      if (error) {
        toast({
          variant: "destructive",
          title: "授权取消",
          description: "您取消了 Google Calendar 授权",
        });
        // 清理 URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      // 处理授权成功
      if (code) {
        setIsProcessing(true);
        
        try {
          const api = getApiClient();
          
          // 调用后端 API 交换授权码为 tokens
          const response = await api.googleCalendar.handleCallback(code) as { success: boolean };
          
          if (response.success) {
            // 更新连接状态
            await checkConnectionStatus();
            
            // 自动触发首次同步
            toast({
              title: "连接成功！",
              description: "正在同步 Google Calendar 事件...",
            });
            
            const syncResult = await syncNow();
            
            toast({
              title: "同步完成",
              description: `已同步 ${(syncResult as any).synced} 个事件`,
            });
          }
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "连接失败",
            description: error.message || "无法连接到 Google Calendar",
          });
        } finally {
          setIsProcessing(false);
          // 清理 URL 参数
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    };

    handleOAuthCallback();
  }, [toast, checkConnectionStatus, syncNow]);

  // 显示加载状态
  if (isProcessing) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-card p-6 rounded-lg shadow-lg flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-lg font-medium">正在连接 Google Calendar...</p>
          <p className="text-sm text-muted-foreground">请稍候</p>
        </div>
      </div>
    );
  }

  return null;
};
