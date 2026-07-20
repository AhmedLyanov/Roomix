"use client";

import { DownloadIcon } from "@/shared/icons/24";
import { Typography } from "@/shared";

import { FileIcon } from "./file-icon";

import { FileEntity } from "../model/files-types";
import { formatFileSize } from "../lib/format-file-size";
import { formatFileDate } from "../lib/format-file-date";
import { getFileType } from "../model/get-file-type";

interface Props {
  file: FileEntity;
  onDownload?: (file: FileEntity) => void;
  onMore?: (file: FileEntity) => void;
}

export function FileItem({ file, onDownload }: Props) {
  const fileType = getFileType(file.extension);

  return (
    <div
      className="
        group
        flex
        items-center
        justify-between
        rounded-xl
        px-3
        py-2
        transition-colors

        hover:bg-(--plugin-item-bg-hover)
      "
    >
      <div className="flex items-center gap-3">
        <FileIcon extension={file.extension} />

        <div className="flex flex-col">
          <Typography
            variant="body"
            className="font-semibold text-(--color-foreground)"
          >
            {file.name}
          </Typography>

          <div className="flex items-center gap-2">
            <Typography
              variant="caption"
              className="uppercase text-(--color-gray)"
            >
              {fileType.label}
            </Typography>

            <span className="text-(--color-gray-light)">•</span>

            <Typography variant="caption" className="text-(--color-gray)">
              {formatFileSize(file.size)}
            </Typography>

            <span className="text-(--color-gray-light)">•</span>

            <Typography variant="caption" className="text-(--color-gray)">
              {formatFileDate(file.uploadedAt)}
            </Typography>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => onDownload?.(file)}
          className="
            rounded-lg
            p-2
            text-(--color-gray)

            hover:bg-(--button-hover-bg)
            hover:text-(--color-foreground)
          "
        >
          <DownloadIcon />
        </button>
      </div>
    </div>
  );
}
