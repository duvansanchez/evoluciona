import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import Goals from "./pages/Goals";
import Phrases from "./pages/Phrases";
import PhrasesCategories from "./pages/PhrasesCategories";
import Audios from "./pages/Audios";
import Progress from "./pages/Progress";
import Questions from "./pages/Questions";
import QuestionsAnswer from "./pages/QuestionsAnswer";
import QuestionsAdmin from "./pages/QuestionsAdmin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/phrases" element={<Phrases />} />
            <Route path="/phrases/categories" element={<PhrasesCategories />} />
            <Route path="/audios" element={<Audios />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/questions" element={<Questions />} />
            <Route path="/questions/answer" element={<QuestionsAnswer />} />
            <Route path="/questions/admin" element={<QuestionsAdmin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
