"use client";

import {
  LoginOutlined,
  UserAddOutlined,
  FileOutlined,
} from "@ant-design/icons";
import { useSessionActions } from "@/entities/session-actions";
import { Typography } from "@/shared";

interface Props {
  sessionId: string;
}

export default function SessionActions({ sessionId }: Props) {
  const { data: actions = [], isLoading } = useSessionActions(sessionId);
  if (isLoading) {
    return (
      <div className="rounded-xl bg-(--table-meta-bg) p-6">
        <Typography variant="caption" className="mb-8 block text-[18px]">
          Action History
        </Typography>
        <div className="flex flex-col gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-[170px_40px_1fr] gap-6">
              <div className="h-4 w-20 animate-pulse rounded bg-(--color-surface-strong)" />
              <div className="h-8 w-8 animate-pulse rounded-full bg-(--color-surface-strong)" />
              <div className="space-y-2">
                <div className="h-4 w-40 animate-pulse rounded bg-(--color-surface-strong)" />
                <div className="h-3 w-24 animate-pulse rounded bg-(--color-surface-strong)" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const getActionIcon = (type: string) => {
    switch (type) {
      case "SESSION_STARTED":
        return {
          icon: <LoginOutlined />,
          bg: "bg-green-500",
          label: "Session Started",
        };

      case "PARTICIPANT_JOINED":
        return {
          icon: <UserAddOutlined />,
          bg: "bg-blue-500",
          label: "Participant Joined",
        };

      case "FILE_UPLOADED":
        return {
          icon: <FileOutlined />,
          bg: "bg-purple-500",
          label: "File Uploaded",
        };

      default:
        return {
          icon: null,
          bg: "bg-gray-400",
          label: type,
        };
    }
  };

  return (
    <div className="rounded-xl bg-(--table-meta-bg) p-6">
      <Typography variant="caption" className="mb-8 block text-[18px]">
        Action History
      </Typography>

      <div className="flex flex-col gap-8">
        {actions.map((action, index) => {
          const { icon, bg, label } = getActionIcon(action.type);

          return (
            <div
              key={action._id}
              className="grid grid-cols-[170px_40px_1fr] gap-6"
            >
              <div className="pt-1 text-right">
                <Typography
                  variant="body"
                  className="text-(--color-gray-light)"
                >
                  {new Date(action.createdAt).toLocaleTimeString()}
                </Typography>
              </div>

              <div className="relative flex justify-center">
                {index !== actions.length - 1 && (
                  <div
                    className="
                      absolute
                      top-8
                      bottom-10
                      w-px
                      bg-(--primary-border)
                    "
                  />
                )}

                <div
                  className={`
                    z-10
                    flex
                    h-8
                    w-8
                    items-center
                    justify-center
                    rounded-full
                    border
                    border-(--primary-border)
                    ${bg}
                  `}
                >
                  {icon}
                </div>
              </div>
              <div>
                <Typography
                  variant="caption"
                  className="mb-1 block text-[16px]"
                >
                  {label}
                </Typography>

                <Typography variant="body" className="text-(--color-gray)">
                  {action.type === "FILE_UPLOADED"
                    ? action.metadata?.fileName
                    : action.metadata?.ownerName ||
                      action.metadata?.userName ||
                      "User action"}
                </Typography>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
