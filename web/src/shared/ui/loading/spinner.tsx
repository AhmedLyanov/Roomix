"use client";

import { LoadingOutlined } from "@ant-design/icons";
import { Spin } from "antd";

export function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <Spin
        indicator={
          <LoadingOutlined
            spin
            style={{
              fontSize: 36,
              color: "var(--color-accent)",
            }}
          />
        }
      />
    </div>
  );
}
