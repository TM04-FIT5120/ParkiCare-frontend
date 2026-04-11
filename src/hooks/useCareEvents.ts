import { useContext } from "react";
import {
  CareEventsContext,
  type CareEventsContextValue,
} from "@/context/careEventsContext";

export const useCareEvents = (): CareEventsContextValue => {
  const ctx = useContext(CareEventsContext);
  if (!ctx) {
    throw new Error("useCareEvents must be used within CareEventsProvider");
  }
  return ctx;
};
