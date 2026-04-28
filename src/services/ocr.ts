import api from "@/lib/api";

// Response shape from POST /api/ocr/drug (Qwen OCR — no Google credentials needed)
interface DrugOcrVO {
  medicineName: string;
  capacity: string;      // dosage strength, e.g. "250mg"
  manufacturer: string;
}

export interface ScanResult {
  drugName: string;
  dosage: string;
  manufacturer: string;
}

export async function scanMedicineLabel(imageFile: File): Promise<ScanResult> {
  const formData = new FormData();
  formData.append("file", imageFile);
  const response = await api.post<DrugOcrVO>(
    "/ocr/drug",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  const { medicineName, capacity, manufacturer } = response.data;
  return {
    drugName: medicineName ?? "",
    dosage: capacity ?? "",
    manufacturer: manufacturer ?? "",
  };
}
