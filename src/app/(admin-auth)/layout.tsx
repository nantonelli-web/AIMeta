export default function AdminAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 grid place-items-center px-6 py-12 min-h-screen">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
