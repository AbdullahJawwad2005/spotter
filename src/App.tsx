import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard, GuestGuard } from "@/components/app/AuthGuard";
import { Toaster } from "@/components/ui/sonner";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Calendar from "@/pages/Calendar";
import Workout from "@/pages/Workout";
import WorkoutDetail from "@/pages/WorkoutDetail";
import WorkoutSession from "@/pages/WorkoutSession";
import QuickSession from "@/pages/QuickSession";
import Chat from "@/pages/Chat";
import Settings from "@/pages/Settings";
import Trainer from "@/pages/Trainer";
import Nutrition from "@/pages/Nutrition";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" richColors />
        <Routes>
          {/* Public auth routes */}
          <Route path="/login" element={<GuestGuard><Login /></GuestGuard>} />
          <Route path="/signup" element={<GuestGuard><Signup /></GuestGuard>} />

          {/* Onboarding */}
          <Route path="/onboarding" element={<AuthGuard><Onboarding /></AuthGuard>} />

          {/* Protected routes */}
          <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
          <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
          <Route path="/calendar" element={<AuthGuard><Calendar /></AuthGuard>} />
          <Route path="/workout" element={<AuthGuard><Workout /></AuthGuard>} />
          <Route path="/workout/session/:scheduledWorkoutId" element={<AuthGuard><WorkoutSession /></AuthGuard>} />
          <Route path="/workout/:planId" element={<AuthGuard><WorkoutDetail /></AuthGuard>} />
          <Route path="/session/quick" element={<AuthGuard><QuickSession /></AuthGuard>} />
          <Route path="/chat" element={<AuthGuard><Chat /></AuthGuard>} />
          <Route path="/settings" element={<AuthGuard><Settings /></AuthGuard>} />

          {/* Unguarded extras */}
          <Route path="/trainer" element={<Trainer />} />
          <Route path="/nutrition" element={<Nutrition />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;