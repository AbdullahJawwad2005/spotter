import { useCallback, useEffect, useRef, useState } from "react";
import type { Landmark } from "@/lib/pose-math";

declare global {
  interface Window {
    Pose: any;
    Camera: any;
    drawConnectors?: any;
    POSE_CONNECTIONS?: any;
  }
}

const POSE_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js";
const CAMERA_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js";
const ASSETS_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.dataset.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export interface PoseFrame {
  landmarks: Landmark[];      // image-space (normalized 0..1)
  worldLandmarks: Landmark[]; // metric, origin at hips
}

export type PoseStatus = "idle" | "loading" | "ready" | "running" | "error";

export function useMediaPipePose(
  videoRef: React.RefObject<HTMLVideoElement>,
  onFrame: (frame: PoseFrame) => void,
) {
  const [status, setStatus] = useState<PoseStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const poseRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const start = useCallback(async () => {
    if (status === "running" || status === "loading") return;
    setStatus("loading");
    setError(null);
    try {
      await loadScript(POSE_CDN);
      await loadScript(CAMERA_CDN);

      // Camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: false,
      });
      const video = videoRef.current!;
      video.srcObject = stream;
      await new Promise<void>((res) => {
        video.onloadedmetadata = () => res();
      });
      await video.play();

      const pose = new window.Pose({
        locateFile: (file: string) => `${ASSETS_BASE}${file}`,
      });
      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      pose.onResults((results: any) => {
        if (!results?.poseLandmarks) return;
        onFrameRef.current({
          landmarks: results.poseLandmarks,
          worldLandmarks: results.poseWorldLandmarks ?? results.poseLandmarks,
        });
      });
      poseRef.current = pose;

      const camera = new window.Camera(video, {
        onFrame: async () => {
          if (poseRef.current) await poseRef.current.send({ image: video });
        },
        width: 1280,
        height: 720,
      });
      cameraRef.current = camera;
      camera.start();
      setStatus("running");
    } catch (e) {
      console.error("Pose start failed", e);
      setError(e instanceof Error ? e.message : "Failed to start camera");
      setStatus("error");
    }
  }, [status, videoRef]);

  const stop = useCallback(() => {
    cameraRef.current?.stop?.();
    cameraRef.current = null;
    poseRef.current?.close?.();
    poseRef.current = null;
    const v = videoRef.current;
    if (v?.srcObject) {
      (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      v.srcObject = null;
    }
    setStatus("idle");
  }, [videoRef]);

  useEffect(() => () => stop(), [stop]);

  return { status, error, start, stop };
}