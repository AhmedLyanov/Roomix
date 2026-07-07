import { Skeleton } from "antd";

export function SessionHistorySkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton active paragraph={{ rows: 1 }} />
      <Skeleton active paragraph={{ rows: 1 }} />
      <Skeleton active paragraph={{ rows: 1 }} />
    </div>
  );
}
