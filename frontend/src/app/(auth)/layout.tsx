export default function AuthGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="olm-login-bg relative flex min-h-screen w-full flex-col items-center justify-center overflow-x-hidden p-4 sm:p-6">
      {children}
    </div>
  );
}
