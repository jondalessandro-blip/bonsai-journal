import { motion } from 'framer-motion';

export const Scene1 = () => {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#f5f1eb] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 1.2 } }}
    >
      {/* Background ambient texture */}
      <motion.div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <motion.div
        className="absolute w-[80vw] h-[80vw] bg-[#3d6b4f] rounded-full blur-[120px] opacity-10"
        initial={{ scale: 0.8, y: '20vh' }}
        animate={{ scale: 1.1, y: '-10vh' }}
        transition={{ duration: 6, ease: 'linear' }}
      />

      <div className="z-10 flex flex-col items-center justify-center space-y-4">
        <motion.h2
          className="font-serif text-[#4a4238] text-5xl md:text-7xl tracking-wide text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
        >
          Bonsai is time...
        </motion.h2>
        
        <motion.h2
          className="font-serif text-[#3d6b4f] text-4xl md:text-6xl tracking-wider text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1], delay: 2.2 }}
        >
          captured in a pot.
        </motion.h2>
      </div>
    </motion.div>
  );
};
