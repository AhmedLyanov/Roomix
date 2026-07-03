import { JoinIcon, AcademyIcon, SettingsIcon } from "@/shared/icons/24";

import { ThemeSwitch } from "@/features/theme-switch/ui/theme-switch";

import { Button, Logo } from "@/shared";

import Plugins from "./plugins/plugins";

export default function Aside() {
  return (
    <aside
      className="
        relative
        flex flex-col
        h-screen
        max-w-72.5
        w-full
        p-5
        bg-(--color-neutral-500)

        after:absolute
        after:right-0
        after:top-0
        after:h-full
        after:w-px
        after:bg-(--primary-border)
      "
    >
      <div>
        <Logo />

        <div className="mt-28 flex flex-col justify-start gap-1">
          <Button icon={<JoinIcon />}>Modes</Button>

          <Button icon={<JoinIcon />}>Join</Button>

          <Button icon={<AcademyIcon />}>Academy</Button>
        </div>
      </div>

      <div
        className="
          ml-12.5
          my-9.25
          border-t
          border-(--navigation-border-line)
        "
      />

      <div className="flex flex-col gap-8">
        <Plugins />
      </div>

      <div className="mt-auto">
        <Button className="mb-4" icon={<SettingsIcon />}>
          Settings
        </Button>

        <ThemeSwitch />
      </div>
    </aside>
  );
}
