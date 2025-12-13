import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ClerkSSOCallback from "./pages/ClerkSSOCallback";
import Dashboard from "./pages/Dashboard";
import CalendarSettings from "./pages/CalendarSettings";
import GoogleCalendarCallback from "./pages/GoogleCalendarCallback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />

          {/* Clerk SSO callback routes (must not render SignIn/SignUp directly) */}
          <Route path="/auth/sign-in/sso-callback" element={<ClerkSSOCallback />} />
          <Route path="/auth/sign-up/sso-callback" element={<ClerkSSOCallback />} />
          <Route path="/auth/sso-callback" element={<ClerkSSOCallback />} />

          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/*" element={<Auth />} />
          <Route 
            path="/dashboard" 
            element={
              <>
                <SignedIn>
                  <Dashboard />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </>
            } 
          />
          <Route 
            path="/calendar-settings" 
            element={
              <>
                <SignedIn>
                  <CalendarSettings />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </>
            } 
          />
          <Route 
            path="/auth/google/callback" 
            element={
              <>
                <SignedIn>
                  <GoogleCalendarCallback />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </>
            } 
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
