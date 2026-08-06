import { useState } from 'react'
import { fmtHora } from '../lib/api'

function initials(name) {
  return (name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function Sidebar({
  view, setView, conversaciones, mensajesUnread, mensajesPorConv, activeConvId, setActiveConvId,
  esSocia, verTodas, setVerTodas, onNuevaConversacion, user, onLogout
}) {
  const [busqueda, setBusqueda] = useState('')
  const q = busqueda.trim().toLowerCase()
  const conversacionesFiltradas = q
    ? conversaciones.filter(c => (
        (c.nombre_conv || '').toLowerCase().includes(q) ||
        (c.otroNombre || '').toLowerCase().includes(q) ||
        (c.ultimo_mensaje || '').toLowerCase().includes(q) ||
        (mensajesPorConv?.[c.id] || []).some(m => m.eliminado !== 'SI' && (m.texto || '').toLowerCase().includes(q))
      ))
    : conversaciones
  return (
    <div style={{
      width: 320, background: 'var(--blanco)', borderRight: '1px solid var(--gris-borde)',
      display: 'flex', flexDirection: 'column', height: '100vh'
    }}>
      <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid var(--gris-borde)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, background: 'var(--violeta-oscuro)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13
          }}>BA</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.nombre}</div>
            <div style={{ fontSize: 11, color: 'var(--gris-texto)' }}>{user.rol === 'socia' ? 'Socia' : 'Empleada'}</div>
          </div>
          <button onClick={onLogout} className="btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }}>Salir</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setView('chat')} className={view === 'chat' ? 'btn-primary' : 'btn-secondary'}
            style={{ flex: 1, padding: '9px 0', fontSize: 13 }}>Mensajes</button>
          <button onClick={() => setView('tareas')} className={view === 'tareas' ? 'btn-primary' : 'btn-secondary'}
            style={{ flex: 1, padding: '9px 0', fontSize: 13 }}>Tareas</button>
        </div>
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setView('recurrentes')} className={view === 'recurrentes' ? 'btn-primary' : 'btn-secondary'}
            style={{ width: '100%', padding: '9px 0', fontSize: 13 }}>↻ Recurrentes</button>
        </div>
      </div>

      {view === 'chat' && (
        <>
          <div style={{ padding: '12px 20px 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={onNuevaConversacion} className="btn-primary" style={{ flex: 1, fontSize: 13, padding: '9px 0' }}>
              + Nueva conversación
            </button>
          </div>
          {esSocia && (
            <div style={{ padding: '0 20px 8px', display: 'flex', gap: 6 }}>
              <label style={{ fontSize: 12, color: 'var(--gris-texto)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={verTodas} onChange={e => setVerTodas(e.target.checked)} style={{ width: 'auto' }} />
                Ver todas las conversaciones del equipo
              </label>
            </div>
          )}
          <div style={{ padding: '0 20px 8px' }}>
            <input
              type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar conversación o mensaje..."
              style={{ fontSize: 13, padding: '8px 12px' }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversaciones.length === 0 && (
              <div style={{ padding: 24, color: 'var(--gris-texto)', fontSize: 13, textAlign: 'center' }}>
                No hay conversaciones todavía.
              </div>
            )}
            {conversaciones.length > 0 && conversacionesFiltradas.length === 0 && (
              <div style={{ padding: 24, color: 'var(--gris-texto)', fontSize: 13, textAlign: 'center' }}>
                Sin resultados para "{busqueda}".
              </div>
            )}
            {conversacionesFiltradas.map(c => {
              const unread = mensajesUnread[c.id] || 0
              const active = c.id === activeConvId
              return (
                <div key={c.id} onClick={() => setActiveConvId(c.id)} style={{
                  display: 'flex', gap: 12, alignItems: 'center', padding: '12px 20px', cursor: 'pointer',
                  background: active ? 'var(--lila-suave)' : 'transparent', borderLeft: active ? '3px solid var(--violeta-oscuro)' : '3px solid transparent'
                }}>
                  <div className="avatar" style={{ background: c.otroColor }}>{initials(c.otroNombre)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5 }}>
                        {c.nombre_conv ? c.nombre_conv : c.otroNombre}
                        {c.fijadaBool && ' 📌'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--gris-texto)' }}>{fmtHora(c.ultima_actividad)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: 12, color: 'var(--gris-texto)', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190
                      }}>{c.ultimo_mensaje || 'Sin mensajes'}</span>
                      {unread > 0 && <span className="badge">{unread}</span>}
                    </div>
                    {c.nombre_conv && <div style={{ fontSize: 11, color: 'var(--violeta)' }}>{c.otroNombre}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
