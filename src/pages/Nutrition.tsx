import { useEffect, useState } from "react";
import { Loader2, Plus, Apple, Utensils, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navigation } from "@/components/app/Navigation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Goal = "muscle_gain" | "fat_loss" | "maintenance";

interface LoggedMeal {
  id: string;
  food_name: string;
  serving_size: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  notes: string;
  time: string;
}

interface MealPlanFood {
  item: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MealPlanMeal {
  name: string;
  time: string;
  foods: MealPlanFood[];
  meal_totals: { calories: number; protein: number; carbs: number; fat: number };
  prep_notes: string;
}

interface MealPlan {
  daily_totals: { calories: number; protein: number; carbs: number; fat: number };
  meals: MealPlanMeal[];
  tips: string[];
}

const MEALS_STORAGE_KEY = "fc_logged_meals";

const goalOptions: { id: Goal; label: string; desc: string }[] = [
  { id: "muscle_gain", label: "Build Muscle", desc: "Caloric surplus, high protein" },
  { id: "fat_loss", label: "Lose Fat", desc: "Caloric deficit, high protein" },
  { id: "maintenance", label: "Maintain", desc: "Balanced macros" },
];

export default function Nutrition() {
  const [activeTab, setActiveTab] = useState("log");
  
  // Meal logging state
  const [mealInput, setMealInput] = useState("");
  const [isLoggingMeal, setIsLoggingMeal] = useState(false);
  const [loggedMeals, setLoggedMeals] = useState<LoggedMeal[]>(() => {
    try {
      const saved = localStorage.getItem(MEALS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Meal plan state
  const [planGoal, setPlanGoal] = useState<Goal>("maintenance");
  const [targetCalories, setTargetCalories] = useState(2000);
  const [mealsPerDay, setMealsPerDay] = useState(3);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);

  useEffect(() => {
    document.title = "Nutrition — Spotter";
  }, []);

  useEffect(() => {
    localStorage.setItem(MEALS_STORAGE_KEY, JSON.stringify(loggedMeals));
  }, [loggedMeals]);

  const logMeal = async () => {
    if (!mealInput.trim() || isLoggingMeal) return;

    setIsLoggingMeal(true);
    try {
      const { data, error } = await supabase.functions.invoke("nutrition", {
        body: { type: "log_meal", description: mealInput },
      });

      if (error) throw error;

      const meal: LoggedMeal = {
        id: crypto.randomUUID(),
        ...data,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setLoggedMeals((prev) => [...prev, meal]);
      setMealInput("");
      toast.success("Meal logged!");
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Failed to log meal";
      toast.error(msg);
    } finally {
      setIsLoggingMeal(false);
    }
  };

  const removeMeal = (id: string) => {
    setLoggedMeals((prev) => prev.filter((m) => m.id !== id));
  };

  const clearAllMeals = () => {
    setLoggedMeals([]);
  };

  const generateMealPlan = async () => {
    setIsGeneratingPlan(true);
    setMealPlan(null);

    try {
      const { data, error } = await supabase.functions.invoke("nutrition", {
        body: {
          type: "generate_plan",
          goal: planGoal,
          calories: targetCalories,
          meals_per_day: mealsPerDay,
        },
      });

      if (error) throw error;
      setMealPlan(data as MealPlan);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Failed to generate plan";
      toast.error(msg);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Calculate daily totals from logged meals
  const dailyTotals = loggedMeals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein: acc.protein + meal.protein,
      carbs: acc.carbs + meal.carbs,
      fat: acc.fat + meal.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="text-center max-w-xl mx-auto mb-8">
          <h1 className="text-3xl md:text-4xl font-display tracking-tight mb-3">
            Nutrition Tracker
          </h1>
          <p className="text-muted-foreground">
            Log your meals with AI-powered calorie estimation or generate a personalized meal plan.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="log" className="gap-2">
              <Apple className="h-4 w-4" />
              Log Meals
            </TabsTrigger>
            <TabsTrigger value="plan" className="gap-2">
              <Utensils className="h-4 w-4" />
              Meal Plan
            </TabsTrigger>
          </TabsList>

          {/* Meal Logging Tab */}
          <TabsContent value="log" className="space-y-6">
            {/* Input */}
            <div className="hairline border-border rounded-xl bg-card p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  logMeal();
                }}
                className="flex gap-2"
              >
                <Input
                  value={mealInput}
                  onChange={(e) => setMealInput(e.target.value)}
                  placeholder="Describe what you ate (e.g., 'chicken breast with rice and broccoli')"
                  className="flex-1"
                  disabled={isLoggingMeal}
                />
                <Button type="submit" disabled={!mealInput.trim() || isLoggingMeal}>
                  {isLoggingMeal ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>

            {/* Daily Summary */}
            {loggedMeals.length > 0 && (
              <div className="hairline border-border rounded-xl bg-card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-medium">Today&apos;s Totals</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllMeals}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Clear all
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-display tabular text-foreground">
                      {dailyTotals.calories}
                    </div>
                    <div className="text-xs text-muted-foreground">Calories</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-display tabular text-primary">
                      {dailyTotals.protein}g
                    </div>
                    <div className="text-xs text-muted-foreground">Protein</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-display tabular text-warning">
                      {dailyTotals.carbs}g
                    </div>
                    <div className="text-xs text-muted-foreground">Carbs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-display tabular text-destructive">
                      {dailyTotals.fat}g
                    </div>
                    <div className="text-xs text-muted-foreground">Fat</div>
                  </div>
                </div>
              </div>
            )}

            {/* Logged Meals */}
            {loggedMeals.length > 0 ? (
              <div className="space-y-3">
                {loggedMeals.map((meal) => (
                  <div
                    key={meal.id}
                    className="hairline border-border rounded-xl bg-card p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium">{meal.food_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {meal.serving_size} • {meal.time}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMeal(meal.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="tabular">{meal.calories} cal</span>
                      <span className="text-primary tabular">{meal.protein}g P</span>
                      <span className="text-warning tabular">{meal.carbs}g C</span>
                      <span className="text-destructive tabular">{meal.fat}g F</span>
                    </div>
                    {meal.notes && (
                      <p className="text-xs text-muted-foreground mt-2">{meal.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Apple className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No meals logged today. Start by describing what you ate above.</p>
              </div>
            )}
          </TabsContent>

          {/* Meal Plan Tab */}
          <TabsContent value="plan" className="space-y-6">
            {!mealPlan ? (
              <div className="space-y-6">
                {/* Goal */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Goal</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {goalOptions.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => setPlanGoal(g.id)}
                        className={cn(
                          "p-4 rounded-xl hairline text-left transition-all",
                          planGoal === g.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "border-border bg-card hover:bg-muted"
                        )}
                      >
                        <div className="font-medium text-sm">{g.label}</div>
                        <div className="text-xs text-muted-foreground">{g.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Calories */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Target Calories</label>
                    <span className="text-sm text-muted-foreground tabular">
                      {targetCalories} kcal
                    </span>
                  </div>
                  <Slider
                    value={[targetCalories]}
                    onValueChange={([v]) => setTargetCalories(v)}
                    min={1200}
                    max={4000}
                    step={100}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1200</span>
                    <span>2000</span>
                    <span>3000</span>
                    <span>4000</span>
                  </div>
                </div>

                {/* Meals per day */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Meals per day</label>
                  <div className="flex gap-2">
                    {[3, 4, 5, 6].map((n) => (
                      <button
                        key={n}
                        onClick={() => setMealsPerDay(n)}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm transition-all",
                          mealsPerDay === n
                            ? "bg-primary text-primary-foreground"
                            : "bg-card hairline border-border hover:bg-muted"
                        )}
                      >
                        {n} meals
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={generateMealPlan}
                  disabled={isGeneratingPlan}
                  className="w-full h-12 text-base"
                >
                  {isGeneratingPlan ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Generating meal plan...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      Generate Meal Plan
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-display tracking-tight">Your Meal Plan</h2>
                  <Button variant="outline" onClick={() => setMealPlan(null)}>
                    New plan
                  </Button>
                </div>

                {/* Daily Totals */}
                <div className="hairline border-border rounded-xl bg-card p-4">
                  <h3 className="text-sm font-medium mb-3">Daily Totals</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-display tabular">
                        {mealPlan.daily_totals.calories}
                      </div>
                      <div className="text-xs text-muted-foreground">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-display tabular text-primary">
                        {mealPlan.daily_totals.protein}g
                      </div>
                      <div className="text-xs text-muted-foreground">Protein</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-display tabular text-warning">
                        {mealPlan.daily_totals.carbs}g
                      </div>
                      <div className="text-xs text-muted-foreground">Carbs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-display tabular text-destructive">
                        {mealPlan.daily_totals.fat}g
                      </div>
                      <div className="text-xs text-muted-foreground">Fat</div>
                    </div>
                  </div>
                </div>

                {/* Meals */}
                {mealPlan.meals.map((meal, i) => (
                  <div
                    key={i}
                    className="hairline border-border rounded-xl bg-card overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b hairline border-border bg-muted/30 flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{meal.name}</h3>
                        <div className="text-xs text-muted-foreground">{meal.time}</div>
                      </div>
                      <div className="text-sm tabular">
                        {meal.meal_totals.calories} cal
                      </div>
                    </div>
                    <div className="divide-y hairline divide-border">
                      {meal.foods.map((food, j) => (
                        <div key={j} className="px-4 py-3 flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">{food.item}</div>
                            <div className="text-xs text-muted-foreground">{food.portion}</div>
                          </div>
                          <div className="text-xs text-muted-foreground tabular">
                            {food.calories} cal • {food.protein}g P
                          </div>
                        </div>
                      ))}
                    </div>
                    {meal.prep_notes && (
                      <div className="px-4 py-2 bg-muted/20 text-xs text-muted-foreground">
                        <span className="font-medium">Prep tip:</span> {meal.prep_notes}
                      </div>
                    )}
                  </div>
                ))}

                {/* Tips */}
                {mealPlan.tips && mealPlan.tips.length > 0 && (
                  <div className="hairline border-border rounded-xl bg-card p-4">
                    <h3 className="font-medium mb-2">Tips</h3>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {mealPlan.tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
