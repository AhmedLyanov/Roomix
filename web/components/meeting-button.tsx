"use client";

import { useRouter } from "next/navigation";
import React from "react";

interface MeetingButtonProps {
  icon: React.ReactNode;
  title: string;
}

export default function MeetingButton({ icon, title }: MeetingButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    const id =
      typeof crypto !== "undefined" && (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : Math.random().toString(36).slice(2, 9);
    // store a friendly name for the session if needed
    const storedName = sessionStorage.getItem("userName");
    if (!storedName)
      sessionStorage.setItem(
        "userName",
        `User ${Math.floor(Math.random() * 1000)}`,
      );
    router.push(`/room/${id}`);
  };

  return (
    <button onClick={handleClick} className="w-full">
      {React.cloneElement(icon as React.ReactElement, {})}
      <div>{title}</div>
    </button>
  );
}
