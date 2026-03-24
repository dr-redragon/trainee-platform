import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Login from "./pages/Login";
import SpecialtyDetail from "./pages/SpecialtyDetail";
import KeyContacts from "./pages/KeyContacts";
import AdminPanel from "./pages/AdminPanel";
import MyProfile from "./pages/MyProfile";
import CommunityHub from "./pages/CommunityHub";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/specialty/:id" element={<SpecialtyDetail />} />
          <Route path="/contacts" element={<KeyContacts />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/profile" element={<MyProfile />} />
          <Route path="/community" element={<CommunityHub />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
