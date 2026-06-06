"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BenefitProps {
  text: string;
  checked: boolean;
}

const Benefit = ({ text, checked }: BenefitProps) => {
  return (
    <div className="flex items-center gap-3">
      {checked ? (
        <span className="grid size-4 place-content-center rounded-full bg-cyan-500 text-sm text-white">
          <Check className="size-3 stroke-[3]" />
        </span>
      ) : (
        <span className="grid size-4 place-content-center rounded-full dark:bg-zinc-800 bg-zinc-200 text-sm dark:text-zinc-500 text-zinc-400">
          <X className="size-3" />
        </span>
      )}
      <span className="text-sm dark:text-zinc-300 text-zinc-600">{text}</span>
    </div>
  );
};

interface PricingCardProps {
  tier: string;
  price: string;
  yearlyPrice?: string;
  period?: "monthly" | "yearly";
  bestFor: string;
  CTA: string;
  popular?: boolean;
  onClick?: () => void;
  benefits: Array<{ text: string; checked: boolean }>;
  className?: string;
}

export const PricingCard = ({
  tier,
  price,
  yearlyPrice,
  period = "monthly",
  bestFor,
  CTA,
  popular = false,
  onClick,
  benefits,
  className,
}: PricingCardProps) => {
  const currentPrice = period === "yearly" && yearlyPrice ? yearlyPrice : price;

  return (
    <motion.div
      initial={{ filter: "blur(2px)", opacity: 0, y: 20 }}
      whileInView={{ filter: "blur(0px)", opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="h-full w-full"
    >
      <Card
        className={cn(
          "relative h-full w-full overflow-hidden border flex flex-col justify-between",
          "dark:border-zinc-800 dark:bg-gradient-to-br dark:from-zinc-950/70 dark:to-zinc-900/90",
          "border-zinc-200 bg-gradient-to-br from-zinc-50/70 to-zinc-100/90",
          "p-6 rounded-3xl",
          popular && "border-cyan-500/30 dark:border-cyan-500/30 shadow-lg shadow-cyan-500/5 dark:shadow-cyan-500/5",
          className
        )}
      >
        {popular && (
          <div className="absolute top-4 right-4 z-10">
            <Badge className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-white font-semibold text-xs border-none rounded-full px-2.5 py-0.5">
              Most popular
            </Badge>
          </div>
        )}

        <div>
          <div className="flex flex-col items-center border-b pb-6 dark:border-zinc-800 border-zinc-200 text-center">
            <span className="mb-4 inline-block text-xs tracking-widest uppercase font-bold text-zinc-500 dark:text-zinc-400">
              {tier}
            </span>
            <span className="mb-2 inline-block text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              {currentPrice}
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
              {bestFor}
            </span>
          </div>
          <div className="space-y-4 py-8">
            {benefits.map((benefit, index) => (
              <Benefit key={index} {...benefit} />
            ))}
          </div>
        </div>

        <Button
          onClick={onClick}
          className={cn(
            "w-full py-6 rounded-2xl font-bold transition-all duration-300",
            popular
              ? "bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 hover:from-cyan-300 hover:via-blue-400 hover:to-purple-500 text-white shadow-md shadow-cyan-500/20"
              : "bg-zinc-200 hover:bg-zinc-300 text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white"
          )}
          variant={popular ? "default" : "secondary"}
        >
          {CTA}
        </Button>
      </Card>
    </motion.div>
  );
};
