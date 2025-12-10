import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useGoogleCalendarStore } from "@/stores/googleCalendarStore";
import { getApiClient } from "@/lib/clerk-api";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function GoogleCalendarCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { checkConnectionStatus, syncNow } = useGoogleCalendarStore();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('正在连接 Google Calendar...');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      // 处理用户拒绝授权
      if (error) {
        setStatus('error');
        setMessage('授权已取消');
        toast({
          variant: "destructive",
          title: "授权取消",
          description: "您取消了 Google Calendar 授权",
        });
        
        // 3秒后返回 Dashboard
        setTimeout(() => navigate('/dashboard'), 3000);
        return;
      }

      // 处理授权成功
      if (code) {
        try {
          setMessage('正在验证授权...');
          const api = getApiClient();
          
          // 调用后端 API 交换授权码为 tokens
          const response = await api.googleCalendar.handleCallback(code) as { success: boolean };
          
          if (response.success) {
            setMessage('连接成功！正在同步事件...');
            
            // 更新连接状态
            await checkConnectionStatus();
            
            // 自动触发首次同步
            const syncResult = await syncNow();
            
            setStatus('success');
            setMessage(`同步完成！已同步 ${(syncResult as any).synced} 个事件`);
            
            toast({
              title: "Google Calendar 已连接",
              description: `成功同步 ${(syncResult as any).synced} 个事件`,
            });
            
            // 2秒后返回 Dashboard
            setTimeout(() => navigate('/dashboard'), 2000);
          }
        } catch (error: any) {
          setStatus('error');
          setMessage(error.message || '连接失败');
          
          toast({
            variant: "destructive",
            title: "连接失败",
            description: error.message || "无法连接到 Google Calendar",
          });
          
          // 3秒后返回 Dashboard
          setTimeout(() => navigate('/dashboard'), 3000);
        }
      } else {
        // 没有 code 参数，直接返回
        setStatus('error');
        setMessage('无效的回调请求');
        setTimeout(() => navigate('/dashboard'), 2000);
      }
    };

    handleOAuthCallback();
  }, [navigate, toast, checkConnectionStatus, syncNow]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex items-center justify-center">
      <div className="bg-card p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="flex flex-col items-center gap-4">
          {status === 'processing' && (
            <>
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <h2 className="text-xl font-semibold">连接中...</h2>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 text-green-500" />
              <h2 className="text-xl font-semibold text-green-600">连接成功！</h2>
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="w-12 h-12 text-red-500" />
              <h2 className="text-xl font-semibold text-red-600">连接失败</h2>
            </>
          )}
          
          <p className="text-muted-foreground text-center">{message}</p>
          
          {status !== 'processing' && (
            <p className="text-sm text-muted-foreground">
              即将返回主页...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

