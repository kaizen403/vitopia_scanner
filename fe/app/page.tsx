"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
  Camera,
  CameraOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Volume2,
  VolumeX,
  Calendar,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  User,
} from "lucide-react";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import { verifyTicket, ScanResult, getEvents, Event } from "@/lib/api";

type ScanStatus = "idle" | "scanning" | "success" | "error" | "already_used";

interface ScanRecord {
  id: string;
  name: string;
  email: string;
  orderId: string;
  status: "success" | "failed";
  timestamp: number;
  reason?: string;
}

function formatEventName(name: string): string {
  if (name === "Vitopia2026-Day1") return "Vitopia Day 1";
  if (name === "Vitopia2026-Day2") return "Vitopia Day 2";
  return name;
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const gateId = "gate-1";
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([]);
  const [showVerified, setShowVerified] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  const lastScannedRef = useRef<string>("");
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const barcodeReaderRef = useRef<BrowserQRCodeReader | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const statusRef = useRef<ScanStatus>("idle");

  const verifiedScans = scanHistory.filter((s) => s.status === "success");
  const rejectedScans = scanHistory.filter((s) => s.status === "failed");

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  async function loadEvents() {
    setLoading(true);
    const data = await getEvents();
    setEvents(data);
    setLoading(false);
  }

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

  const stopCamera = useCallback(() => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setScanning(false);
    setStatus("idle");
  }, [stream]);

  useEffect(() => {
    if (!scanning || !videoRef.current) return;

    const video = videoRef.current;

    if (!barcodeReaderRef.current) {
      barcodeReaderRef.current = new BrowserQRCodeReader();
    }

    let isActive = true;

    const startDecode = async () => {
      try {
        const controls = await barcodeReaderRef.current!.decodeFromVideoElement(video, (result) => {
          if (!isActive || !result) return;
          if (statusRef.current !== "idle") return;

          const qrCode = result.getText();
          if (qrCode !== lastScannedRef.current) {
            lastScannedRef.current = qrCode;
            void handleQRCodeDetected(qrCode);
          }
        });

        scannerControlsRef.current = controls;
      } catch (error) {
        if (!isActive) return;
        console.error("QR scanner error:", error);
      }
    };

    startDecode();

    return () => {
      isActive = false;
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
    };
  }, [scanning, selectedEvent, gateId]);

  const handleQRCodeDetected = async (qrCode: string) => {
    setStatus("scanning");

    try {
      const result = await verifyTicket(qrCode, gateId, selectedEvent?._id || undefined);
      setLastResult(result);

      const record: ScanRecord = {
        id: Date.now().toString(),
        name: result.data?.user?.name || "Unknown",
        email: result.data?.user?.email || "",
        orderId: result.data?.orderId || "",
        status: result.success ? "success" : "failed",
        timestamp: Date.now(),
        reason: result.error || result.code,
      };

      setScanHistory((prev) => [record, ...prev]);

      if (result.success) {
        setStatus("success");
        playSound("success");
      } else if (result.code === "ALREADY_USED") {
        setStatus("already_used");
        playSound("error");
      } else {
        setStatus("error");
        playSound("error");
      }

      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      scanTimeoutRef.current = setTimeout(() => {
        setStatus("idle");
        lastScannedRef.current = "";
      }, 2500);
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

  useEffect(() => {
    return () => {
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, [stream]);

  const handleBackToEvents = () => {
    stopCamera();
    setSelectedEvent(null);
    setScanHistory([]);
    setLastResult(null);
    setShowVerified(false);
    setShowRejected(false);
  };

  // ============ EVENT SELECTION SCREEN ============
  if (!selectedEvent) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <header className="border-b border-[#1a1a1a] bg-black/90 backdrop-blur-sm safe-top">
          <div className="max-w-md mx-auto px-4 py-5 flex justify-center">
            <Image
              src="https://vitopia.vitap.ac.in/_next/image?url=%2Fvitopia-color.webp&w=256&q=75"
              alt="VITopia"
              width={160}
              height={50}
              className="h-10 w-auto"
              unoptimized
            />
          </div>
        </header>

        <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 flex flex-col">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-white mb-1">Entry Scanner</h1>
            <p className="text-sm text-[#99A1AF]">Select an event to start scanning</p>
          </div>

          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-pulse text-[#9AE600]">Loading events...</div>
            </div>
          )}

          {!loading && (
            <div className="space-y-3">
              {events.map((event) => (
                <button
                  key={event._id}
                  onClick={() => setSelectedEvent(event)}
                  className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 text-left active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#1a1a1a]">
                      <Calendar className="w-5 h-5 text-[#9AE600]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base font-semibold text-white truncate">
                        {formatEventName(event.name)}
                      </h2>
                      <p className="text-xs text-[#99A1AF]">
                        {new Date(event.date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })} • {event.venue}
                      </p>
                    </div>
                    <Camera className="w-5 h-5 text-[#9AE600]" />
                  </div>
                </button>
              ))}

              {events.length === 0 && (
                <div className="text-center py-10 text-[#99A1AF]">
                  <p>No events available</p>
                </div>
              )}
            </div>
          )}
        </main>

        <footer className="border-t border-[#1a1a1a] py-3 safe-bottom">
          <div className="max-w-md mx-auto px-4 text-center text-[#99A1AF] text-xs">
            <p>VITopia &apos;26 Entry Scanner</p>
          </div>
        </footer>
      </div>
    );
  }

  // ============ SCANNER SCREEN ============
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="border-b border-[#1a1a1a] bg-black/90 backdrop-blur-sm sticky top-0 z-50 safe-top">
        <div className="max-w-md mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackToEvents}
              className="p-2 -ml-2 active:bg-[#1a1a1a] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#9AE600]" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-white">{formatEventName(selectedEvent.name)}</h1>
              <p className="text-[10px] text-[#99A1AF]">{selectedEvent.venue}</p>
            </div>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 active:bg-[#1a1a1a] rounded-lg transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5 text-[#9AE600]" /> : <VolumeX className="w-5 h-5 text-[#99A1AF]" />}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-4 flex flex-col overflow-auto">
        {/* Scan Stats - Clickable */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => { setShowVerified(!showVerified); setShowRejected(false); }}
            className={`flex-1 bg-[#0a0a0a] border rounded-xl p-3 text-center transition-all ${showVerified ? 'border-[#9AE600]' : 'border-[#1a1a1a]'}`}
          >
            <div className="flex items-center justify-center gap-1">
              <p className="text-2xl font-bold text-[#9AE600]">{verifiedScans.length}</p>
              {showVerified ? <ChevronUp className="w-4 h-4 text-[#9AE600]" /> : <ChevronDown className="w-4 h-4 text-[#99A1AF]" />}
            </div>
            <p className="text-xs text-[#99A1AF]">Verified</p>
          </button>
          <button
            onClick={() => { setShowRejected(!showRejected); setShowVerified(false); }}
            className={`flex-1 bg-[#0a0a0a] border rounded-xl p-3 text-center transition-all ${showRejected ? 'border-red-500' : 'border-[#1a1a1a]'}`}
          >
            <div className="flex items-center justify-center gap-1">
              <p className="text-2xl font-bold text-red-500">{rejectedScans.length}</p>
              {showRejected ? <ChevronUp className="w-4 h-4 text-red-500" /> : <ChevronDown className="w-4 h-4 text-[#99A1AF]" />}
            </div>
            <p className="text-xs text-[#99A1AF]">Rejected</p>
          </button>
        </div>

        {/* Verified List */}
        {showVerified && verifiedScans.length > 0 && (
          <div className="mb-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3 max-h-48 overflow-auto">
            <p className="text-xs text-[#99A1AF] mb-2">Verified Entries</p>
            <div className="space-y-2">
              {verifiedScans.map((scan) => (
                <div key={scan.id} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-[#9AE600] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white truncate">{scan.name}</p>
                    <p className="text-[10px] text-[#99A1AF] truncate">{scan.orderId}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rejected List */}
        {showRejected && rejectedScans.length > 0 && (
          <div className="mb-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3 max-h-48 overflow-auto">
            <p className="text-xs text-[#99A1AF] mb-2">Rejected Entries</p>
            <div className="space-y-2">
              {rejectedScans.map((scan) => (
                <div key={scan.id} className="flex items-center gap-2 text-sm">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white truncate">{scan.name}</p>
                    <p className="text-[10px] text-[#99A1AF] truncate">{scan.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Camera View */}
        <div className="relative aspect-[4/3] bg-[#0a0a0a] rounded-2xl overflow-hidden mb-4 border border-[#1a1a1a]">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {scanning && (
            <div className="scanner-overlay">
              <div className="scanner-frame relative">
                {status === "idle" && <div className="scanner-line" />}
              </div>
            </div>
          )}

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
                <CheckCircle className="w-16 h-16 mb-3 text-black" />
              ) : status === "already_used" ? (
                <AlertCircle className="w-16 h-16 mb-3 text-black" />
              ) : (
                <XCircle className="w-16 h-16 mb-3 text-white" />
              )}
              <h2 className={`text-xl font-bold mb-1 ${status === "success" || status === "already_used" ? "text-black" : "text-white"}`}>
                {status === "success"
                  ? "ENTRY ALLOWED"
                  : status === "already_used"
                  ? "ALREADY SCANNED"
                  : "ENTRY DENIED"}
              </h2>
              {lastResult?.data && (
                <p className={`text-sm ${status === "success" || status === "already_used" ? "text-black/70" : "text-white/70"}`}>
                  {lastResult.data.user.name}
                </p>
              )}
            </div>
          )}

          {!scanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a]">
              <CameraOff className="w-12 h-12 text-[#99A1AF] mb-3" />
              <p className="text-sm text-[#99A1AF] mb-4">Camera not active</p>
              <button
                onClick={startCamera}
                className="px-6 py-3 bg-[#9AE600] text-black rounded-xl font-semibold flex items-center gap-2 active:scale-95 transition-all"
              >
                <Camera className="w-5 h-5" />
                Start Scanner
              </button>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          {scanning ? (
            <>
              <button
                onClick={stopCamera}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <CameraOff className="w-5 h-5" />
                Stop
              </button>
              <button
                onClick={() => {
                  setStatus("idle");
                  lastScannedRef.current = "";
                }}
                className="py-3 px-4 bg-[#1a1a1a] text-white rounded-xl active:bg-[#2a2a2a] transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button
              onClick={startCamera}
              className="flex-1 py-3.5 bg-[#9AE600] text-black rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Camera className="w-5 h-5" />
              Start Scanning
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
