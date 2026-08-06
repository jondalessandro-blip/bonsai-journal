import { useState } from 'react';
import { useVideoPlayer } from '@/lib/video';
import { AnimatePresence, motion } from 'framer-motion';
import { Link as WouterLink } from 'wouter';

import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

const SCENE_DURATIONS = {
  scene1: 6000,
  scene2: 7000,
  scene3: 7000,
  scene4: 5000,
  scene5: 5000,
};

// Isolated so that changing replayKey fully unmounts/remounts the hook
function VideoPlayer({ onEnd }: { onEnd: () => void }) {
  const { currentScene } = useVideoPlayer({
    durations: SCENE_DURATIONS,
    loop: false,
    onVideoEnd: onEnd,
  });

  return (
    <div className="absolute inset-0" style={{ backgroundColor: '#f5f1eb' }}>
      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="scene1" />}
        {currentScene === 1 && <Scene2 key="scene2" />}
        {currentScene === 2 && <Scene3 key="scene3" />}
        {currentScene === 3 && <Scene4 key="scene4" />}
        {currentScene === 4 && <Scene5 key="scene5" />}
      </AnimatePresence>
    </div>
  );
}

export default function VideoTemplate() {
  const [replayKey, setReplayKey] = useState(0);
  const [ended, setEnded] = useState(false);

  function handleReplay() {
    setEnded(false);
    setReplayKey((k) => k + 1);
  }

  return (
    <div className="w-full h-screen overflow-hidden relative" style={{ backgroundColor: '#f5f1eb' }}>
      <VideoPlayer key={replayKey} onEnd={() => setEnded(true)} />

      {/* End screen overlay — fades in after the last scene */}
      <AnimatePresence>
        {ended && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            style={{ background: 'rgba(245,241,235,0.88)', backdropFilter: 'blur(10px)' }}
          >
            <WouterLink href="/sign-up">
              <button className="px-10 py-3.5 rounded-full bg-[#3d6b4f] text-[#f5f1eb] font-sans text-lg font-medium tracking-wide shadow-lg hover:bg-[#2e5340] transition-colors">
                Join the pilot →
              </button>
            </WouterLink>
            <button
              onClick={handleReplay}
              className="px-10 py-3.5 rounded-full border border-[#3d6b4f]/40 text-[#3d6b4f] font-sans text-lg font-medium tracking-wide hover:bg-[#3d6b4f]/10 transition-colors"
            >
              ↩ Replay
            </button>
            <WouterLink href="/sign-in">
              <span className="font-sans text-sm text-[#8c8880] hover:text-[#4a4238] transition-colors cursor-pointer mt-2">
                Already have an account? Sign in
              </span>
            </WouterLink>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
