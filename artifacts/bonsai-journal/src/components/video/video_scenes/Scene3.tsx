import { motion } from 'framer-motion';

export const Scene3 = () => {
  const imgUrl = `${import.meta.env.BASE_URL}sample-trees/maple.jpg`;

  return (
    <motion.div
      className="absolute inset-0 bg-[#f5f1eb] overflow-hidden flex items-center justify-center"
      initial={{ clipPath: 'polygon(0 100%, 100% 100%, 100% 100%, 0 100%)' }}
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

      <div className="relative w-full h-full max-w-[1200px] mx-auto px-8 lg:px-20 flex flex-col md:flex-row-reverse items-center justify-between z-10 gap-12">
        {/* Text Content */}
        <div className="flex-1 flex flex-col items-start md:items-end justify-center text-left md:text-right">
          <motion.div
            className="w-12 h-1 bg-[#8c3a3a] mb-8"
            initial={{ scaleX: 0, transformOrigin: 'right' }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
          />
          <motion.h1
            className="font-serif text-[#2a3028] text-6xl lg:text-8xl mb-4 tracking-tight leading-none"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.7 }}
          >
            Autumn Flame
          </motion.h1>
          <motion.h3
            className="font-sans text-[#8c3a3a] text-2xl lg:text-3xl font-light mb-12 tracking-wide uppercase"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.9 }}
          >
            Japanese Maple
          </motion.h3>

          <div className="flex flex-col gap-4 font-sans text-lg text-[#4a4238] items-start md:items-end">
            <motion.div
              className="flex items-center gap-4 bg-white/60 px-6 py-3 rounded-full shadow-sm flex-row-reverse md:flex-row"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 1.4 }}
            >
              <span>Repotted: Spring 2023</span>
              <span className="w-2 h-2 rounded-full bg-[#8c3a3a]" />
            </motion.div>
            <motion.div
              className="flex items-center gap-4 bg-white/60 px-6 py-3 rounded-full shadow-sm flex-row-reverse md:flex-row"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 1.6 }}
            >
              <span>Fertilised: 1 week ago</span>
              <span className="w-2 h-2 rounded-full bg-[#6a5e4d]" />
            </motion.div>
          </div>
        </div>

        {/* Image / Hero */}
        <div className="flex-1 flex justify-center items-center h-[70vh] relative">
          <motion.div
            className="absolute inset-0 bg-[#8c3a3a]/10 rounded-full blur-[80px]"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 2, delay: 0.2 }}
          />
          <motion.div
            className="relative w-full h-full max-h-[800px] aspect-[4/5] rounded-[40px] overflow-hidden shadow-2xl border-4 border-white/50"
            initial={{ scale: 0.8, opacity: 0, rotate: -5 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          >
            <motion.img
              src={imgUrl}
              alt="Autumn Flame Bonsai"
              className="w-full h-full object-cover"
              initial={{ scale: 1.15 }}
              animate={{ scale: 1 }}
              transition={{ duration: 4, ease: 'easeOut' }}
            />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};
