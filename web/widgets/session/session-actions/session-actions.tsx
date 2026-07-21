"use client";

import {
  LoginOutlined,
  LogoutOutlined,
  MessageOutlined,
  UploadOutlined,
  UserAddOutlined,
} from "@ant-design/icons";

import { Typography } from "@/shared";

const mockActions = [
  {
    id: 1,
    time: "11:59:23 PM",
    color: "#22C55E",
    icon: <LoginOutlined />,
    title: "Session started",
    description: "Henry Allen started the session",
  },
  {
    id: 2,
    time: "12:00:05 AM",
    color: "#3B82F6",
    icon: <UserAddOutlined />,
    title: "Participant joined",
    description: "Sophie Lee joined the session",
  },
  {
    id: 3,
    time: "12:00:27 AM",
    color: "#8B5CF6",
    icon: <UploadOutlined />,
    title: "File uploaded",
    description: 'File "design-system.pdf" uploaded by Sophie Lee',
  },
  {
    id: 4,
    time: "12:15:42 AM",
    color: "#F59E0B",
    icon: <MessageOutlined />,
    title: "Chat message",
    description: "Henry Allen sent a message",
  },
  {
    id: 5,
    time: "01:59:20 AM",
    color: "#EF4444",
    icon: <LogoutOutlined />,
    title: "Session ended",
    description: "Meeting finished successfully",
  },
];

export default function SessionActions() {
  return (
    <div className="rounded-xl bg-(--table-meta-bg) p-6">
      <Typography variant="caption" className="mb-8 block text-[18px]">
        Action History
      </Typography>

      <div className="flex flex-col gap-8">
        {mockActions.map((action, index) => (
          <div
            key={action.id}
            className="grid grid-cols-[170px_40px_1fr] gap-6"
          >
            {/* Time */}
            <div className="pt-1 text-right">
              <Typography variant="body" className="text-(--color-gray-light)">
                {action.time}
              </Typography>
            </div>

            {/* Timeline */}
            <div className="relative flex justify-center">
              {index !== mockActions.length - 1 && (
                <div
                  className="
                    absolute
                    top-8
                    bottom-[-40px]
                    w-px
                    bg-(--primary-border)
                  "
                />
              )}

              <div
                className="
                  z-10
                  flex
                  h-8
                  w-8
                  items-center
                  justify-center
                  rounded-full
                  border
                  border-(--primary-border)
                  bg-(--color-background)
                "
                style={{
                  color: action.color,
                }}
              >
                {action.icon}
              </div>
            </div>

            <div>
              <Typography variant="caption" className="mb-1 block text-[16px]">
                {action.title}
              </Typography>

              <Typography variant="body" className="text-(--color-gray)">
                {action.description}
              </Typography>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
