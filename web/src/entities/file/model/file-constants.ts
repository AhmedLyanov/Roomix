import { PdfIcon, WordIcon, ExcelIcon, FileIcon } from "@/src/shared/icons/24";
export const FILE_TYPES = {
  pdf: {
    label: "PDF",
    icon: PdfIcon,
  },

  docx: {
    label: "DOCX",
    icon: WordIcon,
  },

  xlsx: {
    label: "XLSX",
    icon: ExcelIcon,
  },

  //   png: {
  //     label: "PNG",
  //     color: "#8B5CF6",
  //     icon: ImageIcon,
  //   },

  //   mp4: {
  //     label: "MP4",
  //     color: "#7C3AED",
  //     icon: VideoIcon,
  //   },

  default: {
    label: "FILE",
    icon: FileIcon,
  },
};
