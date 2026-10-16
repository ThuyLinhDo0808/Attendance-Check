import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

/**
 * Reads a QR code from the device camera and calls onScan(text) once.
 * Browsers only allow the camera on HTTPS (or localhost).
 */
export default function QrScanner({ onScan }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const doneRef = useRef(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stream;
    let frame;
    let cancelled = false;

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (cancelled || doneRef.current || !video || !canvas) return;

      if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth) {
        // Downscale large camera frames; QR detection doesn't need them.
        const scale = Math.min(1, 640 / video.videoWidth);
        const width = Math.round(video.videoWidth * scale);
        const height = Math.round(video.videoHeight * scale);
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, width, height);
        const code = jsQR(ctx.getImageData(0, 0, width, height).data, width, height, {
          inversionAttempts: 'dontInvert',
        });
        if (code?.data) {
          doneRef.current = true;
          onScan(code.data);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Trình duyệt này không mở được camera (cần HTTPS). Hãy dùng camera điện thoại quét mã QR.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) return;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        frame = requestAnimationFrame(tick);
      } catch (err) {
        if (cancelled) return;
        setError(
          err?.name === 'NotAllowedError'
            ? 'Bạn chưa cho phép truy cập camera. Hãy bật quyền camera cho trang này rồi thử lại.'
            : 'Không mở được camera. Hãy dùng camera điện thoại quét mã QR.'
        );
      }
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onScan]);

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {error}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900">
      <video ref={videoRef} className="aspect-square w-full object-cover" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />
      <div className="pointer-events-none absolute inset-10 rounded-2xl border-2 border-white/70" />
    </div>
  );
}
