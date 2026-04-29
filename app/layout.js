import "./globals.css";

export const metadata = {
  title: "Sprout Society — Grant Manager",
  description: "Grant pipeline and workspace for Sprout Society Inc. | EIN 83-1298420",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
