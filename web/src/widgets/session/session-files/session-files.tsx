"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "antd";
import { FileNotFoundIcon } from "@/src/shared/icons/24";
import { Typography } from "@/src/shared";
import {
  FileItem,
  getFileExtension,
  type FileEntity,
} from "@/src/entities/file";
import { getRoomFiles } from "@/src/entities/message";

interface Props {
  roomId: string;
}

export default function SessionFiles({ roomId }: Props) {
  const [files, setFiles] = useState<FileEntity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;

    const loadFiles = async () => {
      try {
        setLoading(true);

        const messages = await getRoomFiles(roomId);

        const fileEntities: FileEntity[] = messages
          .filter((message) => message.type === "file" && message.file)
          .map((message) => ({
            id: message._id,
            name: message.file!.originalName,
            size: message.file!.size,
            extension: getFileExtension(message.file!.originalName),
            uploadedAt: message.createdAt,
          }));

        setFiles(fileEntities);
      } catch (error) {
        console.error("Failed to load session files:", error);
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, [roomId]);

  return (
    <div
      className="
        rounded-lg
        bg-(--table-meta-bg)
        p-4
        h-[320px]
        flex
        flex-col
      "
    >
      <Typography>Files ({files.length})</Typography>

      <div className="mt-3 flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <Skeleton.Avatar active size={44} shape="square" />

                <div className="flex-1">
                  <Skeleton
                    active
                    title={{
                      width: "45%",
                    }}
                    paragraph={{
                      rows: 1,
                      width: "70%",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3">
            <FileNotFoundIcon />
            <Typography className="text-(--color-gray)">No files</Typography>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {files.map((file) => (
              <FileItem key={file.id} file={file} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
