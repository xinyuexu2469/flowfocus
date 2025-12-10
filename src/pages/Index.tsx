import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Target, CheckSquare, Calendar, TrendingUp, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

const Index = () => {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate("/dashboard");
    }
  }, [isLoaded, isSignedIn, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background">
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-calm flex items-center justify-center shadow-medium">
            <Target className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-calm bg-clip-text text-transparent">
              FlowFocus
            </h1>
            <p className="text-sm text-muted-foreground">Time management for students</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-5xl font-bold leading-tight">
              Stop procrastinating.
              <br />
              <span className="bg-gradient-hero bg-clip-text text-transparent">
                Start achieving.
              </span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              FlowFocus helps college students beat procrastination with clear goals, smart task
              management, and flexible scheduling that actually works.
            </p>
          </div>

          <div className="flex gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => navigate("/auth/sign-up")}
              className="shadow-medium hover:shadow-elevation transition-all"
            >
              Get Started Free
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/auth/sign-in")}
            >
              Sign In
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-16">
            <Card className="p-6 shadow-medium hover:shadow-elevation transition-all">
              <div className="w-12 h-12 rounded-lg bg-gradient-calm flex items-center justify-center mx-auto mb-4">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Clear Goal Hierarchy</h3>
              <p className="text-sm text-muted-foreground">
                Connect daily tasks to your life goals. See the bigger picture while staying
                focused on what matters today.
              </p>
            </Card>

            <Card className="p-6 shadow-medium hover:shadow-elevation transition-all">
              <div className="w-12 h-12 rounded-lg bg-gradient-warm flex items-center justify-center mx-auto mb-4">
                <CheckSquare className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Smart Task Management</h3>
              <p className="text-sm text-muted-foreground">
                Break down overwhelming projects into manageable steps. Track priorities, deadlines,
                and progress effortlessly.
              </p>
            </Card>

            <Card className="p-6 shadow-medium hover:shadow-elevation transition-all">
              <div className="w-12 h-12 rounded-lg bg-gradient-hero flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Flexible Day Planning</h3>
              <p className="text-sm text-muted-foreground">
                Visualize your day hour-by-hour. Drag and adjust your schedule as life happens, not
                before.
              </p>
            </Card>
          </div>

          <Card className="p-8 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 shadow-medium mt-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Coming Soon: AI-Powered Features</h3>
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              AI task breakdown, smart time estimates, and personalized scheduling suggestions to
              make planning even easier.
            </p>
          </Card>
        </div>
      </main>

      <footer className="container mx-auto px-4 py-12 mt-16 border-t border-border">
        <div className="text-center text-sm text-muted-foreground">
          <p>Built for students who want to achieve more and stress less.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
