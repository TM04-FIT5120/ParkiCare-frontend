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

const AUTH_USER_KEY = "parkicare_user";
const AUTH_PATIENT_KEY = "parkicare_patient";

function loadFromStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => loadFromStorage<AuthUser>(AUTH_USER_KEY));
  const [patient, setPatientState] = useState<PatientData | null>(() => loadFromStorage<PatientData>(AUTH_PATIENT_KEY));

  const login = (userData: AuthUser) => {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
    setUser(userData);
  };

  const setPatient = (patientData: PatientData | null) => {
    if (patientData) {
      localStorage.setItem(AUTH_PATIENT_KEY, JSON.stringify(patientData));
    } else {
      localStorage.removeItem(AUTH_PATIENT_KEY);
    }
    setPatientState(patientData);
  };

  const logout = () => {
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_PATIENT_KEY);
    setUser(null);
    setPatientState(null);
  };

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
