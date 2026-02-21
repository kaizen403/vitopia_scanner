"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  LayoutDashboard,
  X,
  Sparkles,
  MapPin,
} from "lucide-react";
import {
  verifyTicket,
  ScanResult,
  getEvents,
  Event,
  lookupTicketHistory,
  TicketHistoryData,
} from "@/lib/api";

type ScanStatus = "idle" | "scanning" | "success" | "error" | "already_used";
type HistoryLookupStatus = "idle" | "scanning" | "loading" | "success" | "error";

interface ScanRecord {
  id: string;
  name: string;
  email: string;
  orderId: string;
  status: "success" | "failed";
  timestamp: number;
  reason?: string;
  checkedInAt?: number;
}

const EVENT_NAME_BY_TOKEN: Record<string, string> = {
  DAY_1: "Pro Show Day 1",
  DAY_2: "Pro Show Day 2",
  DAY_3: "Pro Show Day 3",
  PRANAV: "Pranav Sharma Stand Up",
  UDAYA: "Uday Boddeda Stand Up",
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

function formatEventName(name: string): string {
  if (name === "Vitopia2026-Day1") return "Pro Show Day 1";
  if (name === "Vitopia2026-Day2") return "Pro Show Day 2";
  if (name === "Vitopia2026-Day3") return "Pro Show Day 3";
  if (name.includes("Pranav Sharma")) return "Pranav Sharma Stand Up";
  if (name.includes("Sarat Raja Uday Boddeda") || name.includes("Uday")) return "Uday Boddeda Stand Up";
  return name;
}

function getEventDisplayName(event: Event): string {
  const token = event.accessToken ?? "";
  return EVENT_NAME_BY_TOKEN[token] ?? formatEventName(event.name);
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

function formatTime(timestamp?: number): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateTime(timestamp?: number | null): string {
  if (!timestamp) return "Never";
  return new Date(timestamp).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHistoryEvent(name: string, accessToken: string | null): string {
  if (accessToken && EVENT_NAME_BY_TOKEN[accessToken]) {
    return EVENT_NAME_BY_TOKEN[accessToken];
  }
  return formatEventName(name);
}

function getFailureMessage(result: ScanResult): string {
  if (result.code === "NOT_PAID") return "Not paid";
  if (result.code === "NOT_FOUND") return "Not found";
  if (result.code === "INVALID_QR") return result.error || "Invalid QR";
  if (result.code === "ALREADY_USED" && result.checkedInAt) {
    return `Scanned ${formatTime(result.checkedInAt)}`;
  }
  return result.error || result.code;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => {
      detect: (source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap) => Promise<Array<{ rawValue: string }>>;
    };
  }
}

export default function Home() {
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
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
  const detectorRef = useRef<InstanceType<NonNullable<typeof window.BarcodeDetector>> | null>(null);
  const rafIdRef = useRef<number>(0);
  const statusRef = useRef<ScanStatus>("idle");
  const historyVideoRef = useRef<HTMLVideoElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyStream, setHistoryStream] = useState<MediaStream | null>(null);
  const [historyScanning, setHistoryScanning] = useState(false);
  const [historyStatus, setHistoryStatus] = useState<HistoryLookupStatus>("idle");
  const [historyResult, setHistoryResult] = useState<TicketHistoryData | null>(null);
  const [historyError, setHistoryError] = useState<string>("");
  const historyDetectorRef =
    useRef<InstanceType<NonNullable<typeof window.BarcodeDetector>> | null>(null);
  const historyRafIdRef = useRef<number>(0);
  const historyLastScannedRef = useRef<string>("");
  const historyStatusRef = useRef<HistoryLookupStatus>("idle");
  const resumeMainScanRef = useRef<boolean>(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [carnivalDropdownOpen, setCarnivalDropdownOpen] = useState(false);
  const carnivalDropdownRef = useRef<HTMLDivElement>(null);

  const verifiedScans = scanHistory.filter((s) => s.status === "success");
  const rejectedScans = scanHistory.filter((s) => s.status === "failed");
  const orderedEvents = useMemo(() => sortEventsForScanner(events), [events]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const data = await getEvents();
    setEvents(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("gateId");
    if (!token) {
      router.push("/login");
    } else {
      setHasAccess(true);
    }
  }, [router]);

  useEffect(() => {
    if (hasAccess) {
      void loadEvents();
    }
  }, [loadEvents, hasAccess]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    historyStatusRef.current = historyStatus;
  }, [historyStatus]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (carnivalDropdownRef.current && !carnivalDropdownRef.current.contains(e.target as Node)) {
        setCarnivalDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          focusMode: "continuous",
        } as MediaTrackConstraints,
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
    cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = 0;

    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      setStream(null);
    }
    setScanning(false);
    setStatus("idle");
  }, [stream]);

  const startHistoryCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          focusMode: "continuous",
        } as MediaTrackConstraints,
      });

      if (historyVideoRef.current) {
        historyVideoRef.current.srcObject = mediaStream;
        await historyVideoRef.current.play();
      }

      setHistoryStream(mediaStream);
      setHistoryScanning(true);
      setHistoryStatus("scanning");
      setHistoryError("");
    } catch (error) {
      console.error("Failed to start history camera:", error);
      setHistoryStatus("error");
      setHistoryError("Failed to access camera. Please ensure camera permissions are granted.");
    }
  }, []);

  const stopHistoryCamera = useCallback(
    (resetState: boolean = true) => {
      cancelAnimationFrame(historyRafIdRef.current);
      historyRafIdRef.current = 0;

      if (historyStream) {
        historyStream.getTracks().forEach((track) => {
          track.stop();
        });
        setHistoryStream(null);
      }

      setHistoryScanning(false);

      if (resetState) {
        setHistoryStatus("idle");
        historyLastScannedRef.current = "";
      }
    },
    [historyStream]
  );

  const handleHistoryQRCodeDetected = useCallback(
    async (qrCode: string) => {
      setHistoryStatus("loading");
      setHistoryError("");

      try {
        const result = await lookupTicketHistory(qrCode, gateId);
        if (result.success && result.data) {
          setHistoryResult(result.data);
          setHistoryStatus("success");
        } else {
          setHistoryResult(null);
          setHistoryStatus("error");
          setHistoryError(result.error || "Unable to fetch ticket history.");
        }
      } catch (error) {
        console.error("History lookup failed:", error);
        setHistoryResult(null);
        setHistoryStatus("error");
        setHistoryError("Network error. Please try again.");
      } finally {
        stopHistoryCamera(false);
      }
    },
    [stopHistoryCamera]
  );

  const openHistoryModal = useCallback(() => {
    resumeMainScanRef.current = scanning;
    if (scanning) {
      stopCamera();
    }

    setHistoryOpen(true);
    setHistoryResult(null);
    setHistoryError("");
    setHistoryStatus("idle");
    historyLastScannedRef.current = "";
    void startHistoryCamera();
  }, [scanning, startHistoryCamera, stopCamera]);

  const closeHistoryModal = useCallback(() => {
    stopHistoryCamera(true);
    setHistoryOpen(false);
    setHistoryResult(null);
    setHistoryError("");

    if (resumeMainScanRef.current) {
      resumeMainScanRef.current = false;
      void startCamera();
    }
  }, [startCamera, stopHistoryCamera]);

  const scanHistoryAgain = useCallback(() => {
    setHistoryResult(null);
    setHistoryError("");
    setHistoryStatus("idle");
    historyLastScannedRef.current = "";
    void startHistoryCamera();
  }, [startHistoryCamera]);

  const playSound = useCallback((type: "success" | "error") => {
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
  }, [soundEnabled]);

  const handleQRCodeDetected = useCallback(
    async (qrCode: string) => {
      setStatus("scanning");

      try {
        const result = await verifyTicket(qrCode, gateId, selectedEvent?.id || undefined);
        setLastResult(result);

        const record: ScanRecord = {
          id: Date.now().toString(),
          name: result.data?.user?.name || "Unknown",
          email: result.data?.user?.email || "",
          orderId: result.data?.orderId || "",
          status: result.success ? "success" : "failed",
          timestamp: Date.now(),
          reason: getFailureMessage(result),
          checkedInAt: result.checkedInAt,
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
    },
    [playSound, selectedEvent?.id]
  );

  useEffect(() => {
    if (!scanning || !videoRef.current) return;

    const video = videoRef.current;
    let isActive = true;

    const useNative = typeof window !== "undefined" && !!window.BarcodeDetector;

    if (useNative) {
      if (!detectorRef.current) {
        detectorRef.current = new window.BarcodeDetector!({ formats: ["qr_code"] });
      }

      let lastFrameTime = 0;
      const scanLoop = async (timestamp: number) => {
        if (!isActive) return;
        if (timestamp - lastFrameTime < 80) {
          rafIdRef.current = requestAnimationFrame(scanLoop);
          return;
        }
        lastFrameTime = timestamp;

        try {
          if (video.readyState >= 2 && statusRef.current === "idle") {
            const barcodes = await detectorRef.current!.detect(video);
            if (isActive && barcodes.length > 0) {
              const qrCode = barcodes[0].rawValue;
              if (qrCode && qrCode !== lastScannedRef.current) {
                lastScannedRef.current = qrCode;
                void handleQRCodeDetected(qrCode);
              }
            }
          }
        } catch (_) { /* detection failed this frame, retry next */ }

        if (isActive) {
          rafIdRef.current = requestAnimationFrame(scanLoop);
        }
      };

      rafIdRef.current = requestAnimationFrame(scanLoop);
    } else {
      let zxingReader: any = null;
      let zxingControls: any = null;

      const startZxing = async () => {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (!isActive) return;
        zxingReader = new BrowserQRCodeReader();
        zxingControls = await zxingReader.decodeFromVideoElement(video, (result: any) => {
          if (!isActive || !result) return;
          if (statusRef.current !== "idle") return;
          const qrCode = result.getText();
          if (qrCode !== lastScannedRef.current) {
            lastScannedRef.current = qrCode;
            void handleQRCodeDetected(qrCode);
          }
        });
      };

      startZxing().catch(console.error);

      return () => {
        isActive = false;
        zxingControls?.stop();
      };
    }

    return () => {
      isActive = false;
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    };
  }, [scanning, handleQRCodeDetected]);

  useEffect(() => {
    if (!historyOpen || !historyScanning || !historyVideoRef.current) return;

    const video = historyVideoRef.current;
    let isActive = true;

    const useNative = typeof window !== "undefined" && !!window.BarcodeDetector;

    if (useNative) {
      if (!historyDetectorRef.current) {
        historyDetectorRef.current = new window.BarcodeDetector!({ formats: ["qr_code"] });
      }

      let lastFrameTime = 0;
      const scanLoop = async (timestamp: number) => {
        if (!isActive) return;
        if (timestamp - lastFrameTime < 80) {
          historyRafIdRef.current = requestAnimationFrame(scanLoop);
          return;
        }
        lastFrameTime = timestamp;

        try {
          if (video.readyState >= 2 && historyStatusRef.current === "scanning") {
            const barcodes = await historyDetectorRef.current!.detect(video);
            if (isActive && barcodes.length > 0) {
              const qrCode = barcodes[0].rawValue;
              if (qrCode && qrCode !== historyLastScannedRef.current) {
                historyLastScannedRef.current = qrCode;
                void handleHistoryQRCodeDetected(qrCode);
              }
            }
          }
        } catch (_) {}

        if (isActive) {
          historyRafIdRef.current = requestAnimationFrame(scanLoop);
        }
      };

      historyRafIdRef.current = requestAnimationFrame(scanLoop);
    } else {
      let zxingReader: any = null;
      let zxingControls: any = null;

      const startZxing = async () => {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (!isActive) return;
        zxingReader = new BrowserQRCodeReader();
        zxingControls = await zxingReader.decodeFromVideoElement(video, (result: any) => {
          if (!isActive || !result) return;
          if (historyStatusRef.current !== "scanning") return;
          const qrCode = result.getText();
          if (qrCode !== historyLastScannedRef.current) {
            historyLastScannedRef.current = qrCode;
            void handleHistoryQRCodeDetected(qrCode);
          }
        });
      };

      startZxing().catch(console.error);

      return () => {
        isActive = false;
        zxingControls?.stop();
      };
    }

    return () => {
      isActive = false;
      cancelAnimationFrame(historyRafIdRef.current);
      historyRafIdRef.current = 0;
    };
  }, [historyOpen, historyScanning, handleHistoryQRCodeDetected]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
      cancelAnimationFrame(historyRafIdRef.current);
      historyRafIdRef.current = 0;

      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
      }
      if (historyStream) {
        historyStream.getTracks().forEach((track) => {
          track.stop();
        });
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, [historyStream, stream]);

  const handleBackToEvents = () => {
    stopCamera();
    setSelectedEvent(null);
    setScanHistory([]);
    setLastResult(null);
    setShowVerified(false);
    setShowRejected(false);
  };

  // ============ EVENT SELECTION SCREEN ============
  if (!hasAccess) return null;

  if (!selectedEvent) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <header className="border-b border-[#1a1a1a] bg-black/90 backdrop-blur-sm safe-top">
          <div className="max-w-md mx-auto px-4 py-5 flex items-center justify-center">
            <Image
              src="https://vitopia.vitap.ac.in/_next/image?url=%2Fvitopia-color.webp&w=256&q=75"
              alt="VITopia"
              width={240}
              height={75}
              className="h-16 w-auto"
              unoptimized
            />
          </div>
        </header>

        <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 flex flex-col">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white mb-1">Entry Scanner</h1>
            <p className="text-sm text-[#99A1AF]">Select an event to start scanning</p>
          </div>

          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-pulse text-[#9AE600]">Loading events...</div>
            </div>
          )}

          {!loading && (
            <div className="space-y-5">
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen((o) => !o);
                    setCarnivalDropdownOpen(false);
                  }}
                  className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl px-4 py-4 text-left flex items-center justify-between focus:outline-none focus:border-[#9AE600]/50 focus:ring-1 focus:ring-[#9AE600]/30 transition-all"
                >
                  <span className="text-base text-[#99A1AF]">Prime events</span>
                  <ChevronDown className={`w-5 h-5 text-[#9AE600] transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute z-50 mt-2 w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden shadow-2xl shadow-black/60">
                    {orderedEvents
                      .filter((ev) => ev.accessToken)
                      .map((event) => (
                        <button
                          type="button"
                          key={event.id}
                          onClick={() => {
                            setSelectedEvent(event);
                            setDropdownOpen(false);
                          }}
                          className="w-full px-4 py-3.5 text-left text-sm text-white hover:bg-[#9AE600]/10 transition-colors flex items-center gap-3 border-b border-[#1a1a1a] last:border-b-0"
                        >
                          <Calendar className="w-4 h-4 text-[#9AE600] shrink-0" />
                          <span>{getEventDisplayName(event)}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {orderedEvents.filter((ev) => ev.accessToken).length === 0 && (
                <div className="text-center py-10 text-[#99A1AF]">
                  <p>No events available</p>
                </div>
              )}

              {orderedEvents.filter((ev) => !ev.accessToken && ev.isActive).length > 0 && (
                <div className="relative" ref={carnivalDropdownRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setCarnivalDropdownOpen((o) => !o);
                      setDropdownOpen(false);
                    }}
                    className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl px-4 py-4 text-left flex items-center justify-between focus:outline-none focus:border-[#9AE600]/50 focus:ring-1 focus:ring-[#9AE600]/30 transition-all"
                  >
                    <span className="text-base text-[#99A1AF]">Non-prime events</span>
                    <ChevronDown className={`w-5 h-5 text-[#9AE600] transition-transform ${carnivalDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {carnivalDropdownOpen && (
                    <div className="absolute z-50 mt-2 w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden shadow-2xl shadow-black/60 max-h-72 overflow-y-auto">
                      {orderedEvents
                        .filter((ev) => !ev.accessToken && ev.isActive)
                        .map((event) => (
                          <button
                            type="button"
                            key={event.id}
                            onClick={() => {
                              setSelectedEvent(event);
                              setCarnivalDropdownOpen(false);
                            }}
                            className="w-full px-4 py-3.5 text-left text-sm text-white hover:bg-[#9AE600]/10 transition-colors flex items-center gap-3 border-b border-[#1a1a1a] last:border-b-0"
                          >
                            <Sparkles className="w-4 h-4 text-[#9AE600] shrink-0" />
                            <div className="min-w-0 flex-1">
                              <span className="block truncate">{event.name}</span>
                              {event.venue && (
                                <span className="flex items-center gap-1 text-xs text-[#99A1AF] mt-0.5">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  {event.venue}
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-3">
                <a
                  href="/dashboard"
                  className="block w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#1a1a1a]">
                      <LayoutDashboard className="w-5 h-5 text-[#9AE600]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base font-semibold text-white truncate">Dashboard</h2>
                      <p className="text-xs text-[#99A1AF]">Analytics & scan history</p>
                    </div>
                    <LayoutDashboard className="w-5 h-5 text-[#9AE600]" />
                  </div>
                </a>
              </div>
            </div>
          )}
        </main>

        <footer className="border-t border-[#1a1a1a] py-3 safe-bottom">
          <div className="max-w-md mx-auto px-4 text-center text-[#99A1AF] text-xs">
            <p>VITopia &apos;26 Entry Scanner · built by <em className="italic">AIR</em></p>
          </div>
        </footer>
      </div>
    );
  }

  // ============ SCANNER SCREEN ============
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="border-b border-[#1a1a1a] bg-black/90 backdrop-blur-sm sticky top-0 z-50 safe-top">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBackToEvents}
              className="p-2 -ml-2 active:bg-[#1a1a1a] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#9AE600]" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-white">{getEventDisplayName(selectedEvent)}</h1>
              <p className="text-[10px] text-[#99A1AF]">{selectedEvent.venue}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 active:bg-[#1a1a1a] rounded-lg transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5 text-[#9AE600]" /> : <VolumeX className="w-5 h-5 text-[#99A1AF]" />}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-4 flex flex-col overflow-auto">
        {/* Scan Stats - Clickable */}
        <div className="flex gap-3 mb-6">
          <button
            type="button"
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
            type="button"
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

        <button
          type="button"
          onClick={openHistoryModal}
          className="w-full mb-6 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl px-4 py-3 text-sm font-semibold text-[#9AE600] active:scale-[0.99] transition-all"
        >
          View History
        </button>

        {/* Verified List */}
        {showVerified && verifiedScans.length > 0 && (
          <div className="mb-6 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3 max-h-48 overflow-auto">
            <p className="text-xs text-[#99A1AF] mb-2">Verified Entries</p>
            <div className="space-y-2">
              {verifiedScans.map((scan) => (
                <div key={scan.id} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-[#9AE600] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white truncate">{scan.name}</p>
                    <p className="text-[10px] text-[#99A1AF] truncate">{scan.orderId}</p>
                  </div>
                  <p className="text-[10px] text-[#99A1AF] flex-shrink-0">{formatTime(scan.timestamp)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rejected List */}
        {showRejected && rejectedScans.length > 0 && (
          <div className="mb-6 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3 max-h-48 overflow-auto">
            <p className="text-xs text-[#99A1AF] mb-2">Rejected Entries</p>
            <div className="space-y-2">
              {rejectedScans.map((scan) => (
                <div key={scan.id} className="flex items-center gap-2 text-sm">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white truncate">{scan.name}</p>
                    <p className="text-[10px] text-[#99A1AF] truncate">{scan.reason}</p>
                    <p className="text-[10px] text-[#99A1AF]">Rejected {formatTime(scan.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Camera View */}
        <div className="relative aspect-[4/3] bg-[#0a0a0a] rounded-2xl overflow-hidden mb-6 border border-[#1a1a1a]">
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

          {!scanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a]">
              <CameraOff className="w-12 h-12 text-[#99A1AF] mb-3" />
              <p className="text-sm text-[#99A1AF] mb-6">Camera not active</p>
              <button
                type="button"
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
        {scanning && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={stopCamera}
              className="flex-1 py-3 bg-red-900 text-white rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <CameraOff className="w-5 h-5" />
              Stop
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus("idle");
                lastScannedRef.current = "";
              }}
              className="py-3 px-4 bg-[#1a1a1a] text-white rounded-xl active:bg-[#2a2a2a] transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        )}
      </main>
      {/* Full-screen scan result overlay */}
      {status !== "idle" && status !== "scanning" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4">
          <div className="w-full max-w-sm">
            {/* Status indicator — floating above the card */}
            <div className="flex flex-col items-center mb-5">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${
                status === "success"
                  ? "bg-[#9AE600]/15 ring-2 ring-[#9AE600]/30"
                  : status === "already_used"
                  ? "bg-yellow-500/15 ring-2 ring-yellow-500/30"
                  : "bg-red-500/15 ring-2 ring-red-500/30"
              }`}>
                {status === "success" ? (
                  <CheckCircle className="w-7 h-7 text-[#9AE600]" />
                ) : status === "already_used" ? (
                  <AlertCircle className="w-8 h-8 text-yellow-500" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-500" />
                )}
              </div>
              <h2 className={`text-xl font-bold tracking-wider ${
                status === "success"
                  ? "text-[#9AE600]"
                  : status === "already_used"
                  ? "text-yellow-500"
                  : "text-red-500"
              }`}>
                {status === "success"
                  ? "ENTRY ALLOWED"
                  : status === "already_used"
                  ? "ALREADY SCANNED"
                  : "ENTRY DENIED"}
              </h2>
            </div>

            {/* Info card */}
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl overflow-hidden shadow-2xl">
              {/* Top accent bar */}
              <div className={`h-1 w-full ${
                status === "success"
                  ? "bg-[#9AE600]"
                  : status === "already_used"
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`} />

              <div className="divide-y divide-[#1a1a1a]">
                {/* Previously scanned warning */}
                {status === "already_used" && (
                  <div className="px-4 py-3 bg-yellow-500/5">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] text-yellow-500/70 uppercase tracking-wider">Previously Scanned</p>
                        <p className="text-sm text-yellow-400 font-medium mt-0.5">
                          {formatTime(
                            lastResult?.checkedInAt ??
                              scanHistory.find(
                                (entry) =>
                                  entry.orderId === (lastResult?.data?.orderId ?? "") &&
                                  entry.status === "success"
                              )?.timestamp ??
                              Date.now()
                          )}
                        </p>
                      </div>
                      {lastResult?.checkedInByName && (
                        <div className="text-right">
                          <p className="text-[10px] text-yellow-500/70 uppercase tracking-wider">Gate</p>
                          <p className="text-sm text-yellow-400 font-medium mt-0.5">{lastResult.checkedInByName}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Attendee */}
                {lastResult?.data && (
                  <div className="px-4 py-3">
                    <p className="text-[10px] text-[#6b7280] uppercase tracking-wider">Attendee</p>
                    <p className="text-[15px] text-white font-semibold mt-0.5">
                      {lastResult.data.user?.name ?? "Unknown attendee"}
                    </p>
                  </div>
                )}

                {/* Event */}
                {lastResult?.data?.event && (
                  <div className="px-4 py-3 border-b border-[#2a2a2a] last:border-0 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-[#6b7280] uppercase tracking-wider">Registered For</p>
                      <p className="text-sm text-white font-medium mt-0.5">
                        {getEventDisplayName(lastResult.data.event as Event)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[#6b7280] uppercase tracking-wider">Scanned At</p>
                      <p className="text-sm text-white font-medium mt-0.5">
                        {formatTime(Date.now())}
                      </p>
                    </div>
                  </div>
                )}

                {/* T-Shirt — only for T-Shirt Distribution event */}
                {selectedEvent?.accessToken === "TSHIRT" && lastResult?.data?.tshirt?.eligible && (
                  <div className="px-4 py-3">
                    <p className="text-[10px] text-[#6b7280] uppercase tracking-wider">T-Shirt</p>
                    <p className="text-sm text-white font-medium mt-0.5">
                      {lastResult.data.tshirt.size || "N/A"} / {lastResult.data.tshirt.color || "N/A"}
                    </p>
                  </div>
                )}

                {/* Error reason */}
                {status === "error" && lastResult?.error && (
                  <div className="px-4 py-3 bg-red-500/5">
                    <p className="text-[10px] text-red-500/70 uppercase tracking-wider">Reason</p>
                    <p className="text-sm text-red-400 mt-0.5">{lastResult.error}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Next Scan button — prominent, outside the card */}
            <button
              onClick={() => {
                setStatus("idle");
                lastScannedRef.current = "";
              }}
              type="button"
              className={`w-full mt-4 py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.97] ${
                status === "success"
                  ? "bg-[#9AE600] text-black hover:bg-[#8AD500]"
                  : "bg-white/10 text-white hover:bg-white/15"
              }`}
            >
              <Camera className="w-5 h-5" />
              Next Scan
            </button>
          </div>
        </div>
      )}


      {historyOpen && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#050505] border border-[#1a1a1a] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">View History</p>
                <p className="text-xs text-[#99A1AF]">Scan one QR to see past usage</p>
              </div>
              <button
                type="button"
                onClick={closeHistoryModal}
                className="p-2 rounded-lg active:bg-[#1a1a1a] transition-colors"
              >
                <X className="w-5 h-5 text-[#99A1AF]" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[80vh] overflow-auto">
              <div className="relative aspect-[4/3] bg-[#0a0a0a] rounded-xl overflow-hidden border border-[#1a1a1a]">
                <video
                  ref={historyVideoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                  muted
                />

                {historyScanning && historyStatus === "scanning" && (
                  <div className="scanner-overlay">
                    <div className="scanner-frame relative">
                      <div className="scanner-line" />
                    </div>
                  </div>
                )}

                {historyStatus === "loading" && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center">
                    <RefreshCw className="w-8 h-8 text-[#9AE600] animate-spin mb-2" />
                    <p className="text-sm text-white">Fetching ticket history...</p>
                  </div>
                )}

                {!historyScanning && historyStatus === "idle" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a]">
                    <CameraOff className="w-10 h-10 text-[#99A1AF] mb-2" />
                    <p className="text-sm text-[#99A1AF] mb-3">History scanner is not active</p>
                    <button
                      type="button"
                      onClick={scanHistoryAgain}
                      className="px-5 py-2.5 bg-[#9AE600] text-black rounded-lg text-sm font-semibold"
                    >
                      Start Scanner
                    </button>
                  </div>
                )}
              </div>

              {historyStatus === "error" && (
                <div className="bg-[#0a0a0a] border border-red-500/40 rounded-xl p-3">
                  <p className="text-sm text-red-400">{historyError || "Unable to fetch history."}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={scanHistoryAgain}
                      className="flex-1 py-2 text-sm rounded-lg bg-[#1a1a1a] text-white"
                    >
                      Scan Again
                    </button>
                    <button
                      type="button"
                      onClick={closeHistoryModal}
                      className="flex-1 py-2 text-sm rounded-lg bg-[#9AE600] text-black font-semibold"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {historyStatus === "success" && historyResult && (
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3 space-y-3">
                  <div>
                    <p className="text-xs text-[#99A1AF]">Attendee</p>
                    <p className="text-sm text-white font-semibold">{historyResult.user?.name || "Unknown"}</p>
                    <p className="text-xs text-[#99A1AF]">{historyResult.user?.email || "N/A"}</p>
                  </div>

                  <div>
                    <p className="text-xs text-[#99A1AF]">Order ID</p>
                    <p className="text-sm text-white">{historyResult.orderId}</p>
                  </div>

                  <div>
                    <p className="text-xs text-[#99A1AF]">Last Scanned</p>
                    <p className="text-sm text-white">{formatDateTime(historyResult.lastScannedAt)}</p>
                  </div>

                  <div>
                    <p className="text-xs text-[#99A1AF] mb-1">Events Bought</p>
                    <div className="flex flex-wrap gap-2">
                      {historyResult.purchasedEvents.length > 0 ? (
                        historyResult.purchasedEvents.map((event) => (
                          <span
                            key={event.id}
                            className="text-xs px-2 py-1 rounded-full bg-[#141414] border border-[#1f1f1f] text-[#d5d5d5]"
                          >
                            {formatHistoryEvent(event.name, event.accessToken)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[#99A1AF]">No event data</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-[#99A1AF] mb-1">Scan Timeline</p>
                    <div className="space-y-2 max-h-36 overflow-auto pr-1">
                      {historyResult.scanHistory.length > 0 ? (
                        historyResult.scanHistory.map((entry, index) => (
                          <div key={`${entry.timestamp}-${index}`} className="text-xs border border-[#1a1a1a] rounded-lg p-2">
                            <p className="text-white">
                              {entry.event
                                ? formatHistoryEvent(entry.event.name, entry.event.accessToken)
                                : "Unknown Event"}
                            </p>
                            <p className="text-[#99A1AF]">{formatDateTime(entry.timestamp)}</p>
                            <p className="text-[#99A1AF]">{entry.scanResult.replaceAll("_", " ")}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-[#99A1AF]">No scans yet</p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={scanHistoryAgain}
                    className="w-full py-2.5 rounded-lg bg-[#9AE600] text-black text-sm font-semibold"
                  >
                    Scan Another
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
