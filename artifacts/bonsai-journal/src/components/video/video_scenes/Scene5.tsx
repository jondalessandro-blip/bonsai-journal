import { motion } from 'framer-motion';

export const Scene5 = () => {
  return (
    <motion.div
      className="absolute inset-0 bg-[#f5f1eb] overflow-hidden flex flex-col items-center justify-center"
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0, transition: { duration: 1.2 } }}
      transition={{ duration: 1.2, ease: [0.76, 0, 0.24, 1] }}
    >
      <motion.div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <motion.div
        className="absolute w-[100vw] h-[100vh] bg-[#3d6b4f] rounded-full blur-[150px] opacity-10"
        initial={{ scale: 0.5, y: '50vh' }}
        animate={{ scale: 1.2, y: '0vh' }}
        transition={{ duration: 6, ease: 'easeOut' }}
      />

      <div className="z-10 flex flex-col items-center text-center">
        <motion.div
          className="w-16 h-16 mb-8 rounded-full border border-[#3d6b4f]/30 flex items-center justify-center text-[#3d6b4f] bg-white/50 shadow-sm"
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        </motion.div>

        <motion.h1
          className="font-serif text-[#2a3028] text-5xl md:text-7xl lg:text-8xl tracking-tight mb-2 flex items-center gap-6"
        >
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.6 }}
          >
            Bonsai Journal
          </motion.span>
          <motion.span
            className="text-[#3d6b4f] font-light text-4xl md:text-6xl"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 1 }}
          >
            盆栽
          </motion.span>
        </motion.h1>

        <motion.p
          className="font-sans text-[#5c605a] text-xl md:text-3xl font-light mt-6 tracking-wide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 1.4 }}
        >
          A quiet record of every tree
        </motion.p>
      </div>
    </motion.div>
  );
};
