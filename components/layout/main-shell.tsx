import { MainFooter } from "./main-footer";
import { MainHeader } from "./main-header";

type MainShellProps = {
  children: React.ReactNode;
};

export function MainShell({ children }: MainShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <MainHeader />
      <main className="flex-1 bg-background">{children}</main>
      <MainFooter />
    </div>
  );
}
