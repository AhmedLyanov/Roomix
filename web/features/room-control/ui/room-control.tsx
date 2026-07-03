import {
  MicroIcon,
  SoundOnIcon,
  WebCameraIcon,
  CloseMeetIcon,
  ShareVideoIcon,
  StartRecordIcon,
  SmileIcon,
} from "@/shared/icons/24";

export function RoomControl() {
  return (
    <div className="flex justify-center items-center h-20 bg-(--room-control-primary)">
      <div className="flex items-center gap-7.5">
        <MicroIcon />

        <SoundOnIcon />

        <WebCameraIcon />

        <button className="
          flex items-center justify-center
          w-16 h-16
          px-3.5
          py-5.5
          rounded-[17px]
          bg-(--color-close-conference)
        ">
          <CloseMeetIcon />
        </button>

        <ShareVideoIcon />

        <StartRecordIcon />

        <SmileIcon />
      </div>
    </div>
  );
}