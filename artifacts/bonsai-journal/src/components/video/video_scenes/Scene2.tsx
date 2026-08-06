import { motion } from 'framer-motion';

export const Scene2 = () => {
  const imgUrl = `${import.meta.env.BASE_URL}sample-trees/juniper.jpg`;

  return (
    <motion.div
      className="absolute inset-0 bg-[#f5f1eb] overflow-hidden flex items-center justify-center"
      initial={{ clipPath: 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)' }}
      animate={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 1 } }}
      transition={{ duration: 1.2, ease: [0.76, 0, 0.24, 1] }}
    >
      <motion.div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative w-full h-full max-w-[1200px] mx-auto px-8 lg:px-20 flex flex-col md:flex-row items-center justify-between z-10 gap-12">
        {/* Text Content */}
        <div className="flex-1 flex flex-col items-start justify-center">
          <motion.div
            className="w-12 h-1 bg-[#3d6b4f] mb-8"
            initial={{ scaleX: 0, transformOrigin: 'left' }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
          />
          <motion.h1
            className="font-serif text-[#2a3028] text-6xl lg:text-8xl mb-4 tracking-tight leading-none"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.7 }}
          >
            Old Silver
          </motion.h1>
          <motion.h3
            className="font-sans text-[#5c605a] text-2xl lg:text-3xl font-light mb-12 tracking-wide uppercase"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.9 }}
          >
            Chinese Juniper
          </motion.h3>

          <div className="flex flex-col gap-4 font-sans text-lg text-[#4a4238]">
            <motion.div
              className="flex items-center gap-4 bg-white/60 px-6 py-3 rounded-full shadow-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 1.4 }}
            >
              <span className="w-2 h-2 rounded-full bg-[#3d6b4f]" />
              <span>Pruned 2 days ago</span>
            </motion.div>
            <motion.div
              className="flex items-center gap-4 bg-white/60 px-6 py-3 rounded-full shadow-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 1.6 }}
            >
              <span className="w-2 h-2 rounded-full bg-[#8c7462]" />
              <span>Wiring removed</span>
            </motion.div>
          </div>
        </div>

        {/* Image / Hero */}
        <div className="flex-1 flex justify-center items-center h-[70vh] relative">
          <motion.div
            className="absolute inset-0 bg-[#3d6b4f]/10 rounded-full blur-[80px]"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 2, delay: 0.2 }}
          />
          <motion.div
            className="relative w-full h-full max-h-[800px] aspect-[3/4] rounded-t-[1000px] overflow-hidden shadow-2xl border-4 border-white/50"
            initial={{ clipPath: 'polygon(0 100%, 100% 100%, 100% 100%, 0 100%)' }}
            animate={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
            transition={{ duration: 1.6, ease: [0.25, 1, 0.5, 1], delay: 0.2 }}
          >
            <motion.img
              src={imgUrl}
              alt="Old Silver Bonsai"
              className="w-full h-full object-cover"
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              transition={{ duration: 4, ease: 'easeOut' }}
            />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};
