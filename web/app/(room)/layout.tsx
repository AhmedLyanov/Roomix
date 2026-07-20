export default function RoomLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <main className="h-screen overflow-hidden">{children}</main>;
}
