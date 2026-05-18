import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { CareEventsPage } from "@/pages/CareEventsPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { DigitalRecordsPage } from "@/pages/DigitalRecordsPage";
// import { GuidePage } from "@/pages/GuidePage";
import { LoadingScreenPage } from "@/pages/LoadingScreenPage";
import { LoginPage } from "@/pages/LoginPage";
import { NutritionLibraryPage } from "@/pages/NutritionLibraryPage";
import { RecipesPage } from "@/pages/RecipesPage";
import { PatientSetupPage } from "@/pages/PatientSetupPage";
import { PerkinsDetailsPage } from "@/pages/PerkinsDetailsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { RegisterPage } from "@/pages/RegisterPage";

export const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<LoadingScreenPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/patient-setup" element={<PatientSetupPage />} />
    <Route path="/profile" element={<ProfilePage />} />
    <Route element={<AppLayout />}>
      <Route path="/home" element={<DashboardPage />} />
      {/* <Route path="/guide" element={<GuidePage />} /> */}
      <Route path="/knowledge-hub" element={<PerkinsDetailsPage />} />
      <Route path="/care-events" element={<CareEventsPage />} />
      <Route path="/digital-records" element={<DigitalRecordsPage />} />
      <Route path="/nutrition-library" element={<NutritionLibraryPage />} />
      <Route path="/recipes" element={<RecipesPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
