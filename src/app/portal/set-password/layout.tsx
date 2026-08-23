// Title-only layout. The page itself is a Client Component, which cannot
// export metadata, so the set-password page gets its title from here.
export const metadata = { title: "Set your password" };

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
