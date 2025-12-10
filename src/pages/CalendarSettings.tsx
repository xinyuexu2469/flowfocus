import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, CheckCircle2, RefreshCw, Unlink, ArrowLeft, AlertCircle, Clock, History, Settings2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function CalendarSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncFrequency, setSyncFrequency] = useState<"realtime" | "5min" | "15min" | "manual">("realtime");
  const [autoSync, setAutoSync] = useState(true);
  const [syncOnEdit, setSyncOnEdit] = useState(true);
  const [conflictResolution, setConflictResolution] = useState<"recent" | "app" | "calendar" | "ask">("recent");
  const [includePriority, setIncludePriority] = useState(true);
  const [includeTags, setIncludeTags] = useState(true);
  const [notifyOnComplete, setNotifyOnComplete] = useState(true);
  const [notifyOnError, setNotifyOnError] = useState(true);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    // TODO: Implement Google Calendar connection check via API
    setIsConnected(false);
    setLastSync(null);
  };

  const handleConnect = async () => {
    // TODO: Implement Google Calendar OAuth via API
    toast({
      variant: "destructive",
      title: "Coming Soon",
      description: "Google Calendar integration will be available soon",
    });
  };

  const handleSync = async () => {
    // TODO: Implement Google Calendar sync via API
    toast({
      variant: "destructive",
      title: "Coming Soon",
      description: "Google Calendar sync will be available soon",
    });
  };

  const handleDisconnect = async () => {
    // TODO: Implement Google Calendar disconnect via API
    setIsConnected(false);
    setLastSync(null);
    toast({
      title: "Disconnected",
      description: "Google Calendar has been disconnected",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Google Calendar Integration</h1>
          <p className="text-muted-foreground">
            Manage your Google Calendar connection and sync settings
          </p>
        </div>

        <div className="space-y-6">
          {/* Connection Status Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Connection Status</h3>
                  <p className="text-sm text-muted-foreground">
                    {isConnected ? "Your calendar is connected and syncing" : "Connect to start syncing"}
                  </p>
                </div>
              </div>
              {isConnected ? (
                <Badge variant="secondary" className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Not Connected
                </Badge>
              )}
            </div>

            {lastSync && (
              <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Last synced: {new Date(lastSync).toLocaleString()}
                </span>
              </div>
            )}

            <div className="flex gap-3">
              {!isConnected ? (
                <Button onClick={handleConnect} className="flex-1">
                  <Calendar className="w-4 h-4 mr-2" />
                  Connect Google Calendar
                </Button>
              ) : (
                <>
                  <Button 
                    onClick={handleSync} 
                    disabled={isSyncing}
                    className="flex-1"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </Button>
                  <Button 
                    onClick={handleDisconnect}
                    variant="destructive"
                    className="gap-2"
                  >
                    <Unlink className="w-4 h-4" />
                    Disconnect
                  </Button>
                </>
              )}
            </div>
          </Card>

          {/* Settings Accordion */}
          {isConnected && (
            <Card className="p-6">
              <Accordion type="multiple" defaultValue={["sync", "advanced"]} className="w-full">
                {/* Sync Settings */}
                <AccordionItem value="sync">
                  <AccordionTrigger className="text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-5 h-5" />
                      Sync Settings
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-6 pt-4">
                      {/* Auto Sync Toggle */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label htmlFor="auto-sync" className="text-base">Automatic Sync</Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically sync tasks with Google Calendar
                          </p>
                        </div>
                        <Switch
                          id="auto-sync"
                          checked={autoSync}
                          onCheckedChange={setAutoSync}
                        />
                      </div>

                      <Separator />

                      {/* Sync Frequency */}
                      <div className="space-y-2">
                        <Label htmlFor="sync-frequency" className="text-base">Sync Frequency</Label>
                        <Select value={syncFrequency} onValueChange={(v) => setSyncFrequency(v as typeof syncFrequency)}>
                          <SelectTrigger id="sync-frequency">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="realtime">Real-time (Recommended)</SelectItem>
                            <SelectItem value="5min">Every 5 minutes</SelectItem>
                            <SelectItem value="15min">Every 15 minutes</SelectItem>
                            <SelectItem value="manual">Manual only</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                          How often to sync changes between the app and Google Calendar
                        </p>
                      </div>

                      <Separator />

                      {/* Sync on Edit */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label htmlFor="sync-on-edit" className="text-base">Sync on Edit</Label>
                          <p className="text-sm text-muted-foreground">
                            Immediately sync when you edit a task or time block
                          </p>
                        </div>
                        <Switch
                          id="sync-on-edit"
                          checked={syncOnEdit}
                          onCheckedChange={setSyncOnEdit}
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Advanced Settings */}
                <AccordionItem value="advanced">
                  <AccordionTrigger className="text-lg font-semibold">
                    Advanced Settings
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-6 pt-4">
                      {/* Conflict Resolution */}
                      <div className="space-y-2">
                        <Label htmlFor="conflict-resolution" className="text-base">Conflict Resolution</Label>
                        <Select value={conflictResolution} onValueChange={(v) => setConflictResolution(v as typeof conflictResolution)}>
                          <SelectTrigger id="conflict-resolution">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="recent">Most recent edit wins</SelectItem>
                            <SelectItem value="app">Always prioritize app edits</SelectItem>
                            <SelectItem value="calendar">Always prioritize Google Calendar edits</SelectItem>
                            <SelectItem value="ask">Ask me every time</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                          How to handle when the same task is edited in both places
                        </p>
                      </div>

                      <Separator />

                      {/* Event Naming */}
                      <div className="space-y-4">
                        <Label className="text-base">Event Naming</Label>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <Label htmlFor="include-priority" className="text-sm">Include priority in event title</Label>
                              <p className="text-xs text-muted-foreground">
                                e.g., "🔴 High: Study for exam"
                              </p>
                            </div>
                            <Switch
                              id="include-priority"
                              checked={includePriority}
                              onCheckedChange={setIncludePriority}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <Label htmlFor="include-tags" className="text-sm">Include tags in event description</Label>
                              <p className="text-xs text-muted-foreground">
                                Shows all task tags in the event details
                              </p>
                            </div>
                            <Switch
                              id="include-tags"
                              checked={includeTags}
                              onCheckedChange={setIncludeTags}
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Notifications */}
                      <div className="space-y-4">
                        <Label className="text-base">Notifications</Label>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="notify-complete" className="text-sm">Notify when sync completes</Label>
                            <Switch
                              id="notify-complete"
                              checked={notifyOnComplete}
                              onCheckedChange={setNotifyOnComplete}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="notify-error" className="text-sm">Alert about sync errors</Label>
                            <Switch
                              id="notify-error"
                              checked={notifyOnError}
                              onCheckedChange={setNotifyOnError}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Sync History */}
                <AccordionItem value="history">
                  <AccordionTrigger className="text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      <History className="w-5 h-5" />
                      Sync History & Troubleshooting
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label className="text-base">Recent Sync Activity</Label>
                        <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                          {lastSync ? (
                            <div className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium">Last sync completed</p>
                                <p className="text-muted-foreground">{new Date(lastSync).toLocaleString()}</p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No recent sync activity</p>
                          )}
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label className="text-base">Troubleshooting Tools</Label>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm">
                            Test Connection
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleConnect}>
                            Re-authorize
                          </Button>
                          <Button variant="outline" size="sm">
                            Clear Cache
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Use these tools if you're experiencing sync issues
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          )}

          {/* How it Works Card */}
          <Card className="p-6 bg-muted/30">
            <h3 className="font-semibold text-lg mb-4">How it Works</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-medium">Two-Way Sync</p>
                  <p className="text-sm text-muted-foreground">
                    Changes made in the app sync to Google Calendar, and vice versa
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-medium">Time Blocks as Events</p>
                  <p className="text-sm text-muted-foreground">
                    Each time block becomes a separate calendar event with full details
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="font-medium">Multi-Day Tasks</p>
                  <p className="text-sm text-muted-foreground">
                    Tasks spanning multiple days appear in Google Tasks for each relevant day
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
