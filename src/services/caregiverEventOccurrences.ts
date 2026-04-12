import api from "@/lib/api";
import type { EventOccurrenceSourceType } from "@/lib/eventRecurrence";

export interface CaregiverEventOccurrenceDto {
  id: number | null;
  caregiverId: number;
  sourceType: EventOccurrenceSourceType;
  sourceId: number;
  occurrenceStart: string;
  completed: number;
}

export async function listCaregiverEventOccurrences(
  caregiverId: number,
  from: string,
  to: string,
): Promise<CaregiverEventOccurrenceDto[]> {
  const res = await api.get<CaregiverEventOccurrenceDto[]>("/caregiver-event-occurrences", {
    params: { caregiverId, from, to },
  });
  return res.data;
}

export async function upsertCaregiverEventOccurrence(body: {
  caregiverId: number;
  sourceType: EventOccurrenceSourceType;
  sourceId: number;
  occurrenceStart: string;
  completed: boolean;
}): Promise<CaregiverEventOccurrenceDto> {
  const res = await api.put<CaregiverEventOccurrenceDto>("/caregiver-event-occurrences", body);
  return res.data;
}
