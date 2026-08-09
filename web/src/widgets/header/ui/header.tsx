"use client";

import clsx from "clsx";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

import { ChevronDown } from "lucide-react";

import { Dropdown, Typography, Input, Button } from "@/src/shared";

import {
  ChannelsIcon,
  QuestionIcon,
  LightningIcon,
} from "@/src/shared/icons/24";

export default function Header() {
  return (
    <header
      className="
        border-b
        border-(--primary-border)
        pl-[75px]
        px-5.5
        pb-4
        pt-4.5
      "
    >
      <div className="flex items-center justify-between">
        {/* Left side */}
        <Dropdown
          trigger={(open) => (
            <div className="flex items-center gap-2">
              <ChannelsIcon />

              <Typography variant="navigation">Channels</Typography>

              <ChevronDown
                size={16}
                strokeWidth={3}
                className={clsx(
                  `
                  text-(--color-gray)
                  transition-transform
                  duration-200
                  flex-shrink-0
                  `,
                  open && "rotate-180",
                )}
              />
            </div>
          )}
        >
          <div className="p-2">Канал 1</div>
          <div className="p-2">Канал 2</div>
          <div className="p-2">Канал 3</div>
        </Dropdown>

        {/* Right side */}
        <div className="flex items-center">
          <Input />

          <div className="ml-[40px] flex items-center gap-4">
            <Show when="signed-out">
              <div className="flex items-center gap-3">
                <SignInButton>
                  <button
                    className="
                      rounded-lg
                      border
                      border-(--primary-border)
                      px-4
                      py-2
                      text-sm
                      font-medium
                      text-(--color-gray)
                      transition
                      hover:bg-(--color-surface-muted)
                    "
                  >
                    Sign In
                  </button>
                </SignInButton>

                <SignUpButton>
                  <button
                    className="
                      rounded-lg
                      bg-(--color-accent)
                      px-4
                      py-2
                      text-sm
                      font-medium
                      text-(--button-primary-text)
                      transition
                      hover:bg-(--color-accent-hover)
                    "
                  >
                    Sign Up
                  </button>
                </SignUpButton>
              </div>
            </Show>

            <Show when="signed-in">
              <>
                <Button variant="control" icon={<QuestionIcon />} />

                <Button variant="control" icon={<LightningIcon />} badge />

                <div className="h-[45px] w-[45px] overflow-hidden rounded-full">
                  <UserButton
                    appearance={{
                      elements: {
                        avatarBox: "w-[45px] h-[45px]",
                        userButtonAvatarBox: "w-[45px] h-[45px]",
                        userButtonTrigger:
                          "w-[45px] h-[45px] rounded-full overflow-hidden",
                      },
                    }}
                  />
                </div>
              </>
            </Show>
          </div>
        </div>
      </div>
    </header>
  );
}
