import { useState } from 'react'
import { crearConversacion } from '../lib/api'

export default function NewConversationModal({ user, usuarios, onClose, onCreated }) {
  const otros = usuarios.filter(u => u.email !== user.email)
  const [participante, setParticipante] = useState(otros[0]?.email || '')
  const [nombreConv, setNombreConv] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [creando, setCreando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nombreConv.trim() || !participante || creando) return
    setCreando(true)
    try {
      const res = await crearConversacion(user.email, participante, nombreConv.trim(), mensaje, user.email)
      onCreated(res.id)
    } finally {
      setCreando(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(46,31,82,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: 420, padding: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, marginTop: 0 }}>Nueva conversación</h2>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Con quién</label>
        <select value={participante} onChange={e => setParticipante(e.target.value)} style={{ marginBottom: 12, marginTop: 4 }}>
          {otros.map(u => <option key={u.email} value={u.email}>{u.nombre}</option>)}
        </select>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Cliente / asunto</label>
        <input value={nombreConv} onChange={e => setNombreConv(e.target.value)} required
          placeholder="Ej: Pérez, reajuste jubilatorio" style={{ marginBottom: 12, marginTop: 4 }} />
        <label style={{ fontSize: 13, fontWeight: 600 }}>Primer mensaje (opcional)</label>
        <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} rows={3} style={{ marginTop: 4, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={creando}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={creando}>{creando ? 'Creando…' : 'Crear'}</button>
        </div>
      </form>
    </div>
  )
}
