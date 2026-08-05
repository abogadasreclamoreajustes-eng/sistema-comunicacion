import { useEffect, useState } from 'react'
import { getTareas, actualizarTarea, crearTarea, fmtFecha } from '../lib/api'

const PRIORIDADES = ['Baja', 'Normal', 'Alta', 'Urgente']
const PRIORIDAD_COLOR = { Urgente: 'var(--rojo-urgente)', Alta: '#B8863B', Normal: 'var(--violeta)', Baja: 'var(--gris-texto)' }

export default function TasksView({ user, usuarios, esSocia }) {
  const [modo, setModo] = useState('propias')
  const [tareas, setTareas] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const data = await getTareas(user.email, modo, esSocia)
    setTareas(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [modo])

  async function toggleCompletada(t) {
    await actualizarTarea(t.id, { estado: t.estado === 'completada' ? 'pendiente' : 'completada' })
    load()
  }

  const userMap = {}
  usuarios.forEach(u => { userMap[u.email] = u })

  return (
    <div style={{ flex: 1, height: '100vh', overflowY: 'auto', padding: '28px 36px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Tareas</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ Nueva tarea</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setModo('propias')} className={modo === 'propias' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: 13 }}>Mis tareas</button>
        {esSocia && <>
          <button onClick={() => setModo('asignadas')} className={modo === 'asignadas' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: 13 }}>Asignadas por mí</button>
          <button onClick={() => setModo('ajenas')} className={modo === 'ajenas' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: 13 }}>Equipo</button>
        </>}
      </div>

      {loading && <div style={{ color: 'var(--gris-texto)' }}>Cargando...</div>}
      {!loading && tareas.length === 0 && <div style={{ color: 'var(--gris-texto)' }}>No hay tareas acá.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tareas.map(t => {
          const asignadoAU = userMap[t.asignado_a] || {}
          const asignadoPorU = userMap[t.asignado_por] || {}
          const completada = t.estado === 'completada'
          return (
            <div key={t.id} className="card" style={{
              padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'flex-start',
              opacity: completada ? .55 : 1, borderColor: t.vencida ? 'var(--rojo-urgente)' : 'var(--gris-borde)'
            }}>
              <input type="checkbox" checked={completada} onChange={() => toggleCompletada(t)} style={{ width: 18, height: 18, marginTop: 3 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14.5, textDecoration: completada ? 'line-through' : 'none' }}>{t.titulo}</span>
                  {t.prioridad && <span style={{ fontSize: 10, fontWeight: 800, color: PRIORIDAD_COLOR[t.prioridad] || 'var(--violeta)' }}>{t.prioridad.toUpperCase()}</span>}
                  {t.vencida && <span className="badge-urgente">VENCIDA</span>}
                </div>
                {t.descripcion && <div style={{ fontSize: 13, color: 'var(--gris-texto)', marginTop: 4 }}>{t.descripcion}</div>}
                <div style={{ fontSize: 12, color: 'var(--gris-texto)', marginTop: 6, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {t.asignado_a && <span>Para: <b style={{ color: asignadoAU.color || 'var(--violeta)' }}>{asignadoAU.nombre || t.asignado_a}</b></span>}
                  {t.asignado_por && <span>De: {asignadoPorU.nombre || t.asignado_por}</span>}
                  {t.fecha_vencimiento && <span>Vence: {fmtFecha(t.fecha_vencimiento)}</span>}
                </div>
                {t.notas && t.notas.startsWith('IMPORTADO SIN MAPEAR') && (
                  <div style={{ fontSize: 11, color: 'var(--gris-texto)', marginTop: 6, fontStyle: 'italic' }}>
                    Tarea importada del sistema anterior — revisar detalle manualmente.
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showForm && <NewTaskModal user={user} usuarios={usuarios} onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); load() }} />}
    </div>
  )
}

function NewTaskModal({ user, usuarios, onClose, onCreated }) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [asignadoA, setAsignadoA] = useState(user.email)
  const [fechaVenc, setFechaVenc] = useState('')
  const [prioridad, setPrioridad] = useState('Normal')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!titulo.trim()) return
    await crearTarea({ titulo: titulo.trim(), descripcion, asignadoPor: user.email, asignadoA, fechaVenc: fechaVenc || null, prioridad })
    onCreated()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(46,31,82,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: 420, padding: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, marginTop: 0 }}>Nueva tarea</h2>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Título</label>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} required style={{ marginBottom: 12, marginTop: 4 }} />
        <label style={{ fontSize: 13, fontWeight: 600 }}>Descripción</label>
        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3} style={{ marginBottom: 12, marginTop: 4, resize: 'vertical' }} />
        <label style={{ fontSize: 13, fontWeight: 600 }}>Asignar a</label>
        <select value={asignadoA} onChange={e => setAsignadoA(e.target.value)} style={{ marginBottom: 12, marginTop: 4 }}>
          {usuarios.map(u => <option key={u.email} value={u.email}>{u.nombre}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Vencimiento</label>
            <input type="date" value={fechaVenc} onChange={e => setFechaVenc(e.target.value)} style={{ marginTop: 4 }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Prioridad</label>
            <select value={prioridad} onChange={e => setPrioridad(e.target.value)} style={{ marginTop: 4 }}>
              {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" className="btn-primary">Crear tarea</button>
        </div>
      </form>
    </div>
  )
}
