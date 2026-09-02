import { useEffect, useState } from 'react'
import { getTareasRecurrentes, crearTareaRecurrente, actualizarTareaRecurrente, eliminarTareaRecurrente, fmtFecha } from '../lib/api'

const PRIORIDADES = ['Baja', 'Normal', 'Alta', 'Urgente']
const DIAS_SEMANA = [
  { v: 1, label: 'Lun' }, { v: 2, label: 'Mar' }, { v: 3, label: 'Mié' }, { v: 4, label: 'Jue' },
  { v: 5, label: 'Vie' }, { v: 6, label: 'Sáb' }, { v: 0, label: 'Dom' }
]
const POSICIONES = [
  { v: 1, label: '1º' }, { v: 2, label: '2º' }, { v: 3, label: '3º' }, { v: 4, label: '4º' }, { v: -1, label: 'Último' }
]
const nombreDia = v => DIAS_SEMANA.find(d => d.v === v)?.label || ''
const nombrePosicion = v => POSICIONES.find(p => p.v === v)?.label || ''

function describirFrecuencia(t) {
  if (t.tipo_frecuencia === 'diaria') return 'Todos los días'
  if (t.tipo_frecuencia === 'semanal') {
    const dias = t.frecuenciaConfigObj?.diasSemana || []
    const labels = DIAS_SEMANA.filter(d => dias.includes(d.v)).map(d => d.label)
    return labels.length ? `Semanal: ${labels.join(', ')}` : 'Semanal'
  }
  if (t.tipo_frecuencia === 'mensual') {
    const dia = t.frecuenciaConfigObj?.diaMes
    return dia ? `Mensual: día ${dia}` : 'Mensual'
  }
  if (t.tipo_frecuencia === 'mensual_dia_semana') {
    const { diaSemana, posicion } = t.frecuenciaConfigObj || {}
    return `Mensual: ${nombrePosicion(posicion)} ${nombreDia(diaSemana)} del mes`
  }
  return t.tipo_frecuencia
}

export default function RecurrentesView({ user, usuarios, esSocia }) {
  const [modo, setModo] = useState('propias')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  async function load() {
    setLoading(true)
    const data = await getTareasRecurrentes(user.email, modo, esSocia)
    setItems(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [modo])

  const userMap = {}
  usuarios.forEach(u => { userMap[u.email] = u })

  async function toggleActiva(t) {
    await actualizarTareaRecurrente(t.id, { activa: t.activaBool ? 'NO' : 'SI' })
    load()
  }

  async function eliminar(t) {
    if (!confirm(`¿Eliminar la tarea recurrente "${t.titulo}"? Esto no borra las tareas ya generadas.`)) return
    await eliminarTareaRecurrente(t.id)
    load()
  }

  return (
    <div style={{ flex: 1, height: '100vh', overflowY: 'auto', padding: '28px 36px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Tareas recurrentes</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ Nueva recurrente</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setModo('propias')} className={modo === 'propias' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: 13 }}>Las mías</button>
        {esSocia && <button onClick={() => setModo('ajenas')} className={modo === 'ajenas' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: 13 }}>Equipo</button>}
      </div>

      {loading && <div style={{ color: 'var(--gris-texto)' }}>Cargando...</div>}
      {!loading && items.length === 0 && <div style={{ color: 'var(--gris-texto)' }}>No hay tareas recurrentes acá.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(t => {
          const asignadoAU = userMap[t.asignado_a] || {}
          const asignadoPorU = userMap[t.asignado_por] || {}
          return (
            <div key={t.id} className="card" style={{ padding: '14px 18px', opacity: t.activaBool ? 1 : .55 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14.5 }}>{t.titulo}</span>
                    {t.prioridad && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--violeta)' }}>{t.prioridad.toUpperCase()}</span>}
                    {!t.activaBool && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--gris-texto)' }}>PAUSADA</span>}
                  </div>
                  {t.descripcion && <div style={{ fontSize: 13, color: 'var(--gris-texto)', marginTop: 4 }}>{t.descripcion}</div>}
                  <div style={{ fontSize: 12, color: 'var(--gris-texto)', marginTop: 6, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <span>Para: <b style={{ color: asignadoAU.color || 'var(--violeta)' }}>{asignadoAU.nombre || t.asignado_a}</b></span>
                    <span>De: {asignadoPorU.nombre || t.asignado_por}</span>
                    <span>{describirFrecuencia(t)}</span>
                    <span>Próxima: {fmtFecha(t.proxima_fecha) || t.proxima_fecha}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => toggleActiva(t)} className="btn-secondary" style={{ fontSize: 12, padding: '6px 10px' }}>
                    {t.activaBool ? 'Pausar' : 'Reanudar'}
                  </button>
                  <button onClick={() => eliminar(t)} className="btn-secondary" style={{ fontSize: 12, padding: '6px 10px' }}>
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showForm && <NewRecurrenteModal user={user} usuarios={usuarios} onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); load() }} />}
    </div>
  )
}

function NewRecurrenteModal({ user, usuarios, onClose, onCreated }) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [asignadoA, setAsignadoA] = useState(user.email)
  const [tipoFrecuencia, setTipoFrecuencia] = useState('semanal')
  const [diasSemana, setDiasSemana] = useState([])
  const [diaMes, setDiaMes] = useState(1)
  const [diaSemanaMensual, setDiaSemanaMensual] = useState(3)
  const [posicionMensual, setPosicionMensual] = useState(-1)
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().substring(0, 10))
  const [fechaFin, setFechaFin] = useState('')
  const [prioridad, setPrioridad] = useState('Normal')
  const [error, setError] = useState('')

  function toggleDia(v) {
    setDiasSemana(d => d.includes(v) ? d.filter(x => x !== v) : [...d, v].sort())
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!titulo.trim()) return
    if (tipoFrecuencia === 'semanal' && diasSemana.length === 0) {
      setError('Elegí al menos un día de la semana.')
      return
    }
    const frecuenciaConfig = tipoFrecuencia === 'semanal' ? { diasSemana }
      : tipoFrecuencia === 'mensual' ? { diaMes: Number(diaMes) }
      : tipoFrecuencia === 'mensual_dia_semana' ? { diaSemana: diaSemanaMensual, posicion: posicionMensual }
      : {}
    await crearTareaRecurrente({
      titulo: titulo.trim(), descripcion, asignadoPor: user.email, asignadoA,
      fechaInicio, fechaFin: fechaFin || null, tipoFrecuencia, frecuenciaConfig, prioridad
    })
    onCreated()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(46,31,82,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: 460, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, marginTop: 0 }}>Nueva tarea recurrente</h2>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Título</label>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} required style={{ marginBottom: 12, marginTop: 4 }} />
        <label style={{ fontSize: 13, fontWeight: 600 }}>Descripción</label>
        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} style={{ marginBottom: 12, marginTop: 4, resize: 'vertical' }} />
        <label style={{ fontSize: 13, fontWeight: 600 }}>Asignar a</label>
        <select value={asignadoA} onChange={e => setAsignadoA(e.target.value)} style={{ marginBottom: 12, marginTop: 4 }}>
          {usuarios.map(u => <option key={u.email} value={u.email}>{u.nombre}</option>)}
        </select>

        <label style={{ fontSize: 13, fontWeight: 600 }}>Frecuencia</label>
        <select value={tipoFrecuencia} onChange={e => setTipoFrecuencia(e.target.value)} style={{ marginBottom: 12, marginTop: 4 }}>
          <option value="diaria">Diaria</option>
          <option value="semanal">Semanal (ej: todos los miércoles)</option>
          <option value="mensual">Mensual — por día del mes (ej: día 15)</option>
          <option value="mensual_dia_semana">Mensual — por día de semana (ej: último miércoles)</option>
        </select>

        {tipoFrecuencia === 'semanal' && (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: error ? 6 : 12, flexWrap: 'wrap' }}>
              {DIAS_SEMANA.map(d => (
                <label key={d.v} style={{
                  display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '5px 9px',
                  borderRadius: 8, border: '1px solid var(--gris-borde)',
                  background: diasSemana.includes(d.v) ? 'var(--lila-suave)' : 'transparent'
                }}>
                  <input type="checkbox" checked={diasSemana.includes(d.v)} onChange={() => toggleDia(d.v)} style={{ width: 'auto' }} />
                  {d.label}
                </label>
              ))}
            </div>
            {error && <div style={{ fontSize: 12, color: 'var(--rojo-urgente)', marginBottom: 12 }}>{error}</div>}
          </>
        )}
        {tipoFrecuencia === 'mensual' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Día del mes</label>
            <input type="number" min={1} max={31} value={diaMes} onChange={e => setDiaMes(e.target.value)} style={{ marginTop: 4 }} />
          </div>
        )}
        {tipoFrecuencia === 'mensual_dia_semana' && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Cuál</label>
              <select value={posicionMensual} onChange={e => setPosicionMensual(Number(e.target.value))} style={{ marginTop: 4 }}>
                {POSICIONES.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Día</label>
              <select value={diaSemanaMensual} onChange={e => setDiaSemanaMensual(Number(e.target.value))} style={{ marginTop: 4 }}>
                {DIAS_SEMANA.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
              </select>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Empieza</label>
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} style={{ marginTop: 4 }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Termina (opcional)</label>
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={{ marginTop: 4 }} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Prioridad</label>
          <select value={prioridad} onChange={e => setPrioridad(e.target.value)} style={{ marginTop: 4 }}>
            {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" className="btn-primary">Crear</button>
        </div>
      </form>
    </div>
  )
}
