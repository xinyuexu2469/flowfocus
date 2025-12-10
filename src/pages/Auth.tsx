import { SignIn, SignUp } from "@clerk/clerk-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 根据路径判断显示登录还是注册
  const isSignUp = location.pathname.includes('/sign-up');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background p-4">
      <Card className="w-full max-w-md p-8 shadow-elevation">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold bg-gradient-calm bg-clip-text text-transparent mb-2">
            FlowFocus
          </h1>
          <p className="text-muted-foreground">Your time management companion</p>
        </div>

        <div className="flex justify-center">
          {isSignUp ? (
            <SignUp 
              routing="path"
              path="/auth/sign-up"
              signInUrl="/auth/sign-in"
              afterSignInUrl="/dashboard"
              afterSignUpUrl="/dashboard"
              appearance={{
                elements: {
                  rootBox: "mx-auto",
                  card: "shadow-none",
                },
              }}
            />
          ) : (
            <SignIn 
              routing="path"
              path="/auth/sign-in"
              signUpUrl="/auth/sign-up"
              afterSignInUrl="/dashboard"
              afterSignUpUrl="/dashboard"
              appearance={{
                elements: {
                  rootBox: "mx-auto",
                  card: "shadow-none",
                },
              }}
            />
          )}
        </div>
      </Card>
    </div>
  );
};

export default Auth;
