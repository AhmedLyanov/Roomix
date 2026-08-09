import { FILE_TYPES } from "./file-constants";

export function getFileType(extension: string) {
  return FILE_TYPES[extension as keyof typeof FILE_TYPES] ?? FILE_TYPES.default;
}
