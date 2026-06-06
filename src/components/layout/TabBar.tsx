"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FileText, Plus, CreditCard, User } from "lucide-react";
import { cn } from "@/lib/utils";

export const TabBar: React.FC = () => {
  const pathname = usePathname();

  const tabs = [
    {
      label: "Home",
      icon: Home,
      path: "/dashboard",
    },
    {
      label: "Posts",
      icon: FileText,
      path: "/posts",
    },
    {
      label: "Create",
      icon: Plus,
      path: "/posts/new",
      isCenter: true,
    },
    {
      label: "Plans",
      icon: CreditCard,
      path: "/pricing",
    },
    {
      label: "Profile",
      icon: User,
      path: "/settings",
    },
  ];

  // If we are on the landing page, we don't display the tab bar.
  if (pathname === "/") return null;

  return (
    <div className="tab-bar fixed bottom-0 left-0 right-0 z-50 px-4 py-2 border-t flex justify-around items-center">
      <div className="ios-tab-bar w-full max-w-md mx-auto flex justify-around items-end">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path || (tab.path !== "/dashboard" && pathname.startsWith(tab.path));
          const Icon = tab.icon;

          if (tab.isCenter) {
            return (
              <Link key={tab.path} href={tab.path} className="flex flex-col items-center justify-center -mt-6">
                <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 border-4 border-white dark:border-zinc-900 active:scale-95 transition-all duration-150">
                  <Icon className="w-7 h-7 stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mt-1">
                  {tab.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={cn(
                "ios-tab flex flex-col items-center py-1 select-none active:opacity-70 transition-opacity",
                isActive && "active"
              )}
            >
              <Icon className={cn("w-5 h-5 transition-colors", isActive ? "text-blue-600 dark:text-blue-400" : "text-zinc-400 dark:text-zinc-500")} />
              <span className={cn("text-[10px] font-medium mt-1 transition-colors", isActive ? "text-blue-600 dark:text-blue-400" : "text-zinc-400 dark:text-zinc-500")}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
