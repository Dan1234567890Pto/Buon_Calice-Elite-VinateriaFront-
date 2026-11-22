import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    actualizarEstadoPedido,
    eliminarPedido,
    getReporteVentas
} from '../../services/api';

const API_BASE_URL = 'https://buon-calice-fhfefadvd2bygphx.westcentralus-01.azurewebsites.net/api';

export default function EmpleadoView() {
    const navigate = useNavigate();

    // Lee ÚNICAMENTE la sesión administrativa (nunca toca cliente_buoncalice)
    const [staff] = useState(() => {
        const guardado = localStorage.getItem('usuario_admin');
        return guardado ? JSON.parse(guardado) : null;
    });

    const [vistaActiva, setVistaActiva] = useState('pedidos'); // 'pedidos' | 'reportes'
    const [pedidos, setPedidos] = useState([]);
    const [reporte, setReporte] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!staff) {
            navigate('/login', { replace: true });
            return;
        }
        cargarDatos();
    }, [staff, navigate]);

    const cargarDatos = async () => {
        setCargando(true);
        setError('');
        try {
            const resPedidos = await fetch(`${API_BASE_URL}/pedidos`);
            if (!resPedidos.ok) throw new Error('No se pudieron cargar los pedidos.');
            const dataPedidos = await resPedidos.json();
            setPedidos(Array.isArray(dataPedidos) ? dataPedidos : []);

            const dataReporte = await getReporteVentas().catch(() => null);
            setReporte(dataReporte);
        } catch (err) {
            setError(err.message || 'Error al conectar con el servidor.');
        } finally {
            setCargando(false);
        }
    };

    const handleCambiarEstado = async (idPedido, nuevoEstado) => {
        try {
            await actualizarEstadoPedido(idPedido, nuevoEstado);
            setPedidos(prev =>
                prev.map(p =>
                    (p.idPedido || p.id) === idPedido ? { ...p, estado: nuevoEstado } : p
                )
            );
            const dataReporte = await getReporteVentas().catch(() => null);
            if (dataReporte) setReporte(dataReporte);
        } catch (err) {
            alert(`⚠️ ${err.message}`);
        }
    };

    const handleEliminarPedido = async (idPedido) => {
        if (!window.confirm(`¿Eliminar permanentemente el pedido #${idPedido}?`)) return;
        try {
            await eliminarPedido(idPedido);
            setPedidos(prev => prev.filter(p => (p.idPedido || p.id) !== idPedido));
        } catch (err) {
            alert(`⚠️ ${err.message}`);
        }
    };

    // Cierra SOLO la sesión del empleado/admin sin afectar la sesión del cliente
    const handleCerrarSesion = () => {
        localStorage.removeItem('usuario_admin');
        navigate('/login', { replace: true });
    };

    if (!staff) return null;

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#0D0B0A', color: '#F3ECE0', padding: '1.5rem' }}>
            {/* Barra superior administrativa */}
            <header style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                padding: '1.25rem 1.5rem',
                backgroundColor: '#16120E',
                borderRadius: '14px',
                border: '1px solid #26201B',
                marginBottom: '1.5rem'
            }}>
                <div>
                    <span style={{ fontSize: '0.75rem', color: '#C5A059', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        Panel {staff.rol === 'admin' ? 'Administrador' : 'Empleado'} • Élite Vinatería
                    </span>
                    <h1 style={{ margin: '0.25rem 0 0 0', fontSize: '1.4rem', fontFamily: 'serif' }}>
                        Bienvenido, {staff.nombre || staff.correo}
                    </h1>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                        onClick={cargarDatos}
                        style={{ padding: '0.6rem 1rem', backgroundColor: '#26201B', color: '#F3ECE0', border: '1px solid #382E26', borderRadius: '8px', cursor: 'pointer' }}
                    >
                        ↻ Actualizar
                    </button>
                    <button
                        onClick={handleCerrarSesion}
                        style={{ padding: '0.6rem 1rem', backgroundColor: 'transparent', color: '#f87171', border: '1px solid #dc2626', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Cerrar Sesión Staff
                    </button>
                </div>
            </header>

            {/* Pestañas de navegación */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <button
                    onClick={() => setVistaActiva('pedidos')}
                    style={{
                        padding: '0.7rem 1.25rem',
                        borderRadius: '8px',
                        border: 'none',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        backgroundColor: vistaActiva === 'pedidos' ? '#C5A059' : '#16120E',
                        color: vistaActiva === 'pedidos' ? '#000' : '#aaa'
                    }}
                >
                    📦 Gestión de Pedidos ({pedidos.length})
                </button>

                {staff.rol === 'admin' && (
                    <button
                        onClick={() => setVistaActiva('reportes')}
                        style={{
                            padding: '0.7rem 1.25rem',
                            borderRadius: '8px',
                            border: 'none',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            backgroundColor: vistaActiva === 'reportes' ? '#C5A059' : '#16120E',
                            color: vistaActiva === 'reportes' ? '#000' : '#aaa'
                        }}
                    >
                        📊 Reporte de Ventas
                    </button>
                )}
            </div>

            {error && (
                <div style={{ padding: '1rem', backgroundColor: 'rgba(220,38,38,0.15)', border: '1px solid #dc2626', borderRadius: '10px', color: '#fca5a5', marginBottom: '1rem' }}>
                    {error}
                </div>
            )}

            {cargando ? (
                <p style={{ textAlign: 'center', color: '#C5A059', padding: '2rem' }}>Cargando información...</p>
            ) : vistaActiva === 'pedidos' ? (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {pedidos.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#16120E', borderRadius: '12px', border: '1px solid #26201B', color: '#888' }}>
                            No hay pedidos registrados todavía.
                        </div>
                    ) : (
                        pedidos.map((pedido) => {
                            const id = pedido.idPedido || pedido.id;
                            return (
                                <div key={id} style={{
                                    backgroundColor: '#16120E',
                                    border: '1px solid #26201B',
                                    borderRadius: '12px',
                                    padding: '1.25rem',
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '1rem'
                                }}>
                                    <div>
                                        <h3 style={{ margin: 0, color: '#C5A059' }}>
                                            Pedido #{id} — {pedido.nombreCliente || pedido.cliente || 'Cliente'}
                                        </h3>
                                        <p style={{ margin: '0.35rem 0', fontSize: '0.9rem', color: '#ccc' }}>
                                            Total: <strong>${Number(pedido.total || 0).toFixed(2)}</strong> • Estado: <span style={{ color: '#C5A059' }}>{pedido.estado || 'Pendiente'}</span>
                                        </p>
                                        {pedido.direccion && (
                                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#888' }}>📍 {pedido.direccion}</p>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <select
                                            value={pedido.estado || 'Pendiente'}
                                            onChange={(e) => handleCambiarEstado(id, e.target.value)}
                                            style={{ padding: '0.5rem', borderRadius: '8px', backgroundColor: '#0D0B0A', color: '#fff', border: '1px solid #382E26' }}
                                        >
                                            <option value="Pendiente">Pendiente</option>
                                            <option value="En camino">En camino</option>
                                            <option value="Entregado">Entregado</option>
                                            <option value="Cancelado">Cancelado</option>
                                        </select>

                                        {staff.rol === 'admin' && (
                                            <button
                                                onClick={() => handleEliminarPedido(id)}
                                                style={{ padding: '0.5rem 0.85rem', backgroundColor: 'rgba(220,38,38,0.15)', color: '#f87171', border: '1px solid #dc2626', borderRadius: '8px', cursor: 'pointer' }}
                                            >
                                                Eliminar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            ) : (
                <div style={{ backgroundColor: '#16120E', border: '1px solid #26201B', borderRadius: '12px', padding: '1.5rem' }}>
                    <h2 style={{ marginTop: 0, color: '#C5A059', fontFamily: 'serif' }}>Resumen Financiero</h2>
                    {reporte ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                            <div style={{ padding: '1rem', backgroundColor: '#0D0B0A', borderRadius: '10px', border: '1px solid #26201B' }}>
                                <span style={{ fontSize: '0.8rem', color: '#888' }}>INGRESOS TOTALES</span>
                                <p style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#C5A059', margin: '0.25rem 0 0 0' }}>
                                    ${Number(reporte.totalVentas || reporte.ingresosTotales || 0).toFixed(2)}
                                </p>
                            </div>
                            <div style={{ padding: '1rem', backgroundColor: '#0D0B0A', borderRadius: '10px', border: '1px solid #26201B' }}>
                                <span style={{ fontSize: '0.8rem', color: '#888' }}>PEDIDOS ENTREGADOS</span>
                                <p style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#F3ECE0', margin: '0.25rem 0 0 0' }}>
                                    {reporte.pedidosEntregados ?? reporte.totalPedidos ?? 0}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <p style={{ color: '#888' }}>No hay datos de ventas entregadas disponibles aún.</p>
                    )}
                </div>
            )}
        </div>
    );
}