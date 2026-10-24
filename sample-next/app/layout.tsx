import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Fair-Drop seeded app", description: "Three intentional runtime errors for the Fair-Drop debugger demo." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
