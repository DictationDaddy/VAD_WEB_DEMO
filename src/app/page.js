"use client";
import { useEffect, useState } from "react";
import { SpeechChunks } from "../vad/SpeechChunks";
import Link from "next/link";

const AudioPlayer = ({ blob }) => {
  return (
    <audio controls src={URL.createObjectURL(blob)} onEnded={(e) => URL.revokeObjectURL(e.target.src)} />
  );
};

export default function Home() {
  const [isListening, setIsListening] = useState(false);
  const [audioBlobs, setAudioBlobs] = useState([]);

  useEffect(() => {
    const chunks = new SpeechChunks(
      () => {
        console.log("speech start");
        setIsListening(true);
      },
      (blob) => {
        console.log("speech end");
        setIsListening(false);
        setAudioBlobs((prevBlobs) => [...prevBlobs, blob]);
      }
    );
    chunks.start();

    return () => chunks.stop();
  }, []);
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="text-center">
        <div className="text-4xl mb-4">
          {isListening ? "🎙️ Listening..." : "🔇 Not Listening"}
        </div>
        <div className="space-y-4">
          {audioBlobs.map((blob, index) => (
            <AudioPlayer key={index} blob={blob} />
          ))}
        </div>
        <Link href="/onboarding" className="mt-8 bg-blue-500 text-white px-4 py-2 rounded inline-block">
          Go to Onboarding
        </Link>
      </div>
    </main>
  );
}
