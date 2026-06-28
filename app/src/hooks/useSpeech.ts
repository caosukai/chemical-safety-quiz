import { useState, useCallback, useRef, useEffect } from 'react';

interface SpeechState {
  speaking: boolean;
  supported: boolean;
  autoPlay: boolean;
}

// Voice types for different scenarios
export type VoiceType = 'male' | 'female' | 'default';

// Queue item for chained speech
interface QueueItem {
  text: string;
  voiceType: VoiceType;
  rate?: number;
  pitch?: number;
}

// Get voice by type
function getVoiceByType(type: VoiceType): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  switch (type) {
    case 'male':
      // Try to find a male Chinese voice (lower pitch)
      return (
        voices.find(v => v.lang.startsWith('zh') && v.name.includes('男')) ||
        voices.find(v => v.lang.startsWith('zh') && (v.name.includes('Kangkang') || v.name.includes('Yun'))) ||
        voices.find(v => v.lang.startsWith('zh-CN')) ||
        voices[0]
      );
    case 'female':
      // Try to find a female Chinese voice (higher pitch)
      return (
        voices.find(v => v.lang.startsWith('zh') && v.name.includes('女')) ||
        voices.find(v => v.lang.startsWith('zh') && (v.name.includes('Xiaoxiao') || v.name.includes('Huihui'))) ||
        voices.find(v => v.lang.startsWith('zh-CN')) ||
        voices[0]
      );
    default:
      return voices.find(v => v.lang.startsWith('zh-CN')) || voices[0];
  }
}

export function useSpeech() {
  const [state, setState] = useState<SpeechState>({
    speaking: false,
    supported: false,
    autoPlay: false,
  });
  const queueRef = useRef<QueueItem[]>([]);
  const isProcessingRef = useRef(false);

  // Check if speech synthesis is supported
  useEffect(() => {
    const supported = 'speechSynthesis' in window;
    setState(prev => ({ ...prev, supported }));

    // Load voices (some browsers need this)
    if (supported) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Process the speech queue
  const processQueue = useCallback(() => {
    if (isProcessingRef.current || queueRef.current.length === 0) {
      if (queueRef.current.length === 0) {
        setState(prev => ({ ...prev, speaking: false }));
      }
      return;
    }

    isProcessingRef.current = true;
    const item = queueRef.current.shift()!;

    const utterance = new SpeechSynthesisUtterance(item.text);
    const voice = getVoiceByType(item.voiceType);
    if (voice) utterance.voice = voice;
    utterance.lang = 'zh-CN';
    utterance.rate = item.rate ?? 1.0;
    utterance.pitch = item.pitch ?? (item.voiceType === 'male' ? 0.8 : item.voiceType === 'female' ? 1.2 : 1.0);
    utterance.volume = 1.0;

    utterance.onend = () => {
      isProcessingRef.current = false;
      // Process next item in queue
      setTimeout(() => processQueue(), 200);
    };

    utterance.onerror = () => {
      isProcessingRef.current = false;
      setTimeout(() => processQueue(), 200);
    };

    setState(prev => ({ ...prev, speaking: true }));
    window.speechSynthesis.speak(utterance);
  }, []);

  // Add items to queue and start processing
  const speakQueue = useCallback((items: QueueItem[]) => {
    if (!window.speechSynthesis) return;
    // Cancel current speech
    window.speechSynthesis.cancel();
    isProcessingRef.current = false;
    queueRef.current = [...items];
    processQueue();
  }, [processQueue]);

  // Speak a single text with specific voice
  const speak = useCallback((text: string, voiceType: VoiceType = 'default') => {
    speakQueue([{ text, voiceType }]);
  }, [speakQueue]);

  // Stop all speech
  const stop = useCallback(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    queueRef.current = [];
    isProcessingRef.current = false;
    setState(prev => ({ ...prev, speaking: false }));
  }, []);

  // Toggle auto-play
  const toggleAutoPlay = useCallback(() => {
    setState(prev => ({ ...prev, autoPlay: !prev.autoPlay }));
  }, []);

  return {
    ...state,
    speak,
    speakQueue,
    stop,
    toggleAutoPlay,
  };
}
