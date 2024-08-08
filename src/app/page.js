"use client";
import { useEffect } from "react";
import { SpeechChunks } from "../vad/SpeechChunks";

export default function Home() {
  useEffect(() => {
  const chunks = new SpeechChunks();
  chunks.start();
  }, []);
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
    </main>
  );
}
