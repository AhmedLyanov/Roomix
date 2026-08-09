import { PluginsIcon } from "@/src/shared/icons/24";
import { Button, Typography } from "@/src/shared";
import PluginItem from "./plugin-item";

export default function Plugins() {
  return (
    <div className="">
      <div
        className=" 
        group
        w-full
        flex items-center gap-3
        rounded-lg
        px-3.5
        transition-all duration-200
        disabled:cursor-not-allowed
        disabled:opacity-50"
      >
        <PluginsIcon />
        <Typography
          variant="body"
          className="
          font-bold
          text-(--color-gray)
          transition-colors duration-200
          group-hover:text-(--color-foreground)
        "
        >
          Plugins
        </Typography>
      </div>
      <div className="flex flex-col mt-7.5 gap-7.5">
        <PluginItem title="Cyber class" />
        <PluginItem title="Cyber task" />
        <PluginItem title="Cyber course" />
      </div>
      <div className="">
        <Button variant="primary" className="ml-12.5 mt-8">
          Add +
        </Button>
      </div>
    </div>
  );
}
