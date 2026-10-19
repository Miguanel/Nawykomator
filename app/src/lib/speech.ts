// Mowa -> tekst. Na Androidzie: systemowe rozpoznawanie mowy (darmowe, bez klucza API).
// W przeglądarce (podgląd na komputerze): Web Speech API, jeśli jest.
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import type { PluginListenerHandle } from '@capacitor/core';
import { isNative } from './platform';

export interface Dictation {
  stop: () => Promise<void>;
}

type WebRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
  start: () => void;
  stop: () => void;
};

function webCtor(): (new () => WebRecognition) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => WebRecognition) | null;
}

export async function speechAvailable(): Promise<boolean> {
  if (isNative()) {
    try {
      return (await SpeechRecognition.available()).available;
    } catch {
      return false;
    }
  }
  return webCtor() !== null;
}

/**
 * Startuje dyktowanie. `onText` dostaje cały dotychczas rozpoznany tekst tej sesji,
 * `onEnd` wywoływane po zakończeniu.
 */
export async function startDictation(onText: (text: string) => void, onEnd: () => void, lang = 'pl-PL'): Promise<Dictation> {
  if (isNative()) {
    const perm = await SpeechRecognition.checkPermissions();
    if (perm.speechRecognition !== 'granted') {
      const r = await SpeechRecognition.requestPermissions();
      if (r.speechRecognition !== 'granted') throw new Error('permission');
    }
    const handles: PluginListenerHandle[] = [];
    handles.push(
      await SpeechRecognition.addListener('partialResults', (d) => {
        if (d.matches?.[0]) onText(d.matches[0]);
      }),
    );
    handles.push(
      await SpeechRecognition.addListener('listeningState', (d) => {
        if (d.status === 'stopped') {
          handles.forEach((h) => h.remove());
          onEnd();
        }
      }),
    );
    await SpeechRecognition.start({ language: lang, partialResults: true, popup: false, maxResults: 1 });
    return { stop: () => SpeechRecognition.stop() };
  }

  const Ctor = webCtor();
  if (!Ctor) throw new Error('unavailable');
  const rec = new Ctor();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = true;
  let finalText = '';
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript + ' ';
      else interim += r[0].transcript;
    }
    onText((finalText + interim).trim());
  };
  rec.onend = onEnd;
  rec.onerror = () => onEnd();
  rec.start();
  return { stop: async () => rec.stop() };
}
