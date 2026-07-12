import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, FileText, Plus, CreditCard, User, ChevronRight, LogOut, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { TabBar } from "./TabBar";
import { BeamsBackground } from "@/components/ui/beams-background";

export const IosShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const menuItems = [
    { label: "Home", icon: Home, path: "/dashboard" },
    { label: "Posts", icon: FileText, path: "/posts" },
    { label: "Inspiration", icon: Lightbulb, path: "/inspiration" },
    { label: "Create Post", icon: Plus, path: "/posts/new", highlight: true },
    { label: "Plans", icon: CreditCard, path: "/pricing" },
    { label: "Profile", icon: User, path: "/settings" },
  ];

  return (
    <div className="flex flex-col md:flex-row w-full h-[100svh] overflow-hidden bg-zinc-950 text-white pt-[env(safe-area-inset-top)] md:pt-0">
      {/* Desktop Sidebar (visible on md screens and up) */}
      <aside className="hidden md:flex flex-col w-64 h-screen bg-zinc-900/50 border-r border-zinc-800/80 backdrop-blur-md p-6 justify-between select-none">
        <div className="space-y-8">
          {/* Logo / Brand */}
          <div className="flex items-center gap-2.5 px-2 cursor-pointer" onClick={() => router.push("/dashboard")}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/20">
              <span className="font-extrabold text-white text-lg font-mono">VP</span>
            </div>
            <div>
              <h2 className="font-extrabold text-sm tracking-tight text-white leading-tight">VoicePost</h2>
              <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Social AI Studio</p>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="space-y-1.5">
            {menuItems.map((item) => {
              const isActive = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path));
              const Icon = item.icon;

              if (item.highlight) {
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/10 active:scale-98 transition-all duration-150 my-4"
                  >
                    <Icon className="w-4 h-4 stroke-[2.5]" />
                    <span>{item.label}</span>
                  </Link>
                );
              }

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    "flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 group",
                    isActive
                      ? "bg-zinc-800 text-white shadow-inner"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn("w-4 h-4 transition-colors", isActive ? "text-blue-500" : "text-zinc-500 group-hover:text-zinc-300")} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-4 h-4 text-blue-500" />}
                </Link>
              );
            })}

            {/* Desktop-only Sign Out button in sidebar */}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold text-red-500 hover:text-red-400 hover:bg-red-950/20 active:scale-98 transition-all duration-150 group cursor-pointer text-left border-none bg-transparent mt-4"
            >
              <LogOut className="w-4 h-4 text-red-500 group-hover:text-red-400" />
              <span>Sign Out</span>
            </button>
          </nav>
        </div>

        {/* Footer info in sidebar */}
        <div className="px-2 py-4 border-t border-zinc-800/60 text-[10px] text-zinc-500 font-medium">
          <p>© 2026 VoicePost AI</p>
          <p className="mt-1 text-[9px] text-zinc-600">v1.3.4 (Standalone PWA)</p>
        </div>
      </aside>

      {/* Main Content Layout */}
      <div className="flex-1 flex flex-col h-[100svh] overflow-hidden relative">
        {/* Animated ambient beams background */}
        <BeamsBackground className="absolute inset-0 z-0 w-full h-full" intensity="medium">
          <div />
        </BeamsBackground>

        <main className="ios-scroll relative flex-1 z-10 bg-transparent">
          {/* Content wrapper to center and align beautifully on desktop */}
          <div className="w-full md:max-w-4xl md:mx-auto md:py-8 md:px-6">
            {children}
          </div>
          <div className="h-24 md:hidden" /> {/* Spacer for floating mobile tab bar */}
        </main>
        
        {/* Mobile Tab Bar */}
        <div className="md:hidden relative z-20">
          <TabBar />
        </div>
      </div>
    </div>
  );
};

