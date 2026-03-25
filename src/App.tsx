import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import { ThemeProvider } from "./components/theme-provider";
import WelcomeModal from "./components/notifications/WelcomeModal";
import Index from "./pages/Index";
import Goals from "./pages/Goals";
import Phrases from "./pages/Phrases";
import PhrasesCategories from "./pages/PhrasesCategories";
import Progress from "./pages/Progress";
import Questions from "./pages/Questions";
import QuestionsAnswer from "./pages/QuestionsAnswer";
import QuestionsAdmin from "./pages/QuestionsAdmin";
import Rutina from "./pages/Rutina";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <WelcomeModal />
          <Layout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/phrases" element={<Phrases />} />
              <Route path="/phrases/categories" element={<PhrasesCategories />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/questions" element={<Questions />} />
              <Route path="/questions/answer" element={<QuestionsAnswer />} />
              <Route path="/questions/admin" element={<QuestionsAdmin />} />
              <Route path="/rutina" element={<Rutina />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
