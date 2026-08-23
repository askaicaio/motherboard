// Title-only layout. The page itself is a Client Component, which cannot
// export metadata, so the portal sign-in page gets its title from here.
export const metadata = { title: "Sign in" };

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
