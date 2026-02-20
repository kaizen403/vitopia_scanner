"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { verifyTicket, ScanResult, getEvents, Event } from "@/lib/api";

type ScanStatus = "idle" | "scanning" | "success" | "error" | "already_used";

const EVENT_NAME_BY_TOKEN: Record<string, string> = {
  DAY_1: "Day-1",
  DAY_2: "Day-2",
  DAY_3: "Day-3",
  PRANAV: "Mr. Pranav Sharma",
  UDAYA: "Mr. Sarat Raja Uday Boddeda",
  TSHIRT: "T-Shirt Distribution",
};

const EVENT_SORT_BY_TOKEN: Record<string, number> = {
  DAY_1: 1,
  DAY_2: 2,
  DAY_3: 3,
  PRANAV: 4,
  UDAYA: 5,
  TSHIRT: 6,
};

function getEventDisplayName(event: Event): string {
  const token = event.accessToken ?? "";
  if (event.name === "Vitopia2026-Day1") return "Vitopia Day 1";
  if (event.name === "Vitopia2026-Day2") return "Vitopia Day 2";
  if (event.name === "Vitopia2026-Day3") return "Vitopia Day 3";
  if (event.name.includes("Mr. Pranav Sharma")) return "Mr. Pranav Sharma";
  if (event.name.includes("Sarat Raja Uday Boddeda")) return "Mr. Sarat Raja Uday Boddeda";
  return EVENT_NAME_BY_TOKEN[token] ?? event.name;
}

function sortEventsForScanner(items: Event[]): Event[] {
  return [...items].sort((a, b) => {
    const aRank = a.scanOrder ?? EVENT_SORT_BY_TOKEN[a.accessToken ?? ""] ?? Number.MAX_SAFE_INTEGER;
    const bRank = b.scanOrder ?? EVENT_SORT_BY_TOKEN[b.accessToken ?? ""] ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) {
      return aRank - bRank;
    }

    if (a.date !== b.date) {
      return a.date - b.date;
    }

    return a.name.localeCompare(b.name);
  });
}

export default function ScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [gateId, setGateId] = useState("gate-1");
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [events, setEvents] = useState<Event[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [scanCount, setScanCount] = useState({ success: 0, failed: 0 });
  const lastScannedRef = useRef<string>("");
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const orderedEvents = useMemo(() => sortEventsForScanner(events), [events]);

  // Load events on mount
  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    const data = await getEvents();
    setEvents(data);
  }

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      setStream(mediaStream);
      setScanning(true);
      setStatus("idle");
    } catch (error) {
      console.error("Failed to start camera:", error);
      alert("Failed to access camera. Please ensure camera permissions are granted.");
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setScanning(false);
    setStatus("idle");
  }, [stream]);

  // Scan QR code from video frame
  const scanFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !scanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      if ("BarcodeDetector" in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ["qr_code"],
        });
        const barcodes = await barcodeDetector.detect(canvas);

        if (barcodes.length > 0) {
          const qrCode = barcodes[0].rawValue;

          if (qrCode !== lastScannedRef.current) {
            lastScannedRef.current = qrCode;
            await handleQRCodeDetected(qrCode);
          }
        }
      }
    } catch {
      // Silently fail - will retry on next frame
    }
  }, [scanning, gateId, selectedEventId]);

  // Handle detected QR code
  const handleQRCodeDetected = async (qrCode: string) => {
    setStatus("scanning");

    try {
      const result = await verifyTicket(qrCode, gateId, selectedEventId || undefined);
      setLastResult(result);

      if (result.success) {
        setStatus("success");
        setScanCount((prev) => ({ ...prev, success: prev.success + 1 }));
        playSound("success");
      } else if (result.code === "ALREADY_USED") {
        setStatus("already_used");
        setScanCount((prev) => ({ ...prev, failed: prev.failed + 1 }));
        playSound("error");
      } else {
        setStatus("error");
        setScanCount((prev) => ({ ...prev, failed: prev.failed + 1 }));
        playSound("error");
      }

      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      scanTimeoutRef.current = setTimeout(() => {
        setStatus("idle");
        lastScannedRef.current = "";
      }, 3000);
    } catch (error) {
      console.error("Verification error:", error);
      setStatus("error");
      setLastResult({
        success: false,
        error: "Network error. Please try again.",
        code: "NETWORK_ERROR",
      });
      playSound("error");
    }
  };

  // Play sound feedback
  const playSound = (type: "success" | "error") => {
    if (!soundEnabled) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === "success") {
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } else {
      oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    }
  };

  // Manual QR code input
  const [manualInput, setManualInput] = useState("");
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    await handleQRCodeDetected(manualInput.trim());
    setManualInput("");
  };

  // Continuous scanning loop
  useEffect(() => {
    let animationId: number;

    const loop = () => {
      if (scanning && status === "idle") {
        scanFrame();
      }
      animationId = requestAnimationFrame(loop);
    };

    if (scanning) {
      animationId = requestAnimationFrame(loop);
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [scanning, status, scanFrame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, [stream]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1a1a1a] bg-black/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-[#9AE600]" />
            </Link>
            <Image
              src="https://vitopia.vitap.ac.in/_next/image?url=%2Fvitopia-color.webp&w=256&q=75"
              alt="VITopia"
              width={140}
              height={45}
              className="h-10 w-auto"
              unoptimized
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
              title={soundEnabled ? "Mute sounds" : "Enable sounds"}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5 text-[#9AE600]" /> : <VolumeX className="w-5 h-5 text-[#99A1AF]" />}
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                showSettings ? "bg-[#9AE600] text-black" : "bg-[#1a1a1a] text-[#99A1AF] hover:text-white"
              }`}
            >
              Settings
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 flex flex-col">
        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 mb-6 space-y-4">
            <div>
              <label className="block text-sm text-[#99A1AF] mb-2">Gate ID</label>
              <input
                type="text"
                value={gateId}
                onChange={(e) => setGateId(e.target.value)}
                className="w-full px-4 py-2 bg-black border border-[#1a1a1a] rounded-lg text-white focus:border-[#9AE600] focus:outline-none transition-colors"
                placeholder="Enter gate identifier"
              />
            </div>
            <div>
              <label className="block text-sm text-[#99A1AF] mb-2">Event Filter</label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-4 py-2 bg-black border border-[#1a1a1a] rounded-lg text-white focus:border-[#9AE600] focus:outline-none transition-colors"
              >
                <option value="">All Events</option>
                {orderedEvents.map((event) => (
                  <option key={event._id} value={event._id}>
                    {getEventDisplayName(event)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Scan Stats */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-[#9AE600]">{scanCount.success}</p>
            <p className="text-sm text-[#99A1AF]">Verified</p>
          </div>
          <div className="flex-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-red-500">{scanCount.failed}</p>
            <p className="text-sm text-[#99A1AF]">Rejected</p>
          </div>
        </div>

        {/* Camera View */}
        <div className="relative aspect-square bg-[#0a0a0a] rounded-2xl overflow-hidden mb-6 border border-[#1a1a1a]">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Overlay */}
          {scanning && (
            <div className="scanner-overlay">
              <div className="scanner-frame relative">
                {status === "idle" && <div className="scanner-line" />}
              </div>
            </div>
          )}

          {/* Status Overlay */}
          {status !== "idle" && status !== "scanning" && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center ${
                status === "success"
                  ? "bg-[#9AE600]/90"
                  : status === "already_used"
                  ? "bg-yellow-500/90"
                  : "bg-red-500/90"
              }`}
            >
              {status === "success" ? (
                <CheckCircle className="w-24 h-24 mb-4 text-black animate-pulse-success" />
              ) : status === "already_used" ? (
                <AlertCircle className="w-24 h-24 mb-4 text-black animate-pulse-error" />
              ) : (
                <XCircle className="w-24 h-24 mb-4 text-white animate-pulse-error" />
              )}
              <h2 className={`text-2xl font-bold mb-2 font-heading ${status === "success" || status === "already_used" ? "text-black" : "text-white"}`}>
                {status === "success"
                  ? "ENTRY ALLOWED"
                  : status === "already_used"
                  ? "ALREADY SCANNED"
                  : "ENTRY DENIED"}
              </h2>
              {lastResult?.data && (
                <div className={`text-center ${status === "success" || status === "already_used" ? "text-black/80" : "text-white/80"}`}>
                  <p className="text-lg font-semibold">{lastResult.data.user?.name ?? "Unknown attendee"}</p>
                  <p className="text-sm">{lastResult.data.quantity} ticket(s)</p>
                  {lastResult?.data?.event && <p className="text-sm mt-1 opacity-80">{getEventDisplayName(lastResult.data.event as Event)}</p>}
                  {lastResult.data.tshirt?.eligible && (
                    <p className="text-xs mt-1">
                      T-Shirt: {lastResult.data.tshirt.size || "NA"} / {lastResult.data.tshirt.color || "NA"}
                    </p>
                  )}
                </div>
              )}
              {lastResult?.error && (
                <p className="text-sm text-white/80 mt-2">{lastResult.error}</p>
              )}
            </div>
          )}

          {/* Camera not started */}
          {!scanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a]">
              <CameraOff className="w-16 h-16 text-[#99A1AF] mb-4" />
              <p className="text-[#99A1AF] mb-6">Camera not active</p>
              <button
                onClick={startCamera}
                className="px-8 py-4 bg-[#9AE600] text-black rounded-xl hover:bg-[#7bc400] font-semibold flex items-center gap-2 glow-primary transition-all"
              >
                <Camera className="w-5 h-5" />
                Start Scanner
              </button>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-4 mb-6">
          {scanning ? (
            <>
              <button
                onClick={stopCamera}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <CameraOff className="w-5 h-5" />
                Stop
              </button>
              <button
                onClick={() => {
                  setStatus("idle");
                  lastScannedRef.current = "";
                }}
                className="py-3 px-4 bg-[#1a1a1a] text-white rounded-xl hover:bg-[#2a2a2a] transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button
              onClick={startCamera}
              className="flex-1 py-4 bg-[#9AE600] text-black rounded-xl hover:bg-[#7bc400] font-semibold flex items-center justify-center gap-2 glow-primary transition-all"
            >
              <Camera className="w-5 h-5" />
              Start Scanning
            </button>
          )}
        </div>

        {/* Manual Input */}
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
          <p className="text-sm text-[#99A1AF] mb-3">Manual entry:</p>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="flex-1 px-4 py-2 bg-black border border-[#1a1a1a] rounded-lg text-white focus:border-[#9AE600] focus:outline-none transition-colors"
              placeholder="Paste ticket code"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#9AE600] text-black rounded-lg hover:bg-[#7bc400] font-semibold transition-colors"
            >
              Verify
            </button>
          </form>
        </div>

        {/* Last Scan Info */}
        {lastResult && (
          <div className="mt-6 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
            <h3 className="text-sm font-medium text-[#99A1AF] mb-3">Last Scan</h3>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-[#99A1AF]">Status</span>
                <span className={lastResult.success ? "text-[#9AE600]" : "text-red-400"}>
                  {lastResult.code}
                </span>
              </div>
              {lastResult.data?.orderId && (
                <div className="flex justify-between">
                  <span className="text-[#99A1AF]">Order</span>
                  <span className="font-mono text-xs">{lastResult.data.orderId}</span>
                </div>
              )}
              {lastResult.data?.tshirt?.eligible && (
                <div className="flex justify-between">
                  <span className="text-[#99A1AF]">T-Shirt</span>
                  <span>{lastResult.data.tshirt.size || "NA"} / {lastResult.data.tshirt.color || "NA"}</span>
                </div>
              )}
              {lastResult.responseTime && (
                <div className="flex justify-between">
                  <span className="text-[#99A1AF]">Response</span>
                  <span>{lastResult.responseTime}ms</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] py-4">
        <div className="max-w-lg mx-auto px-4 text-center text-[#99A1AF] text-sm">
          <p>VITopia &apos;26 Entry Scanner</p>
        </div>
      </footer>
    </div>
  );
}
