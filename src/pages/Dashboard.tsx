import { useState } from "react";
import { useUser, useAuth } from "@clerk/clerk-react";
import { useToast } from "@/hooks/use-toast";
import { DateBasedTaskList } from "@/components/DateBasedTaskList";
import { GoalHierarchy } from "@/components/GoalHierarchy";
import { UnifiedDailyGantt } from "@/components/DailyGantt/UnifiedDailyGantt";
import { MonthlyGanttView } from "@/components/MonthlyGantt/MonthlyGanttView";
import { GoogleCalendarHeaderButton } from "@/components/GoogleCalendarHeaderButton";
import { CalendarView } from "@/components/Calendar/CalendarView";
import { AIChatAssistant } from "@/components/AIChatAssistant";
import { AIPlanningAssistant } from "@/components/AIPlanningAssistant";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserButton, SignOutButton } from "@clerk/clerk-react";
import { Target, CheckSquare, Calendar, CalendarDays, Settings, Clock, BarChart3, LayoutGrid, Bot } from "lucide-react";
import { KanbanView } from "@/components/KanbanView";
import { Button } from "@/components/ui/button";

const Dashboard = () => {
  const { user, isLoaded } = useUser();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [refreshTasks, setRefreshTasks] = useState(0);
  const [aiPlanningOpen, setAIPlanningOpen] = useState(false);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background overflow-x-hidden">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-calm flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-calm bg-clip-text text-transparent">
                FlowFocus
              </h1>
              <p className="text-xs text-muted-foreground">Time management made simple</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setAIPlanningOpen(true)}
              variant="default"
              className="gap-2"
            >
              <Bot className="w-4 h-4" />
              AI Planning Assistant
            </Button>
            <GoogleCalendarHeaderButton />
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 min-h-screen">
        <div className="mb-4">
          <h2 className="text-3xl font-bold mb-2">
            Welcome back{user?.firstName ? `, ${user.firstName}` : user?.primaryEmailAddress?.emailAddress ? `, ${user.primaryEmailAddress.emailAddress.split('@')[0]}` : ""}!
          </h2>
          <p className="text-muted-foreground">
            Let's make today productive and focused.
          </p>
        </div>

        <Tabs defaultValue="tasks" className="space-y-4 pb-4">
          <TabsList className="grid w-full max-w-6xl grid-cols-7">
            <TabsTrigger value="goals" className="gap-2">
              <Target className="w-4 h-4" />
              Goals
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2">
              <CheckSquare className="w-4 h-4" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="kanban" className="gap-2">
              <LayoutGrid className="w-4 h-4" />
              Kanban
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="w-4 h-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="daily-gantt" className="gap-2">
              <Clock className="w-4 h-4" />
              Daily Gantt
            </TabsTrigger>
            <TabsTrigger value="monthly-gantt" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Monthly Gantt
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="goals" className="space-y-6 min-h-[calc(100vh-16rem)] pb-8">
            <GoalHierarchy />
          </TabsContent>

          <TabsContent value="tasks" className="space-y-6 min-h-[calc(100vh-16rem)] pb-8">
            <DateBasedTaskList />
          </TabsContent>

          <TabsContent value="kanban" className="space-y-6 min-h-[calc(100vh-16rem)] pb-8">
            <KanbanView />
          </TabsContent>

          <TabsContent value="calendar" className="mt-0 h-[calc(100vh-13rem)]">
            <CalendarView />
          </TabsContent>

          <TabsContent value="daily-gantt" className="space-y-0 h-[calc(100vh-13rem)]">
            <UnifiedDailyGantt />
          </TabsContent>

          <TabsContent value="monthly-gantt" className="space-y-0 h-[calc(100vh-13rem)]">
            <MonthlyGanttView />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6 min-h-[calc(100vh-16rem)] pb-8">
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Settings</h3>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Configure your preferences and integrations.
                </p>
                
                {/* Placeholder for future settings */}
                <div className="grid gap-4">
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium mb-2">Notifications</h4>
                    <p className="text-sm text-muted-foreground">
                      Manage your notification preferences (coming soon)
                    </p>
                  </div>
                  
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium mb-2">Time Zone</h4>
                    <p className="text-sm text-muted-foreground">
                      Set your preferred time zone (coming soon)
                    </p>
                  </div>
                  
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium mb-2">Theme</h4>
                    <p className="text-sm text-muted-foreground">
                      Choose between light and dark themes (coming soon)
                    </p>
                  </div>
                  
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium mb-2">Data Export</h4>
                    <p className="text-sm text-muted-foreground">
                      Export your tasks and calendar data (coming soon)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <AIChatAssistant />
        <AIPlanningAssistant
          open={aiPlanningOpen}
          onOpenChange={setAIPlanningOpen}
          onSuccess={() => {
            setRefreshTasks((prev) => prev + 1);
            toast({
              title: "✅ Schedule Created",
              description: "All tasks and time blocks have been successfully added to your schedule",
            });
          }}
        />
      </main>
    </div>
  );
};

export default Dashboard;
