import { Aside } from "@/widgets/aside";
import { Header } from "@/widgets/header";

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

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}