import { useEffect, useRef, useState } from 'react'
import { getMensajes, enviarMensaje, marcarMensajesLeidos, fmtHora, fijarConversacion, renombrarConversacion } from '../lib/api'

function initials(name) {
  return (name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function ChatView({ conv, user, usuarios, onChanged }) {
  const [mensajes, setMensajes] = useState([])
  const [texto, setTexto] = useState('')
  const [urgente, setUrgente] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [busquedaMsg, setBusquedaMsg] = useState('')
  const bottomRef = useRef(null)

  async function load() {
    if (!conv) return
    const msgs = await getMensajes(conv.id)
    setMensajes(msgs)
    setLoading(false)
    await marcarMensajesLeidos(conv.id, user.email)
    onChanged && onChanged()
  }

  useEffect(() => { setLoading(true); setShowSearch(false); setBusquedaMsg(''); load() }, [conv?.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes.length])

  if (!conv) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gris-texto)' }}>
        Elegí una conversación para empezar
      </div>
    )
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!texto.trim()) return
    const t = texto, u = urgente, r = replyTo
    setTexto(''); setUrgente(false); setReplyTo(null)
    await enviarMensaje(conv.id, user.email, t, u, r?.id)
    await load()
  }

  const byId = {}
  mensajes.forEach(m => { byId[m.id] = m })
  const userMap = {}
  usuarios.forEach(u => { userMap[u.email] = u })

  const qMsg = busquedaMsg.trim().toLowerCase()
  const mensajesVisibles = qMsg ? mensajes.filter(m => (m.texto || '').toLowerCase().includes(qMsg)) : mensajes

  function resaltar(texto) {
    if (!qMsg) return texto
    const idx = texto.toLowerCase().indexOf(qMsg)
    if (idx === -1) return texto
    return <>{texto.slice(0, idx)}<mark style={{ background: 'var(--lila-suave)', color: 'inherit', borderRadius: 3 }}>{texto.slice(idx, idx + qMsg.length)}</mark>{resaltar(texto.slice(idx + qMsg.length))}</>
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid var(--gris-borde)', background: 'var(--blanco)',
        display: 'flex', alignItems: 'center', gap: 12
      }}>
        <div className="avatar" style={{ background: conv.otroColor }}>{initials(conv.otroNombre)}</div>
        <div style={{ flex: 1 }}>
          {editingName ? (
            <form onSubmit={async e => { e.preventDefault(); await renombrarConversacion(conv.id, nameDraft); setEditingName(false); onChanged && onChanged() }}
              style={{ display: 'flex', gap: 6 }}>
              <input autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)} style={{ fontSize: 13, padding: '4px 8px' }} />
              <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }}>OK</button>
            </form>
          ) : (
            <div style={{ fontWeight: 700, fontSize: 15 }}
              onClick={() => { setNameDraft(conv.nombre_conv || ''); setEditingName(true) }}>
              {conv.nombre_conv || conv.otroNombre} {conv.nombre_conv && <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--gris-texto)' }}>· {conv.otroNombre}</span>}
            </div>
          )}
        </div>
        <button onClick={() => setShowSearch(s => !s)}
          className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
          🔍 Buscar
        </button>
        <button onClick={async () => { await fijarConversacion(conv.id, !conv.fijadaBool); onChanged && onChanged() }}
          className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
          {conv.fijadaBool ? '📌 Fijada' : 'Fijar'}
        </button>
      </div>

      {showSearch && (
        <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--gris-borde)', background: 'var(--blanco)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <input autoFocus type="text" value={busquedaMsg} onChange={e => setBusquedaMsg(e.target.value)}
            placeholder="Buscar en esta conversación..." style={{ fontSize: 13, padding: '8px 12px', flex: 1 }} />
          {qMsg && <span style={{ fontSize: 12, color: 'var(--gris-texto)', whiteSpace: 'nowrap' }}>{mensajesVisibles.length} resultado{mensajesVisibles.length === 1 ? '' : 's'}</span>}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && <div style={{ color: 'var(--gris-texto)', fontSize: 13 }}>Cargando...</div>}
        {!loading && qMsg && mensajesVisibles.length === 0 && (
          <div style={{ color: 'var(--gris-texto)', fontSize: 13, textAlign: 'center' }}>Sin resultados para "{busquedaMsg}".</div>
        )}
        {mensajesVisibles.map(m => {
          const mine = (m.autor || '').toLowerCase() === user.email.toLowerCase()
          const autorU = userMap[(m.autor || '').toLowerCase()] || {}
          const isUrgente = String(m.urgente).toUpperCase() === 'SI'
          const replied = m.reply_to_id ? byId[m.reply_to_id] : null
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '62%', background: mine ? 'var(--violeta-oscuro)' : 'var(--blanco)',
                color: mine ? '#fff' : 'var(--negro)', padding: '10px 14px', borderRadius: 14,
                border: mine ? 'none' : '1px solid var(--gris-borde)',
                borderBottomRightRadius: mine ? 4 : 14, borderBottomLeftRadius: mine ? 14 : 4,
                boxShadow: '0 2px 6px rgba(46,31,82,.05)'
              }}>
                {!mine && <div style={{ fontSize: 11, fontWeight: 700, color: autorU.color || 'var(--violeta)', marginBottom: 2 }}>{autorU.nombre || m.autor}</div>}
                {isUrgente && <div style={{ fontSize: 10, fontWeight: 800, color: mine ? '#FFD9D9' : 'var(--rojo-urgente)', marginBottom: 3 }}>🚨 URGENTE</div>}
                {replied && (
                  <div style={{
                    borderLeft: '3px solid ' + (mine ? 'rgba(255,255,255,.5)' : 'var(--violeta)'), paddingLeft: 8, marginBottom: 6,
                    fontSize: 12, opacity: .8
                  }}>{replied.texto?.slice(0, 80)}</div>
                )}
                <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{resaltar(m.texto)}</div>
                <div style={{ fontSize: 10, opacity: .7, marginTop: 4, textAlign: 'right' }}>{fmtHora(m.fecha)}</div>
              </div>
              <button onClick={() => setReplyTo(m)} style={{
                background: 'none', border: 'none', fontSize: 11, color: 'var(--gris-texto)', padding: '2px 4px', fontWeight: 400
              }}>Responder</button>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={{ padding: '14px 24px', borderTop: '1px solid var(--gris-borde)', background: 'var(--blanco)' }}>
        {replyTo && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--lila-suave)',
            padding: '6px 12px', borderRadius: 8, marginBottom: 8, fontSize: 12
          }}>
            <span>Respondiendo: {replyTo.texto?.slice(0, 60)}</span>
            <button type="button" onClick={() => setReplyTo(null)} style={{ background: 'none', color: 'var(--gris-texto)' }}>✕</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribí un mensaje..."
            rows={1} style={{ resize: 'none' }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) } }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--rojo-urgente)', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={urgente} onChange={e => setUrgente(e.target.checked)} style={{ width: 'auto' }} />
            Urgente
          </label>
          <button type="submit" className="btn-primary" style={{ padding: '11px 22px' }}>Enviar</button>
        </div>
      </form>
    </div>
  )
}
