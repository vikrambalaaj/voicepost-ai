"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { IosShell } from "@/components/layout/IosShell";
import { Mic, Type, Search, ImageIcon, Sparkles, Upload, Check, Trash2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function CreatePostPage() {
  const router = useRouter();
  const [activeInputMode, setActiveInputMode] = useState<"voice" | "type">("voice");
  
  // Voice Input States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  
  // Type Input States
  const [typedIdea, setTypedIdea] = useState("");

  // Step 2 Style States
  const [styleType, setStyleType] = useState<"own" | "expert" | "custom">("expert");
  const [selectedStyleId, setSelectedStyleId] = useState("lara_acosta");
  const [expertStyles, setExpertStyles] = useState<any[]>([]);
  const [customStyles, setCustomStyles] = useState<any[]>([]);
  
  // Step 3 Image States
  const [imageTab, setImageTab] = useState<"search" | "ai" | "upload">("search");
  const [searchQuery, setSearchQuery] = useState("business success");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [isGeneratingAiImage, setIsGeneratingAiImage] = useState(false);
  const [aiGeneratedImage, setAiGeneratedImage] = useState<any>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>("");
  const [includeImage, setIncludeImage] = useState(true);

  // Overall Generation State
  const [generatingPost, setGeneratingPost] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [aiBackend, setAiBackend] = useState<"antigravity" | "waterfall">("waterfall");
  const [isAdmin, setIsAdmin] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [generationTime, setGenerationTime] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("voicepost_ai_backend");
    // "antigravity" requires a local Python env — always force waterfall on Vercel
    if (saved === "antigravity") {
      localStorage.setItem("voicepost_ai_backend", "waterfall");
    } else if (saved === "waterfall") {
      setAiBackend("waterfall");
    }
    setIsAdmin(localStorage.getItem("voicepost_is_admin") === "true");
  }, []);

  // Refs for Recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Load Styles & Images
  useEffect(() => {
    async function loadStyles() {
      try {
        const expRes = await fetch("/api/style/experts");
        const expData = await expRes.json();
        if (expData.success) {
          setExpertStyles(expData.experts);
        }

        const custRes = await fetch("/api/style/custom");
        const custData = await custRes.json();
        if (custData.success) {
          setCustomStyles(custData.customStyles || []);
        }
      } catch (err) {
        console.error("Failed to load styles:", err);
      }
    }

    loadStyles();
    handleImageSearch();
  }, []);

  // Timer for voice recording
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 300) { // 5 mins max
            stopRecording();
            return 300;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // Timer for tracking generation progress
  useEffect(() => {
    let timerId: NodeJS.Timeout;
    if (generatingPost) {
      setGenerationTime(0);
      setActiveStep(0);
      timerId = setInterval(() => {
        setGenerationTime((prev) => prev + 1);
      }, 1000);
    } else {
      setGenerationTime(0);
      setActiveStep(0);
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [generatingPost]);

  // Handle stepping active generation phase
  useEffect(() => {
    if (!generatingPost) return;
    const offset = webSearch ? 3 : 0;
    if (webSearch && generationTime < 4) {
      setActiveStep(0);
    } else if (generationTime < 4 + offset) {
      setActiveStep(1);
    } else if (generationTime < 9 + offset) {
      setActiveStep(2);
    } else if (generationTime < 13 + offset) {
      setActiveStep(3);
    } else {
      setActiveStep(4);
    }
  }, [generationTime, generatingPost, webSearch]);

  // Warmup Trigger
  const triggerWarmup = async () => {
    setIsWarmingUp(true);
    try {
      await fetch("/api/voice/warmup", { method: "POST" });
    } catch (e) {}
    setIsWarmingUp(false);
  };

  // Audio Waveform Visualizer
  const startVisualizer = (stream: MediaStream) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 256;
    source.connect(analyser);
    
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!analyserRef.current) return;
      
      const width = canvas.width;
      const height = canvas.height;
      
      animationFrameRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, width, height);
      
      const barWidth = (width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;
        
        // Brand Cyan/Blue color gradient
        ctx.fillStyle = `rgba(6, 182, 212, ${0.4 + barHeight / 100})`;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();
  };

  const stopVisualizer = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    analyserRef.current = null;
    audioContextRef.current = null;
  };

  // Start Recording
  const startRecording = async () => {
    await triggerWarmup();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/wav",
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
        handleTranscribe(audioBlob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      setTimeout(() => startVisualizer(stream), 100);

    } catch (err) {
      alert("Microphone permission denied. Please enter your thoughts via text instead.");
      setActiveInputMode("type");
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopVisualizer();
    }
  };

  // Transcribe Audio — uses async polling pattern to avoid Vercel 10s timeout
  const handleTranscribe = async (blob: Blob) => {
    setTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("file", blob);
      formData.append("duration", recordingDuration.toString());

      // Step 1: Submit audio (fast ~2s) — returns transcript_id
      const res = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData,
      });

      const submitData = await res.json();
      if (!submitData.transcript_id) {
        throw new Error(submitData.error || "Failed to submit transcription");
      }

      const { transcript_id, user_id, industry, keywords, duration_seconds } = submitData;
      const keywordsStr = Array.isArray(keywords) ? keywords.join(",") : "";

      // Step 2: Poll /api/voice/transcribe/status every 2s from the browser
      const pollUrl = `/api/voice/transcribe/status?id=${transcript_id}&user_id=${user_id}&duration=${duration_seconds}&industry=${encodeURIComponent(industry || "")}&keywords=${encodeURIComponent(keywordsStr)}`;

      const maxAttempts = 40; // 40 × 2s = 80s max
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const pollRes = await fetch(pollUrl);
        const pollData = await pollRes.json();

        if (pollData.status === "completed" && pollData.corrected_transcript) {
          setTranscript(pollData.corrected_transcript);
          return;
        } else if (pollData.status === "error") {
          throw new Error(pollData.error || "Transcription failed");
        }
        // Still processing — loop continues
      }
      throw new Error("Transcription timed out after 80 seconds.");
    } catch (err: any) {
      console.error("Transcription error:", err);
      alert("Transcription failed: " + (err.message || "Please try again."));
    } finally {
      setTranscribing(false);
    }
  };

  // Search Images
  const handleImageSearch = async () => {
    try {
      const res = await fetch(`/api/images/search?query=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.results);
      }
    } catch (e) {}
  };

  // Custom Media Upload Handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideoFile = file.type.startsWith("video/");
    const maxSize = isVideoFile ? 15 * 1024 * 1024 : 5 * 1024 * 1024;

    if (file.size > maxSize) {
      alert(`File is too large. Max ${isVideoFile ? "15MB" : "5MB"} allowed.`);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setUploadedImageUrl(base64String);
      
      const uploadedAsset = {
        id: "upload_" + Date.now(),
        url: base64String,
        source_type: "upload",
        thumbnail: isVideoFile ? "" : base64String,
        attribution: file.name
      };
      setSelectedImage(uploadedAsset);
    };
    reader.readAsDataURL(file);
  };

  // Generate AI Image
  const handleAiImageGenerate = async () => {
    if (!transcript && !typedIdea) {
      alert("Please provide voice input or text idea first so we can extract visual themes!");
      return;
    }
    setIsGeneratingAiImage(true);
    try {
      const res = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: "00000000-0000-0000-0000-000000000000",
          post_content: activeInputMode === "voice" ? transcript : typedIdea,
        }),
      });
      const data = await res.json();
      if (data.success && data.image) {
        setAiGeneratedImage(data.image);
        setSelectedImage(data.image);
      } else if (data.quota_hit) {
        alert("Free limit reached! Upgrade your subscription plan to generate AI images.");
      } else {
        alert("AI image generation failed: " + (data.error || "Unknown server error"));
      }
    } catch (e: any) {
      console.error("AI Generation failed:", e);
      alert("AI image generation failed: " + (e.message || "Please check server logs."));
    } finally {
      setIsGeneratingAiImage(false);
    }
  };

  // Submit and Generate Post
  const handleGeneratePost = async () => {
    const inputContent = activeInputMode === "voice" ? transcript : typedIdea;
    if (!inputContent) {
      alert("Please record audio or type your idea before generating.");
      return;
    }

    setGeneratingPost(true);
    setGenerationStatus(webSearch ? "Searching the web..." : "Rewriting post...");
    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: inputContent,
          style_type: styleType,
          style_id: selectedStyleId,
          backend: aiBackend,
          web_search: webSearch,
        }),
      });

      const data = await res.json();
      if (data.success && data.post_id) {
        const generatedPostContent = data.approval_package?.post_content || inputContent;

        if (includeImage) {
          let imageToAttach = null;
          let dbSourceType = "search";

          // Priority 1: User uploaded custom image
          if (uploadedImageUrl) {
            imageToAttach = { url: uploadedImageUrl };
            dbSourceType = "upload";
          }
          // Priority 2: User manually generated or selected an image
          else if (selectedImage) {
            imageToAttach = selectedImage;
            dbSourceType = selectedImage.source_type || (imageTab === "ai" ? "ai" : "search");
          }
          // Priority 3: Auto-generate a related image
          else {
            setGenerationStatus("Auto-generating related image...");
            try {
              const genRes = await fetch("/api/images/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  post_id: data.post_id,
                  post_content: generatedPostContent,
                }),
              });
              const genData = await genRes.json();
              if (genData.success && genData.image) {
                imageToAttach = genData.image;
                dbSourceType = "ai";
              }
            } catch (imgErr) {
              console.error("Auto image generation failed:", imgErr);
            }
          }

          if (imageToAttach) {
            setGenerationStatus("Saving related image...");
            await fetch(`/api/posts/${data.post_id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image_url: imageToAttach.url,
                source_type: dbSourceType,
                prompt_used: imageToAttach.prompt_used || imageToAttach.prompt || null,
              }),
            });
          }
        }

        router.push(`/posts/${data.post_id}/approval`);
      } else {
        alert("Failed to generate: " + data.error);
      }
    } catch (err: any) {
      console.error("Post generation failed:", err);
      alert("Post generation encountered an error: " + (err.message || "Please check server logs."));
    } finally {
      setGeneratingPost(false);
      setGenerationStatus("");
    }
  };

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  return (
    <IosShell>
      <div className="pt-6 px-4">
        {/* iOS Nav Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.back()} className="ios-back-btn">
            <ArrowLeft className="w-5 h-5 text-cyan-400" /> Back
          </button>
          <span className="font-semibold text-zinc-900 dark:text-white text-base">New Post</span>
          <div className="w-12" />
        </div>

        {/* Post Type Selector */}
        <div className="ios-segment mb-6 select-none">
          <button
            onClick={() => {}}
            className="ios-segment-btn active"
          >
            Text & Image Post
          </button>
          <button
            onClick={() => router.push("/posts/carousel/new")}
            className="ios-segment-btn"
          >
            LinkedIn Carousel (Slides)
          </button>
        </div>

        {/* STEP 1: Input Card */}
        <div className="ios-section-label">Step 1 — Input Idea</div>
        <div className="ios-card p-4">
          <div className="ios-segment mb-4">
            <button
              onClick={() => setActiveInputMode("voice")}
              className={`ios-segment-btn ${activeInputMode === "voice" ? "active" : ""}`}
            >
              <Mic className="w-3.5 h-3.5 inline mr-1" /> Record Voice
            </button>
            <button
              onClick={() => setActiveInputMode("type")}
              className={`ios-segment-btn ${activeInputMode === "type" ? "active" : ""}`}
            >
              <Type className="w-3.5 h-3.5 inline mr-1" /> Type Idea
            </button>
          </div>

          {activeInputMode === "voice" ? (
            <div className="flex flex-col items-center py-6 text-center">
              {isRecording ? (
                <div className="w-full flex flex-col items-center">
                  <span className="text-red-500 font-bold text-lg animate-pulse mb-2">
                    Recording... {formatDuration(recordingDuration)}
                  </span>
                  <canvas
                    ref={canvasRef}
                    width={280}
                    height={60}
                    className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl mb-6"
                  />
                  <button
                    onClick={stopRecording}
                    className="w-16 h-16 rounded-full bg-red-500 border-4 border-zinc-200 flex items-center justify-center text-white active:scale-95 animate-ping"
                  >
                    Stop
                  </button>
                </div>
              ) : transcribing ? (
                <div className="py-6 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin mb-3" />
                  <span className="text-sm text-zinc-500 font-semibold animate-pulse">
                    Transcribing your voice...
                  </span>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center">
                  <p className="text-zinc-500 text-sm mb-6 max-w-xs">
                    Tap the button below and speak. Warmup starts automatically.
                  </p>
                  <button
                    onClick={startRecording}
                    className="w-16 h-16 rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform"
                  >
                    <Mic className="w-8 h-8" />
                  </button>
                  {transcript && (
                    <div className="mt-6 w-full text-left">
                      <label className="text-xs font-bold text-zinc-400 uppercase">Corrected Transcript (Tap to edit)</label>
                      <textarea
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        className="mt-1 w-full p-3 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 h-36 resize-y font-sans leading-relaxed"
                        placeholder="Review or edit your voice transcript here..."
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <textarea
                value={typedIdea}
                onChange={(e) => setTypedIdea(e.target.value)}
                placeholder="Type your idea, paste bullet points, or paste an article draft..."
                className="w-full h-36 p-3 rounded-xl border bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder:text-zinc-400 border-zinc-800"
              />
            </div>
          )}
        </div>

        {/* WEB SEARCH GROUNDING */}
        <div className="ios-section-label">Web Search Grounding</div>
        <div className="ios-card p-4 flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-col pr-4 text-left">
            <span className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
              <Search className="w-4 h-4 text-cyan-400" />
              Enable Web Search Grounding
            </span>
            <span className="text-[11px] text-zinc-400 mt-0.5 leading-tight">
              Uses Google Search/Tavily to find the latest facts and news on your topic before writing.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setWebSearch((v) => !v)}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 border-none cursor-pointer shrink-0 ${webSearch ? "bg-blue-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
            aria-label="Toggle Web Search Grounding"
          >
            <span
              className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
              style={{ transform: webSearch ? "translateX(24px)" : "translateX(0)" }}
            />
          </button>
        </div>

        {/* AI GENERATION ENGINE */}
        {isAdmin && (
          <>
            <div className="ios-section-label">AI Agent Backend</div>
            <div className="ios-card p-4">
              <div className="ios-segment">
                <button
                  type="button"
                  onClick={() => {
                    setAiBackend("antigravity");
                    localStorage.setItem("voicepost_ai_backend", "antigravity");
                  }}
                  className={`ios-segment-btn ${aiBackend === "antigravity" ? "active" : ""}`}
                >
                  <Sparkles className="w-3.5 h-3.5 inline mr-1" /> Advanced AI Agent
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAiBackend("waterfall");
                    localStorage.setItem("voicepost_ai_backend", "waterfall");
                  }}
                  className={`ios-segment-btn ${aiBackend === "waterfall" ? "active" : ""}`}
                >
                  Standard LLM
                </button>
              </div>
            </div>
          </>
        )}

        {/* STEP 2: Style Picker */}
        <div className="ios-section-label">Step 2 — Pick Writing Style</div>
        <div className="ios-card p-4">
          <div className="flex gap-2 mb-3 select-none">
            <Badge
              onClick={() => setStyleType("expert")}
              className={`cursor-pointer rounded-full font-bold px-3 py-1 ${styleType === "expert" ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"}`}
            >
              Expert Voices
            </Badge>
            <Badge
              onClick={() => setStyleType("own")}
              className={`cursor-pointer rounded-full font-bold px-3 py-1 ${styleType === "own" ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"}`}
            >
              My Voice DNA
            </Badge>
          </div>

          {styleType === "expert" ? (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none scroll-smooth">
              {expertStyles.map((style) => (
                <div
                  key={style.id}
                  onClick={() => setSelectedStyleId(style.id)}
                  className={`flex-shrink-0 w-32 p-3 rounded-2xl border text-center cursor-pointer active:scale-95 transition-all ${
                    selectedStyleId === style.id ? "border-cyan-500 bg-cyan-950/20" : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200 truncate">{style.name}</p>
                  <p className="text-[10px] text-zinc-400 mt-1 truncate">{style.handle}</p>
                  {selectedStyleId === style.id && (
                    <div className="mt-2 flex justify-center text-cyan-400">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div
              onClick={() => setSelectedStyleId("own")}
              className={`p-4 rounded-2xl border cursor-pointer ${
                selectedStyleId === "own" ? "border-cyan-500 bg-cyan-950/20" : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Personal Style DNA</p>
              <p className="text-xs text-zinc-400 mt-1">
                Generated from your scraped LinkedIn history.
              </p>
            </div>
          )}
        </div>

        {/* STEP 3: Image Picker */}
        <div className="ios-section-label flex items-center justify-between select-none">
          <span>Step 3 — Media (Optional)</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={includeImage}
              onChange={(e) => setIncludeImage(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full peer peer-focus:ring-1 peer-focus:ring-cyan-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-650 peer-checked:bg-cyan-500"></div>
            <span className="ml-2 text-xs font-bold text-zinc-500">
              {includeImage ? "ON" : "OFF"}
            </span>
          </label>
        </div>
        
        {includeImage ? (
          <div className="ios-card p-4">
            <div className="flex justify-around border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4 select-none">
              <button
                onClick={() => setImageTab("search")}
                className={`text-sm font-bold pb-1 ${imageTab === "search" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-zinc-400"}`}
              >
                <Search className="w-3.5 h-3.5 inline mr-1" /> Search
              </button>
              <button
                onClick={() => setImageTab("ai")}
                className={`text-sm font-bold pb-1 ${imageTab === "ai" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-zinc-400"}`}
              >
                <Sparkles className="w-3.5 h-3.5 inline mr-1" /> AI Generate
              </button>
              <button
                onClick={() => setImageTab("upload")}
                className={`text-sm font-bold pb-1 ${imageTab === "upload" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-zinc-400"}`}
              >
                <Upload className="w-3.5 h-3.5 inline mr-1" /> Upload
              </button>
            </div>

            {imageTab === "search" && (
              <div>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search visual ideas..."
                    className="flex-1 text-sm p-2.5 rounded-xl border bg-transparent focus:outline-none border-zinc-850"
                  />
                  <button
                    onClick={handleImageSearch}
                    className="rounded-xl px-4 bg-zinc-850 hover:bg-zinc-800 text-white text-xs font-bold h-10 border border-zinc-800 cursor-pointer transition-colors"
                  >
                    Find
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {searchResults.map((img) => (
                    <div
                      key={img.id}
                      onClick={() => setSelectedImage(img)}
                      className={`relative aspect-video rounded-lg overflow-hidden border-2 cursor-pointer ${
                        selectedImage?.id === img.id ? "border-cyan-500 scale-[0.98]" : "border-transparent"
                      }`}
                    >
                      <img src={img.thumbnail} alt={img.attribution} className="w-full h-full object-cover" />
                      {selectedImage?.id === img.id && (
                        <div className="absolute inset-0 bg-cyan-500/20 flex items-center justify-center text-white">
                          <Check className="w-6 h-6 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {imageTab === "ai" && (
              <div className="text-center py-4">
                {isGeneratingAiImage ? (
                  <div className="py-4 flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin mb-2" />
                    <span className="text-xs text-zinc-400 animate-pulse">Running Flux generation model...</span>
                  </div>
                ) : aiGeneratedImage ? (
                  <div className="flex flex-col items-center">
                    <div className="relative aspect-video w-full max-w-sm rounded-xl overflow-hidden mb-3 border-2 border-cyan-500">
                      <img src={aiGeneratedImage.url} alt="AI output" className="w-full h-full object-cover" />
                    </div>
                    <Button onClick={handleAiImageGenerate} variant="outline" className="rounded-xl text-xs py-1 h-8 border-cyan-500/30 text-cyan-400">
                      Regenerate AI Image
                    </Button>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-zinc-500 mb-4 max-w-xs mx-auto">
                      Generate a photorealistic professional image matching your post concept.
                    </p>
                    <Button onClick={handleAiImageGenerate} className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-white rounded-xl">
                      <Sparkles className="w-4 h-4 mr-2" /> Generate with Flux
                    </Button>
                  </div>
                )}
              </div>
            )}

            {imageTab === "upload" && (
              <div className="text-center py-4">
                {uploadedImageUrl ? (
                  <div className="flex flex-col items-center">
                    <div className="relative aspect-video w-full max-w-sm rounded-xl overflow-hidden mb-3 border border-zinc-800 bg-zinc-950 flex items-center justify-center">
                      {uploadedImageUrl.startsWith("data:video/") ? (
                        <video src={uploadedImageUrl} controls className="w-full h-full object-cover" />
                      ) : (
                        <img src={uploadedImageUrl} alt="Uploaded output" className="w-full h-full object-cover" />
                      )}
                      <button
                        onClick={() => {
                          setUploadedImageUrl("");
                          setSelectedImage(null);
                        }}
                        className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 p-1.5 rounded-full text-white"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="text-xs text-cyan-400 font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 animate-pulse" /> Custom media selected
                    </span>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-file-upload"
                    />
                    <label
                      htmlFor="image-file-upload"
                      className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-2xl p-6 bg-zinc-950/40 text-center cursor-pointer hover:border-cyan-500/40 transition-colors max-w-xs mx-auto"
                    >
                      <Upload className="w-8 h-8 text-cyan-400 mb-2" />
                      <span className="text-xs font-bold text-zinc-200">Upload custom media</span>
                      <span className="text-[10px] text-zinc-500 mt-1">PNG, JPG, MP4, WEBM (Max 15MB)</span>
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="ios-card p-6 text-center">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              No image will be attached to this post.
            </p>
          </div>
        )}

        {/* Generate Post Button */}
        <div className="py-4">
          <button
            onClick={handleGeneratePost}
            disabled={generatingPost}
            className="w-[calc(100%-32px)] mx-4 my-2 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 hover:from-cyan-300 hover:via-blue-400 hover:to-purple-500 disabled:from-zinc-850 disabled:to-zinc-850 disabled:text-zinc-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 shadow-md border-none text-[17px] font-semibold cursor-pointer transition-all duration-200"
          >
            {generatingPost ? (
              <>
                <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                {generationStatus || "Rewriting in progress..."}
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" /> Generate Post
              </>
            )}
          </button>
        </div>

        {/* FULL-SCREEN GENERATION OVERLAY */}
        {generatingPost && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-6 text-white select-none">
            {/* Glowing background shapes */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
            <div className="absolute bottom-1/3 left-1/3 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Loader Card */}
            <div className="w-full max-w-md bg-zinc-900/80 border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden text-center">
              {/* Top pulsing icon */}
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 flex items-center justify-center relative shadow-xl shadow-cyan-500/10">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 animate-ping opacity-25" />
                <Sparkles className="w-10 h-10 text-white animate-pulse" />
              </div>

              <h3 className="text-xl font-bold tracking-tight text-white mb-1">
                {activeStep === 0 && "Performing Web Search..."}
                {activeStep === 1 && "Analyzing Writing DNA..."}
                {activeStep === 2 && "Drafting LinkedIn Post..."}
                {activeStep === 3 && "Optimizing Hashtags & Hooks..."}
                {activeStep === 4 && "Polishing Final Layout..."}
              </h3>
              <p className="text-xs text-zinc-400 mb-6">
                {generationStatus || "Creating your post using AI..."}
              </p>

              {/* Progress Bar Container */}
              <div className="w-full bg-zinc-800/80 rounded-full h-2.5 mb-2 overflow-hidden border border-zinc-700/50">
                <div
                  className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${Math.min(98, Math.round((generationTime / (webSearch ? 18 : 13)) * 100))}%` }}
                />
              </div>

              {/* Timer and percentage */}
              <div className="flex justify-between text-[11px] text-zinc-500 font-bold px-1 mb-8">
                <span>{Math.min(98, Math.round((generationTime / (webSearch ? 18 : 13)) * 100))}% completed</span>
                <span>{generationTime}s elapsed</span>
              </div>

              {/* Step Indicators */}
              <div className="space-y-3.5 text-left border-t border-zinc-800/60 pt-6">
                {[
                  { label: "Web Search Grounding", key: 0, visible: webSearch },
                  { label: "Analyze target writing style", key: 1, visible: true },
                  { label: "Ghostwrite post content matching style", key: 2, visible: true },
                  { label: "Structure relevant hashtags & hooks", key: 3, visible: true },
                  { label: "Assemble final layout & preview package", key: 4, visible: true },
                ]
                  .filter((s) => s.visible)
                  .map((step, idx) => {
                    const isDone = activeStep > step.key;
                    const isActive = activeStep === step.key;
                    return (
                      <div
                        key={step.key}
                        className={`flex items-center gap-3 transition-opacity duration-300 ${
                          isDone || isActive ? "opacity-100" : "opacity-35"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                            isDone
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : isActive
                              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 animate-pulse"
                              : "bg-zinc-850 text-zinc-500 border border-zinc-700/50"
                          }`}
                        >
                          {isDone ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            idx + 1
                          )}
                        </div>
                        <span
                          className={`text-xs font-semibold ${
                            isActive
                              ? "text-cyan-400 animate-pulse"
                              : isDone
                              ? "text-zinc-300"
                              : "text-zinc-500"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>
    </IosShell>
  );
}
