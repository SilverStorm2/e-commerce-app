import { MainFooter } from "./main-footer";
import { MainHeader } from "./main-header";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

type MainShellProps = {
  children: React.ReactNode;
};

export function MainShell({ children }: MainShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <MainHeader />
      <main className="flex-1 bg-background">{children}</main>
      <MainFooter />
      <ServiceWorkerRegister />
    </div>
  );
}
