import {SearchIcon} from "@/shared/icons/24";
export function Input() {
  return (
    <div className="w-[288px] py-[12px] px-[14px] flex gap-2.75 rounded-md bg-(--input-color)">
      <SearchIcon />
      <input className="w-full h-full outline-none" type="text" placeholder="Search lessons and files" />
    </div>
  )
}