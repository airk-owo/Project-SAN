// @ts-ignore: CSS module declarations are handled by the build system
import "./styles.css";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
