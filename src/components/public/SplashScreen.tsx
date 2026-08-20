import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import logo from '@/assets/logo.png'

const STORAGE_KEY = 'wm-imports-splash-seen'
const VISIBLE_MS = 1200
const EXIT_MS = 280

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion()
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), reduced ? 200 : VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [reduced])

  return (
    <AnimatePresence
      onExitComplete={() => {
        try {
          sessionStorage.setItem(STORAGE_KEY, '1')
        } catch {
          /* ignore */
        }
        onDone()
      }}
    >
      {visible ? (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[100] grid place-items-center bg-ink"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: EXIT_MS / 1000, ease: 'easeOut' }}
          aria-hidden
        >
          <div className="relative flex flex-col items-center gap-4 px-6">
            {!reduced ? (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0 -m-16 rounded-full bg-metal-300/15 blur-3xl"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1.15 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              />
            ) : null}
            <motion.img
              src={logo}
              alt="WM Imports"
              className="relative h-24 w-auto sm:h-28"
              initial={reduced ? false : { opacity: 0, scale: 0.72, filter: 'blur(8px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={
                reduced
                  ? { duration: 0.15 }
                  : { duration: 0.75, ease: [0.22, 1, 0.36, 1] }
              }
            />
            {!reduced ? (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-1/2 h-10 -translate-y-1/2 overflow-hidden"
              >
                <motion.div
                  className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent"
                  initial={{ x: '-60%' }}
                  animate={{ x: '180%' }}
                  transition={{ duration: 0.9, delay: 0.25, ease: 'easeInOut' }}
                />
              </motion.div>
            ) : null}
            <motion.p
              className="relative font-display text-xs tracking-[0.35em] text-metal-400"
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduced ? 0 : 0.35, duration: 0.4 }}
            >
              WM IMPORTS
            </motion.p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function shouldShowSplash() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) !== '1'
  } catch {
    return true
  }
}
