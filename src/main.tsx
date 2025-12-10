import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { setClerkTokenGetter } from "@/lib/clerk-api";
import App from "./App.tsx";
import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key. Please add VITE_CLERK_PUBLISHABLE_KEY to your .env.local file.");
}

// Component to initialize token getter
function ClerkInit() {
  const { getToken } = useAuth();
  
  useEffect(() => {
    setClerkTokenGetter(getToken);
  }, [getToken]);
  
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <ClerkInit />
    </ClerkProvider>
  </StrictMode>
);
