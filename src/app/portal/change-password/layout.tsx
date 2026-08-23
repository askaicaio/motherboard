// Title-only layout. The page itself is a Client Component, which cannot
// export metadata, so the change-password page gets its title from here.
export const metadata = { title: "Change your password" };

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
