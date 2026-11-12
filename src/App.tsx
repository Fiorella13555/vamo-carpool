import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { RecoveryPage } from "./features/auth/RecoveryPage";
import { WelcomePage } from "./features/auth/WelcomePage";
import { Home, Search, Car, UserRound } from "lucide-react";
import { BottomNav } from "./components/ui";
import { useAuth } from "./features/auth/AuthContext";
import { AuthProvider } from "./features/auth/AuthContext";
import { HomePage } from "./features/auth/HomePage";
import { LoginPage } from "./features/auth/LoginPage";
import { AdminRoute } from "./features/auth/AdminRoute";
import { EditProfilePage } from "./features/auth/EditProfilePage";
import { ProtectedRoute } from "./features/auth/ProtectedRoute";
import { RegisterPage } from "./features/auth/RegisterPage";
import { MyTripsPage } from "./features/trips/MyTripsPage";
import { PublishTripPage } from "./features/trips/PublishTripPage";
import { JourneySearch } from "./features/journey/JourneySearch";
import { JourneyRoomPage } from "./features/journey/JourneyRoom";
import { MyRequestsPage } from "./features/ratings/MyRequestsPage";
import { VehicleFormPage } from "./features/vehicles/VehicleFormPage";
import { AdminAlertsPage } from "./features/admin/AdminAlertsPage";
import { DesignSystemPage } from "./features/design-system/DesignSystemPage";
import { ToastProvider } from "./components/ui";
import "./App.css";
import {RequestInbox} from "./features/driver/RequestInbox";
import { BackNavigation } from "./components/BackNavigation";
import { ResumeJourney } from "./features/journey/ResumeJourney";
import { ForecastPage } from "./features/forecast/ForecastPage";
import { LiveLocationProvider } from "./features/location/LiveLocationProvider";

import {DriverLeaderboard} from "./features/driver/DriverLeaderboard";

function AppNavigation() {
 const { session, profile } = useAuth();
 const { pathname } = useLocation();
 if (pathname.startsWith("/viaje/") || !session || ["/login", "/register", "/bienvenida", "/recuperar", "/restablecer"].includes(pathname)) return null;
 const items = [{ to: "/", label: "Inicio", icon: Home }];
 if (profile?.is_passenger) items.push({ to: "/pasajero/buscar", label: "Rutas", icon: Search }, {to: "/pasajero/mis-solicitudes", label: "Viajes", icon: Car});
 if (profile?.is_driver) items.push({to:"/conductor/mis-viajes",label:"Mis rutas",icon:Car});
 items.push({to:"/perfil/editar",label:"Perfil",icon:UserRound});
 return <BottomNav items={items}/>;
}
function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <LiveLocationProvider>
        <BrowserRouter>
          <BackNavigation/>
          <Routes>
            <Route path="/conductores/ranking" element={<ProtectedRoute><DriverLeaderboard/></ProtectedRoute>}/>
            <Route path="/viaje/:tripId" element={<ProtectedRoute><JourneyRoomPage /></ProtectedRoute>} />
            <Route path="/pronosticos" element={<ProtectedRoute><ForecastPage /></ProtectedRoute>} />
            <Route path="/recuperar" element={<RecoveryPage />} />
            <Route path="/restablecer" element={<RecoveryPage reset />} />
            <Route path="/bienvenida" element={<WelcomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/perfil/editar"
              element={
                <ProtectedRoute>
                  <EditProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/alertas"
              element={
                <AdminRoute>
                  <AdminAlertsPage />
                </AdminRoute>
              }
            />
            <Route
              path="/conductor/vehiculo"
              element={
                <ProtectedRoute>
                  <VehicleFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/conductor/publicar"
              element={
                <ProtectedRoute>
                  <PublishTripPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/conductor/mis-viajes"
              element={
                <ProtectedRoute>
                  <MyTripsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pasajero/buscar"
              element={
                <ProtectedRoute>
                  <JourneySearch />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pasajero/mis-solicitudes"
              element={
                <ProtectedRoute>
                  <MyRequestsPage />
                </ProtectedRoute>
              }
            />
            {/* Solo en desarrollo: import.meta.env.DEV es false en el build de
                producción (npm run build), así que esta ruta nunca queda
                alcanzable en Vercel. */}
            {import.meta.env.DEV && <Route path="/design-system" element={<DesignSystemPage />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ResumeJourney/>
          <AppNavigation/>
          <RequestInbox/>
        </BrowserRouter>
        </LiveLocationProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
