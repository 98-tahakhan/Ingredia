import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CameraOff, Check, ImageIcon, Keyboard, Loader2 } from "lucide-react";
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { toast } from "sonner";

const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
];

const normalizeBarcode = (raw: string) => raw.replace(/[^0-9]/g, "");
const isValidBarcode = (code: string) => /^(\d{8}|\d{12}|\d{13})$/.test(code);

const SCANNER_ELEMENT_ID = "barcode-scanner-viewport";

/**
 * Safely stop the scanner — guards against calling stop() when not running.
 */
async function safeStopScanner(scanner: Html5Qrcode | null): Promise<void> {
  if (!scanner) return;
  try {
    const state = scanner.getState();
    if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
      await scanner.stop();
    }
  } catch {
    // Scanner was already stopped — safe to ignore
  }
}

const Scan = () => {
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [detected, setDetected] = useState(false);
  const [hint, setHint] = useState("Initializing camera...");
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const lockedRef = useRef(false);
  const mountedRef = useRef(true);

  // Navigate to processing once barcode is detected
  const onBarcodeDetected = useCallback((rawCode: string) => {
    if (lockedRef.current) return;
    const code = normalizeBarcode(rawCode);
    if (!isValidBarcode(code)) {
      toast.error("Invalid barcode format");
      return;
    }

    // Lock immediately to prevent duplicate detections
    lockedRef.current = true;
    setDetected(true);
    setHint(`Detected: ${code}`);
    toast.success(`Barcode: ${code}`);

    // Stop scanner safely THEN navigate
    safeStopScanner(scannerRef.current).finally(() => {
      scannerRef.current = null;
      // Small delay for the success animation, then navigate
      setTimeout(() => {
        if (mountedRef.current) {
          navigate(`/processing/${encodeURIComponent(code)}`);
        }
      }, 400);
    });
  }, [navigate]);

  // Start the barcode scanner
  const startScanner = useCallback(async () => {
    lockedRef.current = false;
    setDetected(false);
    setError(null);
    setHint("Initializing camera...");
    setCameraActive(false);

    if (!window.isSecureContext) {
      setError("Camera requires HTTPS or localhost.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera not supported in this browser.");
      return;
    }

    // Clean up any existing scanner
    await safeStopScanner(scannerRef.current);
    scannerRef.current = null;

    // Wait for DOM element to be ready
    await new Promise(r => setTimeout(r, 250));

    const element = document.getElementById(SCANNER_ELEMENT_ID);
    if (!element) {
      setError("Scanner element not found.");
      return;
    }

    try {
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        formatsToSupport: BARCODE_FORMATS,
        verbose: false,
      });
      scannerRef.current = scanner;

      // Get cameras and prefer rear
      const cameras = await Html5Qrcode.getCameras();
      let cameraId: string | undefined;
      if (cameras.length > 0) {
        const rearCamera = cameras.find(c => /back|rear|environment/i.test(c.label));
        cameraId = rearCamera?.id || cameras[cameras.length - 1].id;
      }

      // Wide scan box optimized for 1D retail barcodes
      const viewportWidth = Math.min(element.clientWidth || 320, 640);
      const qrboxWidth = Math.floor(viewportWidth * 0.85);
      const qrboxHeight = Math.floor(qrboxWidth * 0.35);

      const config = {
        fps: 20,
        qrbox: { width: Math.max(qrboxWidth, 250), height: Math.max(qrboxHeight, 80) },
        aspectRatio: 16 / 9,
        disableFlip: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      };

      const successCallback = (decodedText: string) => {
        onBarcodeDetected(decodedText);
      };

      const errorCallback = () => {
        // Fires every frame without a detection — ignore
      };

      if (cameraId) {
        await scanner.start(cameraId, config, successCallback, errorCallback);
      } else {
        await scanner.start({ facingMode: "environment" }, config, successCallback, errorCallback);
      }

      // Apply autofocus if supported
      try {
        const videoElement = element.querySelector("video");
        if (videoElement?.srcObject instanceof MediaStream) {
          const track = videoElement.srcObject.getVideoTracks()[0];
          const capabilities = track.getCapabilities?.() as any;
          if (capabilities?.focusMode?.includes("continuous")) {
            await track.applyConstraints({
              advanced: [{ focusMode: "continuous" } as any],
            });
          }
        }
      } catch {
        // Autofocus not available — fine
      }

      setCameraActive(true);
      setHint("Point at barcode — hold steady");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);

      if (/NotAllowed|permission|denied/i.test(msg)) {
        setError("Camera permission denied. Allow camera access in browser settings.");
      } else if (/NotFound|no camera|not found/i.test(msg)) {
        setError("No camera found on this device.");
      } else if (/NotReadable|in use|already/i.test(msg)) {
        setError("Camera is being used by another app.");
      } else {
        setError("Could not start camera. Use manual entry below.");
      }
    }
  }, [onBarcodeDetected]);

  // Mount/unmount lifecycle
  useEffect(() => {
    mountedRef.current = true;
    startScanner();

    const helpTimer = setTimeout(() => {
      if (!lockedRef.current && mountedRef.current) {
        setHint("Hold barcode 6-10 inches from camera, ensure good lighting");
      }
    }, 10000);

    return () => {
      mountedRef.current = false;
      clearTimeout(helpTimer);
      // Cleanup: safely stop scanner on unmount
      const scanner = scannerRef.current;
      scannerRef.current = null;
      safeStopScanner(scanner);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle barcode image upload
  const handleFileUpload = async (file: File) => {
    try {
      await safeStopScanner(scannerRef.current);
      scannerRef.current = null;

      const tempScanner = new Html5Qrcode("file-scan-container", {
        formatsToSupport: BARCODE_FORMATS,
        verbose: false,
      });
      const result = await tempScanner.scanFile(file, true);
      onBarcodeDetected(result);
    } catch {
      toast.error("No barcode found in image. Try a clearer photo.");
      setHint("No barcode in image — try again");
      startScanner();
    }
  };

  return (
    <div className="min-h-screen bg-foreground text-primary-foreground flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-full glass grid place-items-center">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="text-sm font-semibold">Scan Barcode</p>
        <button onClick={() => fileRef.current?.click()} className="h-10 w-10 rounded-full glass grid place-items-center">
          <ImageIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Scanner Viewport */}
      <div className="flex-1 relative flex items-center justify-center px-4">
        <div className="relative w-full max-w-[400px]" style={{ aspectRatio: "4/3" }}>
          <div
            id={SCANNER_ELEMENT_ID}
            className="absolute inset-0 rounded-2xl overflow-hidden bg-black/80"
          />
          <div id="file-scan-container" className="hidden" />

          {/* Loading */}
          {!cameraActive && !error && (
            <div className="absolute inset-0 z-10 grid place-items-center">
              <div className="text-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary-foreground/70" />
                <p className="text-xs text-primary-foreground/60">Starting camera...</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="absolute inset-0 z-10 grid place-items-center p-6 text-center">
              <div className="space-y-4">
                <div className="mx-auto h-14 w-14 rounded-full glass grid place-items-center">
                  <CameraOff className="h-7 w-7" />
                </div>
                <p className="text-sm text-primary-foreground/80 leading-relaxed">{error}</p>
                <button onClick={startScanner} className="gradient-hero rounded-xl px-5 py-2.5 text-sm font-semibold">
                  Retry Camera
                </button>
              </div>
            </div>
          )}

          {/* Success */}
          {detected && (
            <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-black/50">
              <div className="h-16 w-16 rounded-full bg-success grid place-items-center shadow-glow">
                <Check className="h-8 w-8 text-white" />
              </div>
            </div>
          )}

          {/* Corner markers */}
          <div className="pointer-events-none absolute inset-0 z-20">
            <div className="absolute top-0 left-0 h-10 w-10 border-t-[3px] border-l-[3px] border-primary-glow rounded-tl-2xl" />
            <div className="absolute top-0 right-0 h-10 w-10 border-t-[3px] border-r-[3px] border-primary-glow rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 h-10 w-10 border-b-[3px] border-l-[3px] border-primary-glow rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 h-10 w-10 border-b-[3px] border-r-[3px] border-primary-glow rounded-br-2xl" />
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="px-5 pb-8 pt-4 space-y-3">
        <p className="text-center text-xs font-medium text-primary-foreground/60">{hint}</p>

        {!showManual ? (
          <div className="space-y-3">
            <button
              onClick={() => setShowManual(true)}
              className="mx-auto block text-xs font-semibold text-primary-glow underline underline-offset-2"
            >
              Scanner having trouble? Enter barcode manually
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowManual(true)}
                className="glass rounded-2xl py-3 flex items-center justify-center gap-2 text-sm font-medium"
              >
                <Keyboard className="h-4 w-4" /> Enter code
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="glass rounded-2xl py-3 flex items-center justify-center gap-2 text-sm font-medium"
              >
                <ImageIcon className="h-4 w-4" /> Upload image
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const code = normalizeBarcode(manualCode);
              if (isValidBarcode(code)) {
                onBarcodeDetected(code);
              } else {
                toast.error("Enter a valid 8, 12, or 13 digit barcode number");
              }
            }}
            className="glass rounded-2xl p-2 flex gap-2"
          >
            <input
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Type barcode (e.g. 8901491003810)"
              className="flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-primary-foreground/40"
            />
            <button type="submit" className="gradient-hero rounded-xl px-5 text-sm font-semibold shrink-0">
              Go
            </button>
          </form>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
};

export default Scan;
