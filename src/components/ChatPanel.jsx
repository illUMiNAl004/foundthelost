import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../hooks/useAuth.jsx'
import { getConversations, sendMessage, markConversationRead } from '../lib/api.js'

const SPRING = { type: 'spring', stiffness: 320, damping: 32 }

export default function ChatPanel({ onClose, initialConversationId }) {
  const { user } = useAuth()
  const [convs, setConvs] = useState([])
  const [active, setActive] = useState(initialConversationId || null)
  const [draft, setDraft] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    getConversations(user).then((cs) => {
      setConvs(cs)
      if (initialConversationId) markConversationRead(initialConversationId)
    }).catch(console.error)
  }, [user, initialConversationId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 9e6, behavior: 'smooth' })
  }, [active, convs])

  const openConv = (c) => {
    setActive(c.id)
    markConversationRead(c.id)
    setConvs((cs) => cs.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x)))
  }

  const send = async (e) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setDraft('')
    const msg = await sendMessage(user, active, text)
    setConvs((cs) => cs.map((c) => (c.id === active ? { ...c, messages: [...c.messages, msg] } : c)))
  }

  const conv = convs.find((c) => c.id === active)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: 420, opacity: 0.5 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 420, opacity: 0 }}
        transition={SPRING}
        onClick={(e) => e.stopPropagation()}
        className="glass glass-shadow absolute bottom-0 right-0 top-0 flex w-full max-w-md flex-col rounded-l-[28px] border-r-0 p-5 max-sm:rounded-none"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="mono-label">:: text portal</div>
            <h2 className="font-display mt-1 text-2xl font-bold tracking-tight">
              {conv ? conv.with.name : 'Messages'}
            </h2>
          </div>
          <div className="flex gap-2">
            {conv && (
              <button
                onClick={() => setActive(null)}
                className="grid h-9 w-9 place-items-center rounded-full bg-ink/5 transition hover:bg-ink/10 dark:bg-white/10"
              >
                ←
              </button>
            )}
            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full bg-ink/5 transition hover:bg-ink/10 dark:bg-white/10"
            >
              ✕
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!conv ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={SPRING}
              className="min-h-0 flex-1 space-y-2.5 overflow-y-auto no-scrollbar"
            >
              {convs.map((c, i) => (
                <motion.button
                  key={c.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...SPRING, delay: i * 0.06 }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => openConv(c)}
                  className="flex w-full items-center gap-3.5 rounded-2xl border border-white/90 bg-white/85 p-3.5 text-left shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-800/70"
                >
                  <div className="grid h-12 w-12 flex-none place-items-center rounded-full bg-lime/60 text-xl">
                    {c.with.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between">
                      <span className="truncate text-[15px] font-semibold">{c.with.name}</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {c.messages.at(-1)?.time}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[13px] text-slate-500 dark:text-slate-400">
                      {c.messages.at(-1)?.text}
                    </div>
                    <div className="mono-label mt-1 !text-[9px]">{c.item}</div>
                  </div>
                  {c.unread > 0 && (
                    <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-coral font-mono text-[10px] font-bold text-white">
                      {c.unread}
                    </span>
                  )}
                </motion.button>
              ))}
              {convs.length === 0 && (
                <div className="py-12 text-center text-sm text-slate-500">
                  No conversations yet — chats open when a match is verified 🔐
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="thread"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={SPRING}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="mono-label mb-2 text-center !text-[9.5px]">{conv.item}</div>
              <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto no-scrollbar pb-2">
                {conv.messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ ...SPRING, delay: Math.min(i * 0.04, 0.3) }}
                    className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug shadow-sm ${
                        m.from === 'me'
                          ? 'rounded-br-md bg-ink text-cream dark:bg-lime dark:text-ink'
                          : 'rounded-bl-md border border-white/90 bg-white/90 dark:border-white/10 dark:bg-slate-800'
                      }`}
                    >
                      {m.text}
                      <div className={`mt-1 font-mono text-[9px] ${m.from === 'me' ? 'text-cream/60 dark:text-ink/50' : 'text-slate-400'}`}>
                        {m.time}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              <form onSubmit={send} className="mt-2 flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Message…"
                  className="min-w-0 flex-1 rounded-full border border-ink/10 bg-white/85 px-4 py-3 text-[14px] outline-none backdrop-blur transition placeholder:text-slate-400 focus:border-lime dark:border-white/10 dark:bg-slate-800/70"
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  className="btn-lime grid h-12 w-12 flex-none place-items-center rounded-full text-lg"
                >
                  ↑
                </motion.button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
