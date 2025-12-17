import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function ClerkSSOCallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background p-4">
      <Card className="w-full max-w-md p-8 shadow-elevation">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <h1 className="text-xl font-semibold">正在完成登录…</h1>
          <p className="text-sm text-muted-foreground text-center">
            如果长时间停留在此页，请返回登录页重试。
          </p>
        </div>
      </Card>

      {/* Clerk 会在此组件中处理 SSO 回调并执行跳转 */}
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/dashboard"
      />
    </div>
  );
}
