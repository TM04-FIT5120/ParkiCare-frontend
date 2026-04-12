import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { CareEventsProvider } from "@/context/CareEventsProvider";
import { AppRoutes } from "@/routes/AppRoutes";

export const App = () => (
  <>
    <Toaster position="top-center" richColors />
    <BrowserRouter>
      <AuthProvider>
        <CareEventsProvider>
          <AppRoutes />
        </CareEventsProvider>
      </AuthProvider>
    </BrowserRouter>
  </>
);
