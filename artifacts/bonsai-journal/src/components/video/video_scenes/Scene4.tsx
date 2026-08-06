import { motion } from 'framer-motion';

export const Scene4 = () => {
  return (
    <motion.div
      className="absolute inset-0 bg-[#3d6b4f] overflow-hidden flex items-center justify-center text-[#f5f1eb]"
      initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ opacity: 1, clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0, transition: { duration: 0.8 } }}
      transition={{ duration: 1.2, ease: [0.76, 0, 0.24, 1] }}
    >
      <motion.div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Floating accent shapes */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-64 h-64 border border-white/5 rounded-full"
        animate={{ rotate: 360, scale: [1, 1.1, 1] }}
        transition={{ duration: 10, ease: 'linear', repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 border border-white/5 rounded-full"
        animate={{ rotate: -360, scale: [1, 1.2, 1] }}
        transition={{ duration: 15, ease: 'linear', repeat: Infinity }}
      />
      <motion.div
        className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
      />

      <div className="z-10 flex flex-col items-center justify-center space-y-12">
        <motion.div className="overflow-hidden">
          <motion.h2
            className="font-serif text-5xl md:text-7xl text-center"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
          >
            Track every watering.
          </motion.h2>
        </motion.div>

        <motion.div className="overflow-hidden">
          <motion.h2
            className="font-serif text-5xl md:text-7xl text-center text-[#9dbb99]"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 1.2 }}
          >
            Log every pruning.
          </motion.h2>
        </motion.div>

        <motion.div className="overflow-hidden">
          <motion.h2
            className="font-serif text-5xl md:text-7xl text-center text-[#e2dfd8]"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 2.0 }}
          >
            Watch them grow.
          </motion.h2>
        </motion.div>

        <motion.div
          className="w-1/2 h-[1px] bg-white/20 mt-12"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.5, ease: 'easeInOut', delay: 2.5 }}
        />
      </div>
    </motion.div>
  );
};
