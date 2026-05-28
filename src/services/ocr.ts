import api from "@/lib/api";

// Response shape from POST /api/ocr/drug (Qwen OCR - no Google credentials needed)
interface DrugOcrVO {
  medicineName: string;
  quantity: string;      // dosage strength / capacity, e.g. "250mg" — matches DrugOcrVO.java
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
  const response = await api.post<DrugOcrVO>("/ocr/drug", formData);
  const { medicineName, quantity, manufacturer } = response.data;
  return {
    drugName: medicineName ?? "",
    dosage: quantity ?? "",
    manufacturer: manufacturer ?? "",
  };
}
