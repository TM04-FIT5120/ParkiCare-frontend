import { createContext, useContext, useState } from "react";

interface AuthUser {
  caregiverId: number;
  uniqueId: string;
  caregiverNickname: string;
}

interface PatientData {
  patientId: number;
  patientNickname: string;
  patientAge: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  patient: PatientData | null;
  login: (user: AuthUser) => void;
  setPatient: (patient: PatientData | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [patient, setPatient] = useState<PatientData | null>(null);

  const login = (user: AuthUser) => setUser(user);
  const logout = () => { setUser(null); setPatient(null); };

  return (
    <AuthContext.Provider value={{ user, patient, login, setPatient, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
