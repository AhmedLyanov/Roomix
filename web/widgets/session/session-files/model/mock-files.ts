import type { FileEntity } from "@/entities/file";

export const mockFiles: FileEntity[] = [
  {
    id: "1",
    name: "design-system.pdf",
    extension: "pdf",
    size: 1_145_123,
    uploadedAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "meeting-notes.docx",
    extension: "docx",
    size: 523_551,
    uploadedAt: new Date().toISOString(),
  },
  {
    id: "3",
    name: "modern.xlsx",
    extension: "xlsx",
    size: 2_311_553,
    uploadedAt: new Date().toISOString(),
  },
];
