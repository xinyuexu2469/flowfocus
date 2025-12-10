import { useState, useEffect } from "react";
import { goalsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Target, TrendingUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Goal {
  id: string;
  title: string;
  tier: "life" | "stage";
  description: string | null;
}

export const GoalHierarchy = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [newTier, setNewTier] = useState<"life" | "stage">("stage");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      const data = await goalsApi.getAll() as Goal[];
      // Sort by tier, then by created_at
      const sorted = data.sort((a, b) => {
        if (a.tier !== b.tier) {
          return a.tier === 'life' ? -1 : 1;
        }
        return 0; // Keep original order for same tier
      });
      setGoals(sorted);
    } catch (error: any) {
      // Silently fail - user might not be logged in yet or API might not be available
      // Just set empty array instead of showing error
      console.log('Goals API not available:', error.message);
      setGoals([]);
    }
  };

  const addGoal = async () => {
    if (!newGoal.trim()) return;
    setLoading(true);

    try {
      await goalsApi.create({
        title: newGoal,
        tier: newTier,
      });

      setNewGoal("");
      setNewTier("stage");
      fetchGoals();
      toast({
        title: "Success",
        description: "Goal added successfully",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add goal",
      });
    }

    setLoading(false);
  };

  const deleteGoal = async (id: string) => {
    try {
      await goalsApi.delete(id);
      fetchGoals();
      toast({
        title: "Success",
        description: "Goal deleted",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete goal",
      });
    }
  };

  const lifeGoals = goals.filter((g) => g.tier === "life");
  const stageGoals = goals.filter((g) => g.tier === "stage");

  return (
    <div className="space-y-6">
      <Card className="p-6 shadow-medium">
        <h3 className="text-xl font-semibold mb-4">Add New Goal</h3>
        <div className="flex gap-3">
          <Input
            placeholder="What do you want to achieve?"
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && addGoal()}
            className="flex-1"
          />
          <Select value={newTier} onValueChange={(v: any) => setNewTier(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="life">Life Goal</SelectItem>
              <SelectItem value="stage">Stage Goal</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={addGoal} disabled={loading}>
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6 shadow-medium border-l-4 border-l-primary">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-calm flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold">Life Goals</h3>
            <Badge variant="secondary">{lifeGoals.length}</Badge>
          </div>
          <div className="space-y-3">
            {lifeGoals.map((goal) => (
              <div
                key={goal.id}
                className="p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium flex-1">{goal.title}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteGoal(goal.id)}
                    className="text-destructive hover:text-destructive -mt-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {lifeGoals.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No life goals yet. What's your long-term vision?
              </p>
            )}
          </div>
        </Card>

        <Card className="p-6 shadow-medium border-l-4 border-l-accent">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-warm flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold">Stage Goals</h3>
            <Badge variant="secondary">{stageGoals.length}</Badge>
          </div>
          <div className="space-y-3">
            {stageGoals.map((goal) => (
              <div
                key={goal.id}
                className="p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium flex-1">{goal.title}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteGoal(goal.id)}
                    className="text-destructive hover:text-destructive -mt-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {stageGoals.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No stage goals yet. What milestones will get you there?
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
