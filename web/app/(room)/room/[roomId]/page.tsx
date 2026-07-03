import { UserButton } from "@clerk/nextjs";

import { RoomControl, ShareLink } from "@/features";

import { Button } from "@/shared";

import {
  SettingsIcon,
  QuestionIcon,
  LightningIcon,
  NextIcon,
  MeetVariantOneIcon,
  MeetVariantTwoIcon,
  MeetVariantThreeIcon,
  ParticipantsIcon,
  ChatIcon,
  MagicIcon,
  RoomPluginsIcon,
} from "@/shared/icons/24";

export default async function RoomPage() {
  return (
    <div className="flex h-screen flex-col bg-(--color-background)">
      <header className="relative border-b border-(--room-header-border)">
        <div className="flex items-center justify-between px-4.5 pl-31 pt-3.25 pb-4">
          <ShareLink />

          <div className="flex items-center gap-4">
            <Button
              variant="control"
              icon={<SettingsIcon />}
            />

            <Button
              variant="control"
              icon={<QuestionIcon />}
            />

            <Button
              variant="control"
              icon={<LightningIcon />}
              badge
            />

            <div className="h-[45px] w-[45px]">
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
          </div>
        </div>

        <button
          className="
            absolute
            left-0
            bottom-0
            z-10
            flex
            w-[63px]
            translate-y-1/2
            items-center
            justify-center
            bg-(--color-background)
          "
        >
          <NextIcon />
        </button>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <div className="relative h-full px-31 py-10.75">
          <div className="absolute top-3.75 right-3.5 flex items-center gap-2">
            <button className="opacity-50 transition-opacity hover:opacity-100">
              <MeetVariantOneIcon />
            </button>

            <button className="opacity-50 transition-opacity hover:opacity-100">
              <MeetVariantTwoIcon />
            </button>

            <button>
              <MeetVariantThreeIcon />
            </button>
          </div>

          <div
            className="
              absolute
              top-22.5
              right-0
              z-20
              px-3.5
              py-5.75
              flex
              gap-7
              flex-col
              items-center
              justify-between
              rounded-l-[20px]
              bg-(--room-navigation-bg)
            "
          >
            <button className="flex items-center gap-px text-(--color-gray-light)">
              <ParticipantsIcon />

              <span className="text-[14px] leading-none">
                4
              </span>
            </button>

            <button className="text-(--color-gray-light)">
              <ChatIcon />
            </button>

            <button className="text-(--color-gray-light)">
              <MagicIcon />
            </button>

            <button className="text-(--color-gray-light)">
              <RoomPluginsIcon />
            </button>
          </div>

          <main className="h-full">
            jkjhkhj
          </main>
        </div>
      </div>

      <RoomControl />
    </div>
  );
}