"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedGradientBackgroundProps {
    className?: string;
    children?: React.ReactNode;
    intensity?: "subtle" | "medium" | "strong";
}

interface Beam {
    x: number;
    y: number;
    width: number;
    length: number;
    angle: number;
    speed: number;
    opacity: number;
    hue: number;
    pulse: number;
    pulseSpeed: number;
}

function createBeam(width: number, height: number): Beam {
    const angle = -35 + Math.random() * 10;
    return {
        x: Math.random() * width * 1.5 - width * 0.25,
        y: Math.random() * height * 1.5 - height * 0.25,
        width: 120 + Math.random() * 120,
        length: height * 2.5,
        angle: angle,
        speed: 0.4 + Math.random() * 0.6,
        opacity: 0.22 + Math.random() * 0.15,
        hue: 190 + Math.random() * 70,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.01 + Math.random() * 0.02,
    };
}

export function BeamsBackground({
    className,
    children,
    intensity = "strong",
}: AnimatedGradientBackgroundProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const beamsRef = useRef<Beam[]>([]);
    const animationFrameRef = useRef<number>(0);
    const MINIMUM_BEAMS = 20;

    const opacityMap = {
        subtle: 0.7,
        medium: 0.85,
        strong: 1,
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const updateCanvasSize = () => {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
            ctx.scale(dpr, dpr);

            const totalBeams = MINIMUM_BEAMS * 1.5;
            beamsRef.current = Array.from({ length: totalBeams }, () =>
                createBeam(window.innerWidth, window.innerHeight)
            );
        };

        updateCanvasSize();
        window.addEventListener("resize", updateCanvasSize);

        function resetBeam(beam: Beam, index: number, totalBeams: number) {
            if (!canvas) return beam;
            
            const column = index % 3;
            const spacing = window.innerWidth / 3;

            beam.y = window.innerHeight + 100;
            beam.x =
                column * spacing +
                spacing / 2 +
                (Math.random() - 0.5) * spacing * 0.5;
            beam.width = 120 + Math.random() * 120;
            beam.speed = 0.4 + Math.random() * 0.6;
            beam.hue = 190 + (index * 70) / totalBeams;
            beam.opacity = 0.22 + Math.random() * 0.15;
            return beam;
        }

        function drawBeam(ctx: CanvasRenderingContext2D, beam: Beam) {
            ctx.save();
            ctx.translate(beam.x, beam.y);
            ctx.rotate((beam.angle * Math.PI) / 180);

            // Calculate pulsing opacity
            const pulsingOpacity =
                beam.opacity *
                (0.8 + Math.sin(beam.pulse) * 0.2) *
                opacityMap[intensity];

            const gradient = ctx.createLinearGradient(0, 0, 0, beam.length);

            // Enhanced gradient with multiple color stops
            gradient.addColorStop(0, `hsla(${beam.hue}, 85%, 65%, 0)`);
            gradient.addColorStop(
                0.1,
                `hsla(${beam.hue}, 85%, 65%, ${pulsingOpacity * 0.5})`
            );
            gradient.addColorStop(
                0.4,
                `hsla(${beam.hue}, 85%, 65%, ${pulsingOpacity})`
            );
            gradient.addColorStop(
                0.6,
                `hsla(${beam.hue}, 85%, 65%, ${pulsingOpacity})`
            );
            gradient.addColorStop(
                0.9,
                `hsla(${beam.hue}, 85%, 65%, ${pulsingOpacity * 0.5})`
            );
            gradient.addColorStop(1, `hsla(${beam.hue}, 85%, 65%, 0)`);

            ctx.fillStyle = gradient;
            ctx.fillRect(-beam.width / 2, 0, beam.width, beam.length);
            ctx.restore();
        }

        const reduceMotion =
            typeof window !== "undefined" &&
            window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        const FRAME_MS = 1000 / 24; // ~24fps is plenty for a blurred ambient background
        let lastFrame = 0;
        let running = false;

        function drawFrame() {
            if (!canvas || !ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const totalBeams = beamsRef.current.length;
            beamsRef.current.forEach((beam, index) => {
                beam.y -= beam.speed;
                beam.pulse += beam.pulseSpeed;
                if (beam.y + beam.length < -100) {
                    resetBeam(beam, index, totalBeams);
                }
                drawBeam(ctx, beam);
            });
        }

        function animate(now: number) {
            if (!running) return;
            if (now - lastFrame >= FRAME_MS) {
                lastFrame = now;
                drawFrame();
            }
            animationFrameRef.current = requestAnimationFrame(animate);
        }

        function start() {
            if (running || reduceMotion) return;
            running = true;
            animationFrameRef.current = requestAnimationFrame(animate);
        }
        function stop() {
            running = false;
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        }
        // Don't burn battery while the tab/app is in the background
        const onVisibility = () => (document.hidden ? stop() : start());
        document.addEventListener("visibilitychange", onVisibility);

        drawFrame(); // always paint one static frame
        start();

        return () => {
            window.removeEventListener("resize", updateCanvasSize);
            document.removeEventListener("visibilitychange", onVisibility);
            stop();
        };
    }, [intensity]);

    return (
        <div
            className={cn(
                "w-full overflow-hidden bg-neutral-950",
                className || "relative min-h-screen"
            )}
        >
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full blur-[45px] pointer-events-none"
            />

            <motion.div
                className="absolute inset-0 bg-neutral-950/5 pointer-events-none"
                animate={{
                    opacity: [0.05, 0.15, 0.05],
                }}
                transition={{
                    duration: 10,
                    ease: "easeInOut",
                    repeat: Number.POSITIVE_INFINITY,
                }}
            />

            {children ? (
                <div className="relative z-10 w-full h-full">
                    {children}
                </div>
            ) : (
                <div className="relative z-10 flex h-screen w-full items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center justify-center gap-6 px-4 text-center">
                        <motion.h1
                            className="text-6xl md:text-7xl lg:text-8xl font-semibold text-white tracking-tighter"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                        >
                            Beams
                            <br />
                            Background
                        </motion.h1>
                        <motion.p
                            className="text-lg md:text-2xl lg:text-3xl text-white/70 tracking-tighter"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                        >
                            For your pleasure
                        </motion.p>
                    </div>
                </div>
            )}
        </div>
    );
}
