import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Mail, ChevronDown, ChevronLeft, ChevronRight, AlertCircle, Trash2, CheckCheck, CircleDot,
} from 'lucide-react'
import { contactApi } from '../services/baseApi.jsx'
import { getSocket } from '../services/socket.js'
import EmptyState from '../components/EmptyState'
import { useToast } from '../hooks/useToast'

const FILTERS = ['all', 'unread', 'read']
const PAGE_SIZE = 10

const AdminMessages = () => {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [expanded, setExpanded] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = async (f = filter, p = page, { silent = false } = {}) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const params = { page: p, limit: PAGE_SIZE }
      if (f === 'unread') params.isRead = 'false'
      if (f === 'read') params.isRead = 'true'
      const data = await contactApi.list(params)
      setMessages(data.messages || [])
      setTotalPages(data.totalPages || 1)
    } catch (err) {
      setError(err.message || t('admin.loadError'))
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    load(filter, page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page])

  // Live inbox: new customer messages arrive instantly (with a toast) and
  // read/unread/delete changes from another admin tab are mirrored. Re-armed
  // when the filter or page changes so the visible list stays correct.
  useEffect(() => {
    const socket = getSocket()
    let hasConnected = socket.connected

    // Messages created/changed while offline are reconciled here.
    const onConnect = () => {
      if (!hasConnected) {
        hasConnected = true
        return
      }
      load(filter, page, { silent: true })
    }

    const onCreated = (payload) => {
      const m = payload?.message
      if (!m?._id) return
      toast.info(t('admin.messages.newMessage', { name: m.name }))
      if (page !== 1) return // a new message lives on the first page
      if (filter === 'read' && !m.isRead) return
      setMessages((prev) => {
        if (prev.some((x) => x._id === m._id)) return prev
        return [m, ...prev].slice(0, PAGE_SIZE)
      })
    }

    const onUpdated = (payload) => {
      const u = payload?.message
      if (!u?._id) return
      setMessages((prev) => prev.flatMap((m) => {
        if (String(m._id) !== String(u._id)) return [m]
        const merged = { ...m, ...u }
        // The item no longer belongs to the active filter.
        if (filter === 'unread' && merged.isRead) return []
        if (filter === 'read' && !merged.isRead) return []
        return [merged]
      }))
    }

    const onDeleted = (payload) => {
      const id = String(payload?.id || '')
      if (!id) return
      setMessages((prev) => prev.filter((m) => String(m._id) !== id))
    }

    socket.on('contact_message_created', onCreated)
    socket.on('contact_message_updated', onUpdated)
    socket.on('contact_message_deleted', onDeleted)
    socket.on('connect', onConnect)
    return () => {
      socket.off('contact_message_created', onCreated)
      socket.off('contact_message_updated', onUpdated)
      socket.off('contact_message_deleted', onDeleted)
      socket.off('connect', onConnect)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page])

  const changeFilter = (f) => { setFilter(f); setPage(1); setExpanded(null) }

  // Optimistic read/unread toggle: the badge flips immediately and rolls back
  // with an error toast if the server rejects the change.
  const toggleRead = async (message) => {
    const prev = messages
    const nextIsRead = !message.isRead
    setMessages((list) => list.map((m) => (m._id === message._id ? { ...m, isRead: nextIsRead } : m)))
    try {
      const data = await contactApi.setRead(message._id, nextIsRead)
      const updated = data.message || { ...message, isRead: nextIsRead }
      setMessages((list) => list.map((m) => (m._id === message._id ? updated : m)))
      toast.success(t('admin.messages.updated'))
    } catch (err) {
      setMessages(prev)
      toast.error(err.message || t('admin.loadError'))
    }
  }

  const removeMessage = async (message) => {
    if (!window.confirm(t('admin.messages.deleteConfirm'))) return
    setBusyId(message._id)
    try {
      await contactApi.remove(message._id)
      setMessages((list) => list.filter((m) => m._id !== message._id))
      toast.success(t('admin.messages.deleted'))
    } catch (err) {
      toast.error(err.message || t('admin.loadError'))
    } finally {
      setBusyId(null)
    }
  }

  // Opening a message marks it as read (standard inbox behaviour), but the
  // admin can still toggle it back to unread afterwards. Optimistic with a
  // silent rollback: reading the message still works if the flag call fails.
  const openMessage = async (message) => {
    const next = expanded === message._id ? null : message._id
    setExpanded(next)
    if (next && !message.isRead) {
      const prev = messages
      setMessages((list) => list.map((m) => (m._id === message._id ? { ...m, isRead: true } : m)))
      try {
        const data = await contactApi.setRead(message._id, true)
        const updated = data.message || { ...message, isRead: true }
        setMessages((list) => list.map((m) => (m._id === message._id ? updated : m)))
      } catch {
        setMessages(prev)
      }
    }
  }

  const fmtDate = (d) =>
    new Date(d).toLocaleString(i18n.language?.startsWith('mm') ? 'en-GB' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })

  const unreadInList = messages.filter((m) => !m.isRead).length

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-black text-gray-900 dark:text-white">{t('admin.messages.title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('admin.messages.subtitle')}</p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => changeFilter(f)}
            className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
              filter === f ? 'bg-brand text-white' : 'border border-gray-300 text-gray-600 hover:border-brand hover:text-brand dark:border-gray-700 dark:text-gray-300'
            }`}
          >
            {t(`admin.messages.filter.${f}`)}
            {f === 'unread' && unreadInList > 0 && (
              <span className="ml-2 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">{unreadInList}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="fh-skeleton h-16 rounded-xl" />)}</div>
      ) : error ? (
        <EmptyState icon={AlertCircle} title={t('admin.loadError')} description={error} actionLabel={t('admin.retry')} onAction={() => load()} />
      ) : messages.length === 0 ? (
        <EmptyState icon={Mail} title={t(`admin.messages.empty.${filter}`)} />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
            <ul className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {messages.map((m) => (
                <li key={m._id} className="transition-colors hover:bg-gray-50/60 dark:hover:bg-gray-900/40">
                  <div className="flex items-start gap-2 px-3 py-4 sm:gap-3 sm:px-4">
                    <span className={`mt-1.5 shrink-0 ${m.isRead ? 'text-gray-300 dark:text-gray-700' : 'text-brand'}`} title={m.isRead ? t('admin.messages.filter.read') : t('admin.messages.filter.unread')}>
                      {m.isRead ? <CircleDot size={14} /> : <CircleDot size={14} strokeWidth={3} />}
                    </span>

                    <button
                      onClick={() => openMessage(m)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                        <p className={`text-sm ${m.isRead ? 'font-medium text-gray-700 dark:text-gray-300' : 'font-bold text-gray-900 dark:text-white'}`}>
                          {m.name}
                        </p>
                        <p className="min-w-0 max-w-full text-xs text-gray-400 [overflow-wrap:anywhere]">{m.email} · {m.phone}</p>
                        <span className="ml-auto shrink-0 text-xs text-gray-400">{fmtDate(m.createdAt)}</span>
                      </div>
                      <p className={`mt-1 text-sm ${expanded === m._id ? 'hidden' : 'truncate text-gray-500 dark:text-gray-400'}`}>
                        {m.message}
                      </p>

                      {expanded === m._id && (
                        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900/60 sm:p-4">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-200">{m.message}</p>
                        </div>
                      )}
                    </button>

                    <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                      <button
                        onClick={() => toggleRead(m)}
                        disabled={busyId === m._id}
                        title={m.isRead ? t('admin.messages.markUnread') : t('admin.messages.markRead')}
                        aria-label={m.isRead ? t('admin.messages.markUnread') : t('admin.messages.markRead')}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:bg-brand/10 hover:text-brand disabled:opacity-50 dark:text-gray-400 sm:px-2.5"
                      >
                        <CheckCheck size={14} />
                        <span className="hidden sm:inline">{m.isRead ? t('admin.messages.markUnread') : t('admin.messages.markRead')}</span>
                      </button>
                      <button
                        onClick={() => removeMessage(m)}
                        disabled={busyId === m._id}
                        title={t('admin.messages.delete')}
                        aria-label={t('admin.messages.delete')}
                        className="inline-flex items-center rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-400 transition-colors hover:bg-brand/10 hover:text-brand disabled:opacity-50 sm:px-2.5"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        onClick={() => setExpanded(expanded === m._id ? null : m._id)}
                        aria-label={expanded === m._id ? t('common.hideDetails') : t('common.details')}
                        aria-expanded={expanded === m._id}
                        title={expanded === m._id ? t('common.hideDetails') : t('common.details')}
                        className="inline-flex items-center rounded-lg px-2 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/10 sm:px-2.5"
                      >
                        <ChevronDown size={14} className={`transition-transform ${expanded === m._id ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:border-brand hover:text-brand disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"><ChevronLeft size={16} /></button>
              <span className="px-3 text-sm font-semibold text-gray-600 dark:text-gray-300">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:border-brand hover:text-brand disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"><ChevronRight size={16} /></button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default AdminMessages
