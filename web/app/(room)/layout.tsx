export default function RoomLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="bg-(--room-background) h-screen overflow-hidden">
      {children}
    </main>
  );
}