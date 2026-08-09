import { Aside } from "@/src/widgets/aside";
import { Header } from "@/src/widgets/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Aside />

      <div className="flex flex-1 flex-col">
        <Header />

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
