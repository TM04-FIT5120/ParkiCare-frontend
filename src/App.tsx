import { useEffect } from "react";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { CareEventsProvider } from "@/context/CareEventsProvider";
import { MedicationAlertProvider, useMedicationAlert } from "@/context/MedicationAlertContext";
import { NutritionCartProvider } from "@/context/NutritionCartContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { AppRoutes } from "@/routes/AppRoutes";

const NotificationBootstrap = () => {
  usePushNotifications();
  return null;
};

const MedicationAlertRouteGuard = () => {
  const { pendingAlert } = useMedicationAlert();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (pendingAlert && location.pathname !== "/home") {
      navigate("/home");
    }
  }, [pendingAlert, location.pathname, navigate]);

  return null;
};

export const App = () => (
  <MedicationAlertProvider>
    <NutritionCartProvider>
      <Toaster position="top-center" richColors />
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
          <CareEventsProvider>
            <NotificationBootstrap />
            <MedicationAlertRouteGuard />
            <AppRoutes />
          </CareEventsProvider>
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
    </NutritionCartProvider>
  </MedicationAlertProvider>
);