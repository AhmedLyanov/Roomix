import { getFileType } from "../model/get-file-type";

interface Props {
  extension: string;
}

export function FileIcon({ extension }: Props) {
  const fileType = getFileType(extension);
  const Icon = fileType.icon;
  return (
    <div
      className="
        flex
        h-11
        w-11
        items-center
        justify-center
        rounded-xl
      "
    >
      <Icon />
    </div>
  );
}
