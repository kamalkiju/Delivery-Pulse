// documents.api.ts — DocumentsPage upload and listing
import api from "./axios";

/** POST /documents/upload — multipart FormData with file + clientId */
export interface UploadDocumentResponse {
  uploadId: string;
  status: string;
}

export async function uploadDocument(
  file: File,
  clientId: string,
): Promise<UploadDocumentResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("clientId", clientId);

  const { data } = await api.post<UploadDocumentResponse>(
    "/documents/upload",
    formData,
  );
  return data;
}

/** GET /documents — table of uploaded files */
export interface DocumentRecord {
  id: string;
  fileName: string;
  client: string;
  uploaded: string;
  status: string;
}

export async function getDocuments(): Promise<DocumentRecord[]> {
  const { data } = await api.get<DocumentRecord[]>("/documents");
  return data;
}

/** GET /documents/:id/stories — stories extracted from a document */
export async function getDocumentStories(
  id: string,
): Promise<Record<string, unknown>[]> {
  const { data } = await api.get<Record<string, unknown>[]>(
    `/documents/${id}/stories`,
  );
  return data;
}
