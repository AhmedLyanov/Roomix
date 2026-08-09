"use client";

import { useRouter } from "next/navigation";

import { generateSessionId } from "../lib/use-generate-session-id";

export function useCreateSession() {
  const router = useRouter();

  const createSession = () => {
    const id = generateSessionId();

    if (!sessionStorage.getItem("userName")) {
      sessionStorage.setItem(
        "userName",
        `User ${Math.floor(Math.random() * 1000)}`,
      );
    }

    router.push(`/room/${id}`);
  };

  return {
    createSession,
  };
}
