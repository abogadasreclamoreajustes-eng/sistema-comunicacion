import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  getTareas, actualizarTarea, crearTarea, fmtFecha, fmtHora,
  getComentariosPorTareas, agregarComentarioTarea, marcarComentariosLeidos, unreadCount
} from '../lib/api'

const PRIORIDADES = ['Baja', 'Normal', 'Alta', 'Urgente']
const PRIORIDAD_COLOR = { Urgente: 'var(--rojo-urgente)', Alta: '#B8863B', Normal: 'var(--violeta)', Baja: 'var(--gris-texto)' }

export default function TasksView({ user, usuarios, esSocia }) {
  const [modo, setModo] = useState('propias')
  const [tareas, setTareas] = useState([])
  const [comentarios, setComentarios] = useState({})
  const [expandedId, setExpandedId] = useState(null)
  const [borrador, setBorrador] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filtroPersona, setFiltroPersona] = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState('')
  const [soloVencidas, setSoloVencidas] = useState(false)
  const [verHechas, setVerHechas] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const expandedIdRef = useRef(null)
  useEffect(() => { expandedIdRef.current = expandedId }, [expandedId])

  async function load() {
    setLoading(true)
    const data = await getTareas(user.email, modo, esSocia)
    setTareas(data)
    let porTarea = await getComentariosPorTareas(data.map(t => t.id))
    // Si el hilo de una tarea ya está abierto, lo que llegue por tiempo real se marca leído solo.
    const abiertaId = expandedIdRef.current
    if (abiertaId && unreadCount(porTarea[abiertaId] || [], user.email) > 0) {
      await marcarComentariosLeidos(abiertaId, user.email)
      porTarea = await getComentariosPorTareas(data.map(t => t.id))
    }
    setComentarios(porTarea)
    setLoading(false)
  }

  useEffect(() => { load() }, [modo])

  // Tiempo real: si alguien agrega una actualización o cambia una tarea mientras esta pantalla
  // está abierta, se refleja sin recargar.
  useEffect(() => {
    const channel = supabase.channel('tareas-comentarios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarea_comentarios' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [modo])

  async function toggleCompletada(t) {
    await actualizarTarea(t.id, { estado: t.estado === 'completada' ? 'pendiente' : 'completada' })
    load()
  }

  async function handleExpand(t) {
    if (expandedId === t.id) { setExpandedId(null); return }
    setExpandedId(t.id)
    setBorrador('')
    const nolLeidos = unreadCount(comentarios[t.id] || [], user.email)
    if (nolLeidos > 0) {
      await marcarComentariosLeidos(t.id, user.email)
      const porTarea = await getComentariosPorTareas(tareas.map(x => x.id))
      setComentarios(porTarea)
    }
  }

  async function handleAgregarComentario(t) {
    if (!borrador.trim()) return
    const texto = borrador
    setBorrador('')
    await agregarComentarioTarea(t.id, user.email, texto)
    const porTarea = await getComentariosPorTareas(tareas.map(x => x.id))
    setComentarios(porTarea)
  }

  const userMap = {}
  usuarios.forEach(u => { userMap[u.email] = u })

  const q = busqueda.trim().toLowerCase()
  const tareasFiltradas = tareas.filter(t => {
    if (!verHechas && t.estado === 'completada') return false
    if (filtroPersona && t.asignado_a !== filtroPersona) return false
    if (filtroPrioridad && t.prioridad !== filtroPrioridad) return false
    if (soloVencidas && !t.vencida) return false
    if (q && !(t.titulo || '').toLowerCase().includes(q) && !(t.descripcion || '').toLowerCase().includes(q)) return false
    return true
  })

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

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por título o descripción..." style={{ fontSize: 13, padding: '8px 12px', width: 220 }}
        />
        {esSocia && modo === 'ajenas' && (
          <select value={filtroPersona} onChange={e => setFiltroPersona(e.target.value)} style={{ fontSize: 13, padding: '8px 10px', width: 'auto' }}>
            <option value="">Todas las personas</option>
            {usuarios.map(u => <option key={u.email} value={u.email}>{u.nombre}</option>)}
          </select>
        )}
        <select value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value)} style={{ fontSize: 13, padding: '8px 10px', width: 'auto' }}>
          <option value="">Toda prioridad</option>
          {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <label style={{ fontSize: 13, color: 'var(--gris-texto)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={soloVencidas} onChange={e => setSoloVencidas(e.target.checked)} style={{ width: 'auto' }} />
          Solo vencidas
        </label>
        <label style={{ fontSize: 13, color: 'var(--gris-texto)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={verHechas} onChange={e => setVerHechas(e.target.checked)} style={{ width: 'auto' }} />
          Ver hechas (historial)
        </label>
      </div>

      {loading && <div style={{ color: 'var(--gris-texto)' }}>Cargando...</div>}
      {!loading && tareas.length === 0 && <div style={{ color: 'var(--gris-texto)' }}>No hay tareas acá.</div>}
      {!loading && tareas.length > 0 && tareasFiltradas.length === 0 && (
        <div style={{ color: 'var(--gris-texto)' }}>
          {verHechas ? 'Ninguna tarea coincide con el filtro.' : 'No hay tareas pendientes acá. (Las hechas quedan en "Ver hechas".)'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tareasFiltradas.map(t => {
          const asignadoAU = userMap[t.asignado_a] || {}
          const asignadoPorU = userMap[t.asignado_por] || {}
          const completada = t.estado === 'completada'
          const hilo = comentarios[t.id] || []
          const sinLeer = unreadCount(hilo, user.email)
          const expandido = expandedId === t.id
          return (
            <div key={t.id} className="card" style={{
              padding: '14px 18px', opacity: completada ? .55 : 1,
              borderColor: t.vencida ? 'var(--rojo-urgente)' : 'var(--gris-borde)'
            }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <input type="checkbox" checked={completada} onChange={() => toggleCompletada(t)} style={{ width: 18, height: 18, marginTop: 3 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14.5, textDecoration: completada ? 'line-through' : 'none' }}>{t.titulo}</span>
                    {t.prioridad && <span style={{ fontSize: 10, fontWeight: 800, color: PRIORIDAD_COLOR[t.prioridad] || 'var(--violeta)' }}>{t.prioridad.toUpperCase()}</span>}
                    {t.vencida && <span className="badge-urgente">VENCIDA</span>}
                    {completada && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--gris-texto)' }}>HECHA</span>}
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
                  <button onClick={() => handleExpand(t)} className="btn-secondary" style={{
                    marginTop: 10, fontSize: 12, padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 6
                  }}>
                    💬 {hilo.length > 0 ? `${hilo.length} actualización${hilo.length === 1 ? '' : 'es'}` : 'Agregar actualización'}
                    {sinLeer > 0 && <span className="badge">{sinLeer}</span>}
                  </button>
                </div>
              </div>

              {expandido && (
                <div style={{ marginTop: 12, marginLeft: 32, borderTop: '1px solid var(--gris-borde)', paddingTop: 10 }}>
                  {hilo.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--gris-texto)', marginBottom: 8 }}>Todavía no hay actualizaciones.</div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10, maxHeight: 220, overflowY: 'auto' }}>
                    {hilo.map(c => {
                      const autorU = userMap[(c.autor || '').toLowerCase()] || {}
                      return (
                        <div key={c.id} style={{ fontSize: 13 }}>
                          <span style={{ fontWeight: 700, color: autorU.color || 'var(--violeta)' }}>{autorU.nombre || c.autor}</span>
                          <span style={{ color: 'var(--gris-texto)', fontSize: 11 }}> · {fmtFecha(c.fecha)}</span>
                          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.texto}</div>
                        </div>
                      )
                    })}
                  </div>
                  <form onSubmit={e => { e.preventDefault(); handleAgregarComentario(t) }} style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text" value={borrador} onChange={e => setBorrador(e.target.value)}
                      placeholder="Ej: Estoy esperando documentación del cliente..." style={{ fontSize: 13, padding: '8px 10px', flex: 1 }}
                    />
                    <button type="submit" className="btn-primary" style={{ fontSize: 12, padding: '8px 14px' }}>Agregar</button>
                  </form>
                </div>
              )}
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
