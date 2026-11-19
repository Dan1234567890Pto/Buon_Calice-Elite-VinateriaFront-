import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getProductos,
    getProductoPorId,
    guardarProducto,
    eliminarProducto,
    getPedidos,
    actualizarEstadoPedido,
    getReporteVentas
} from '../../services/api';

export default function EmpleadoView() {
    const [productos, setProductos] = useState([]);
    const [cargandoProductos, setCargandoProductos] = useState(true);
    const [errorProductos, setErrorProductos] = useState('');

    // Paginación del inventario (10 productos por página)
    const [paginaActual, setPaginaActual] = useState(1);
    const productosPorPagina = 10;

    const [pedidos, setPedidos] = useState([]);
    const [cargandoPedidos, setCargandoPedidos] = useState(true);
    const [errorPedidos, setErrorPedidos] = useState('');
    const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);

    const [pedidosEliminados, setPedidosEliminados] = useState([]);

    // Estado para almacenar los indicadores KPI de ventas acumuladas
    const [reporteVentas, setReporteVentas] = useState({ totalPedidos: 0, totalVendido: 0, ticketPromedio: 0 });

    const [productoEditandoId, setProductoEditandoId] = useState(null);
    const [idBusqueda, setIdBusqueda] = useState('');
    const [productoBuscado, setProductoBuscado] = useState(null);
    const [codigoPedidoBorrar, setCodigoPedidoBorrar] = useState('');

    const usuarioSesion = JSON.parse(localStorage.getItem('usuario_admin')) || { nombre: 'Administrador Élite' };

    const [formData, setFormData] = useState({
        nombre: '',
        categoria: 'Whisky',
        precio: '',
        stock: '',
        imagen: '',
        descripcion: ''
    });

    const navigate = useNavigate();

    useEffect(() => {
        obtenerProductos();
        obtenerPedidos();
        obtenerMetricasVentas();

        const intervalo = setInterval(() => {
            obtenerPedidos();
            obtenerMetricasVentas();
        }, 5000);

        return () => clearInterval(intervalo);
    }, [pedidosEliminados]);

    const obtenerMetricasVentas = async () => {
        try {
            const data = await getReporteVentas();
            setReporteVentas({
                totalPedidos: data.totalPedidos || data.TotalPedidos || 0,
                totalVendido: data.totalVendido || data.TotalVendido || 0,
                ticketPromedio: data.ticketPromedio || data.TicketPromedio || 0
            });
        } catch (err) {
            console.error('Error al cargar reporte de ventas:', err);
        }
    };

    const obtenerPedidos = async () => {
        try {
            const data = await getPedidos();

            const pedidosValidos = (data || []).filter(p => {
                const idPed = (p.idPedido || p.id_pedido || p.id || '').toString();
                const cod = (p.codigo || '').toUpperCase();
                return !pedidosEliminados.includes(idPed) && !pedidosEliminados.includes(cod);
            });

            setPedidos(pedidosValidos);

            setPedidoSeleccionado(prevSel => {
                if (!prevSel) {
                    return pedidosValidos.length > 0 ? {
                        ...pedidosValidos[0],
                        idPedido: pedidosValidos[0].idPedido || pedidosValidos[0].id_pedido || pedidosValidos[0].id
                    } : null;
                }

                const prevId = (prevSel.idPedido || prevSel.id_pedido || prevSel.id || '').toString();
                const coincidencia = pedidosValidos.find(p => {
                    const idActual = (p.idPedido || p.id_pedido || p.id || '').toString();
                    return idActual === prevId || (p.codigo && p.codigo === prevSel.codigo);
                });

                if (coincidencia) {
                    return {
                        ...coincidencia,
                        idPedido: coincidencia.idPedido || coincidencia.id_pedido || coincidencia.id
                    };
                }

                return pedidosValidos.length > 0 ? {
                    ...pedidosValidos[0],
                    idPedido: pedidosValidos[0].idPedido || pedidosValidos[0].id_pedido || pedidosValidos[0].id
                } : null;
            });

        } catch (err) {
            console.error(err);
            setErrorPedidos('No se pudieron obtener los pedidos en tiempo real.');
        } finally {
            setCargandoPedidos(false);
        }
    };

    const obtenerProductos = async () => {
        setCargandoProductos(true);
        try {
            const data = await getProductos(false);
            setProductos(data || []);
        } catch (err) {
            console.error(err);
            setErrorProductos('No se pudo cargar el inventario de productos.');
        } finally {
            setCargandoProductos(false);
        }
    };

    const handleSeleccionarPedido = (pedido) => {
        setPedidoSeleccionado({
            ...pedido,
            idPedido: pedido.idPedido || pedido.id_pedido || pedido.id
        });
    };

    const handleCambiarEstadoPedido = async (nuevoEstado) => {
        if (!pedidoSeleccionado) return;

        const idReal = pedidoSeleccionado.idPedido || pedidoSeleccionado.id_pedido || pedidoSeleccionado.id;

        if (!idReal || isNaN(Number(idReal))) {
            alert(`⚠️ ID numérico inválido (${idReal}). Selecciona nuevamente el pedido.`);
            return;
        }

        try {
            await actualizarEstadoPedido(idReal, nuevoEstado);
            setPedidoSeleccionado(prev => ({ ...prev, estado: nuevoEstado }));
            await obtenerPedidos();
        } catch (err) {
            console.error('Error al cambiar estado:', err);
            alert('⚠️ No se pudo guardar el estado: ' + err.message);
        }
    };

    const handleEntregarYBorrar = async (e) => {
        e.preventDefault();
        if (!codigoPedidoBorrar) return;

        const entradaLimpia = codigoPedidoBorrar.trim().toUpperCase();

        const pedidoEncontrado = pedidos.find(p => {
            const cod = (p.codigo || '').toUpperCase();
            const idPed = (p.idPedido || p.id_pedido || p.id || '').toString();
            return cod === entradaLimpia || cod === `BC-${entradaLimpia}` || `BC-${cod}` === entradaLimpia || idPed === entradaLimpia;
        });

        if (!pedidoEncontrado) {
            alert('⚠️ No se encontró ningún pedido activo con ese código.');
            return;
        }

        const idReal = (pedidoEncontrado.idPedido || pedidoEncontrado.id_pedido || pedidoEncontrado.id || '').toString();
        const codigoReal = (pedidoEncontrado.codigo || '').toUpperCase();

        try {
            await actualizarEstadoPedido(idReal, 'ENTREGADO');

            setPedidosEliminados(prev => [...prev, idReal, codigoReal, entradaLimpia]);

            const nuevaLista = pedidos.filter(p => {
                const idP = (p.idPedido || p.id_pedido || p.id || '').toString();
                const codP = (p.codigo || '').toUpperCase();
                return idP !== idReal && codP !== codigoReal && codP !== entradaLimpia;
            });

            setPedidos(nuevaLista);

            if (pedidoSeleccionado && ((pedidoSeleccionado.idPedido || pedidoSeleccionado.id_pedido || pedidoSeleccionado.id || '').toString() === idReal)) {
                setPedidoSeleccionado(nuevaLista.length > 0 ? nuevaLista[0] : null);
            }

            await obtenerMetricasVentas();

            alert(`✅ Pedido ${entradaLimpia} entregado con éxito y registrado en las ventas.`);
            setCodigoPedidoBorrar('');
        } catch (err) {
            alert('⚠️ Error al actualizar el pedido: ' + err.message);
        }
    };

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleEditarProducto = (prod) => {
        const id = prod.idProducto || prod.id_producto || prod.id;
        setProductoEditandoId(id);
        setFormData({
            nombre: prod.nombre || '',
            categoria: prod.categoria || 'Whisky',
            precio: prod.precio || '',
            stock: prod.stock || '',
            imagen: prod.imagen || prod.urlImagen || prod.icono || '',
            descripcion: prod.descripcion || ''
        });
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    };

    const handleCancelarEditar = () => {
        setProductoEditandoId(null);
        setFormData({ nombre: '', categoria: 'Whisky', precio: '', stock: '', imagen: '', descripcion: '' });
    };

    const handleGuardarProducto = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                ...(productoEditandoId && { idProducto: productoEditandoId })
            };

            await guardarProducto(payload);

            alert(productoEditandoId ? 'Producto actualizado en SQL Server' : 'Producto registrado en SQL Server');
            handleCancelarEditar();
            obtenerProductos();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleEliminarProducto = async (id) => {
        if (!window.confirm(`¿Estás seguro de eliminar el producto #${id}?`)) return;

        try {
            await eliminarProducto(id);
            alert('Producto eliminado de SQL Server');
            obtenerProductos();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleBuscarPorId = async (e) => {
        e.preventDefault();
        if (!idBusqueda) return;
        try {
            const data = await getProductoPorId(idBusqueda);
            setProductoBuscado(data);
        } catch (err) {
            alert(err.message);
            setProductoBuscado(null);
        }
    };

    const handleCerrarSesion = () => {
        localStorage.removeItem('usuario_admin');
        navigate('/login');
    };

    const itemsPedido = pedidoSeleccionado?.productos || pedidoSeleccionado?.detalles || pedidoSeleccionado?.items || [];

    // Cálculos de paginación de 10 en 10
    const totalPaginas = Math.max(1, Math.ceil(productos.length / productosPorPagina));
    const paginaSegura = Math.min(paginaActual, totalPaginas);
    const indiceInicio = (paginaSegura - 1) * productosPorPagina;
    const productosPaginados = productos.slice(indiceInicio, indiceInicio + productosPorPagina);

    return (
        <div style={{ padding: 'clamp(1rem, 4vw, 2rem)', backgroundColor: '#0D0B0A', minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif', maxWidth: '850px', margin: '0 auto', boxSizing: 'border-box', overflowX: 'hidden' }}>

            {/* ENCABEZADO */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
                <div style={{ flex: '1 1 220px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#C5A059', letterSpacing: '0.1em', fontWeight: 'bold' }}>🟢 PANEL DE EMPLEADO</span>
                    <h1 style={{ fontFamily: 'serif', color: '#F3ECE0', margin: '0.25rem 0 0.5rem 0', fontSize: 'clamp(1.6rem, 5vw, 2.2rem)', lineHeight: 1.2 }}>Gestión de Inventario y Pedidos</h1>
                    <p style={{ margin: 0, color: '#aaa', fontSize: '0.85rem' }}>Usuario activo: <span style={{ color: '#F3ECE0' }}>{usuarioSesion.nombre || 'Administrador Élite'}</span></p>
                </div>
                <button onClick={handleCerrarSesion} style={{ padding: '0.55rem 1rem', backgroundColor: 'transparent', color: '#aaa', border: '1px solid #382E26', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    Cerrar Sesión
                </button>
            </div>

            {/* TARJETAS DE MÉTRICAS / FINANZAS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', marginBottom: '1.75rem' }}>
                <div style={{ backgroundColor: '#16120E', padding: '1.1rem', borderRadius: '12px', border: '1px solid #26201B' }}>
                    <span style={{ fontSize: '0.72rem', color: '#888', display: 'block', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>💰 TOTAL VENDIDO</span>
                    <strong style={{ fontSize: '1.65rem', color: '#4ade80', fontFamily: 'serif' }}>
                        ${Number(reporteVentas.totalVendido).toFixed(2)}
                    </strong>
                </div>

                <div style={{ backgroundColor: '#16120E', padding: '1.1rem', borderRadius: '12px', border: '1px solid #26201B' }}>
                    <span style={{ fontSize: '0.72rem', color: '#888', display: 'block', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>📦 PEDIDOS ENTREGADOS</span>
                    <strong style={{ fontSize: '1.65rem', color: '#C5A059', fontFamily: 'serif' }}>
                        {reporteVentas.totalPedidos}
                    </strong>
                </div>

                <div style={{ backgroundColor: '#16120E', padding: '1.1rem', borderRadius: '12px', border: '1px solid #26201B' }}>
                    <span style={{ fontSize: '0.72rem', color: '#888', display: 'block', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>📊 TICKET PROMEDIO</span>
                    <strong style={{ fontSize: '1.65rem', color: '#60a5fa', fontFamily: 'serif' }}>
                        ${Number(reporteVentas.ticketPromedio).toFixed(2)}
                    </strong>
                </div>
            </div>

            {/* DASHBOARD DE PEDIDOS ACUMULADOS */}
            <div style={{ backgroundColor: '#16120E', padding: '1.25rem', borderRadius: '16px', border: '1px solid #26201B', marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#C5A059', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                        📜 DASHBOARD DE PEDIDOS ACUMULADOS ({pedidos.length})
                    </span>
                    <button onClick={obtenerPedidos} style={{ background: 'none', border: 'none', color: '#C5A059', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', padding: 0 }}>
                        🔄 Recargar Pedidos
                    </button>
                </div>

                {cargandoPedidos && pedidos.length === 0 ? (
                    <p style={{ color: '#aaa', textAlign: 'center', margin: '1rem 0' }}>Cargando pedidos de SQL Server...</p>
                ) : errorPedidos && pedidos.length === 0 ? (
                    <p style={{ color: '#fda4af', textAlign: 'center', margin: '1rem 0' }}>{errorPedidos}</p>
                ) : pedidos.length === 0 ? (
                    <p style={{ color: '#aaa', textAlign: 'center', margin: '1rem 0' }}>No hay pedidos registrados por el momento.</p>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                        {pedidos.map((ped) => {
                            const idCodigo = ped.codigo || `#BC-${ped.idPedido || ped.id}`;
                            const idNum = ped.idPedido || ped.id_pedido || ped.id;
                            const esSeleccionado = pedidoSeleccionado && (
                                (pedidoSeleccionado.idPedido && pedidoSeleccionado.idPedido === idNum) ||
                                (pedidoSeleccionado.codigo && pedidoSeleccionado.codigo === ped.codigo)
                            );

                            return (
                                <div
                                    key={idNum || ped.codigo || Math.random()}
                                    onClick={() => handleSeleccionarPedido(ped)}
                                    style={{
                                        backgroundColor: '#0D0B0A',
                                        padding: '1rem',
                                        borderRadius: '12px',
                                        border: esSeleccionado ? '1px solid #C5A059' : '1px solid #26201B',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{ minWidth: 0 }}>
                                        <strong style={{ color: '#C5A059', display: 'block', marginBottom: '0.25rem', wordBreak: 'break-word' }}>{idCodigo}</strong>
                                        <span style={{ fontSize: '0.75rem', color: '#888', display: 'block' }}>Cliente: {ped.cliente || ped.nombreCliente || `Usuario #${ped.usuarioId || ''}`}</span>
                                        <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold' }}>Total: ${ped.total}</span>
                                    </div>
                                    <span style={{
                                        backgroundColor: ['LISTO', 'ENTREGADO'].includes((ped.estado || '').toUpperCase()) ? 'rgba(34, 197, 94, 0.15)' : ['EN PREPARACION', 'EN_PREPARACION'].includes((ped.estado || '').toUpperCase()) ? 'rgba(197, 160, 89, 0.15)' : 'rgba(37, 99, 235, 0.15)',
                                        color: ['LISTO', 'ENTREGADO'].includes((ped.estado || '').toUpperCase()) ? '#4ade80' : ['EN PREPARACION', 'EN_PREPARACION'].includes((ped.estado || '').toUpperCase()) ? '#C5A059' : '#60a5fa',
                                        padding: '0.3rem 0.65rem',
                                        borderRadius: '12px',
                                        fontSize: '0.68rem',
                                        fontWeight: 'bold',
                                        textTransform: 'uppercase',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {ped.estado || 'PENDIENTE'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* VERIFICAR / ENTREGAR PEDIDO POR CÓDIGO */}
            <div style={{ backgroundColor: '#16120E', padding: '1.25rem', borderRadius: '16px', border: '1px solid #26201B', marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#C5A059', fontWeight: 'bold', letterSpacing: '0.05em' }}>VERIFICAR / ENTREGAR PEDIDO POR CÓDIGO</span>
                    <span style={{ fontSize: '0.72rem', color: '#666' }}>Búsqueda rápida</span>
                </div>
                <form onSubmit={handleEntregarYBorrar} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <input
                        type="text"
                        placeholder="CÓDIGO DEL PEDIDO (EJ: BC-X9123)"
                        value={codigoPedidoBorrar}
                        onChange={(e) => setCodigoPedidoBorrar(e.target.value)}
                        style={{ flex: '1 1 200px', minWidth: 0, width: '100%', boxSizing: 'border-box', padding: '0.8rem', borderRadius: '8px', border: '1px solid #26201B', backgroundColor: '#0D0B0A', color: '#fff', outline: 'none' }}
                    />
                    <button type="submit" style={{ flex: '1 1 150px', padding: '0.8rem 1.25rem', backgroundColor: '#C5A059', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Entregar y Borrar
                    </button>
                </form>
            </div>

            {/* DETALLE DEL PEDIDO SELECCIONADO */}
            {pedidoSeleccionado && (
                <div style={{ backgroundColor: '#16120E', padding: '1.25rem', borderRadius: '16px', border: '1px solid #26201B', marginBottom: '1.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.72rem', color: '#888', letterSpacing: '0.05em' }}>ATENDIENDO PEDIDO</span>
                        <span style={{ backgroundColor: 'rgba(197, 160, 89, 0.2)', color: '#C5A059', padding: '0.25rem 0.7rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                            {pedidoSeleccionado.estado || 'PENDIENTE'}
                        </span>
                    </div>

                    <h2 style={{ fontFamily: 'serif', color: '#C5A059', margin: '0 0 1.25rem 0', fontSize: 'clamp(1.5rem, 5vw, 2rem)', wordBreak: 'break-word' }}>
                        {pedidoSeleccionado.codigo || `#BC-${pedidoSeleccionado.idPedido || pedidoSeleccionado.id}`}
                    </h2>

                    <div style={{ backgroundColor: '#0D0B0A', padding: '0.9rem', borderRadius: '8px', border: '1px solid #26201B', marginBottom: '1.25rem', fontSize: '0.82rem' }}>
                        <p style={{ margin: '0 0 0.4rem 0' }}><strong>Cliente / Usuario:</strong> {pedidoSeleccionado.cliente || pedidoSeleccionado.nombreCliente || pedidoSeleccionado.usuarioId || 'General'}</p>
                        <p style={{ margin: '0 0 0.4rem 0' }}><strong>Método de Pago:</strong> {pedidoSeleccionado.metodoPago || 'Pagar al recoger'}</p>
                        <p style={{ margin: 0 }}><strong>Fecha:</strong> {pedidoSeleccionado.fechaPedido ? new Date(pedidoSeleccionado.fechaPedido).toLocaleString() : 'Fecha no registrada'}</p>
                    </div>

                    {/* PRODUCTOS SOLICITADOS */}
                    <div style={{ backgroundColor: '#0D0B0A', padding: '0.9rem', borderRadius: '8px', border: '1px solid #26201B', marginBottom: '1.25rem' }}>
                        <span style={{ fontSize: '0.72rem', color: '#C5A059', fontWeight: 'bold', display: 'block', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
                            🛒 PRODUCTOS SOLICITADOS ({itemsPedido.length})
                        </span>
                        {itemsPedido.length === 0 ? (
                            <p style={{ color: '#aaa', margin: 0, fontSize: '0.82rem' }}>No hay detalles cargados para este pedido.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {itemsPedido.map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.82rem', paddingBottom: '0.4rem', borderBottom: idx < itemsPedido.length - 1 ? '1px solid #1c1815' : 'none' }}>
                                        <span style={{ flex: 1 }}>{item.cantidad}x {item.nombreProducto || item.nombre || `Producto #${item.productoId}`}</span>
                                        <span style={{ color: '#C5A059', whiteSpace: 'nowrap', fontWeight: 'bold' }}>${(item.cantidad * item.precioUnitario).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
                        <button onClick={() => handleCambiarEstadoPedido('EN PREPARACION')} style={{ flex: '1 1 140px', padding: '0.75rem', backgroundColor: '#26201B', color: '#F3ECE0', border: '1px solid #382E26', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.82rem' }}>
                            👨‍🍳 En Preparación
                        </button>
                        <button onClick={() => handleCambiarEstadoPedido('LISTO')} style={{ flex: '1 1 140px', padding: '0.75rem', backgroundColor: '#C5A059', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.82rem' }}>
                            ✅ Marcar Listo
                        </button>
                    </div>
                </div>
            )}

            {/* SECCIÓN DE INVENTARIO GENERAL PAGINADO DE 10 EN 10 */}
<<<<<<< HEAD
            <div style={{ backgroundColor: '#16120E', padding: '1.25rem', borderRadius: '16px', border: '1px solid #26201B', marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#C5A059', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                        📦 INVENTARIO GENERAL ({productos.length})
                    </span>
                    {productos.length > 0 && (
                        <span style={{ fontSize: '0.72rem', color: '#888' }}>
=======
            <div style={{ backgroundColor: '#16120E', padding: '1.5rem', borderRadius: '16px', border: '1px solid #26201B', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#C5A059', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                        📦 INVENTARIO GENERAL ({productos.length})
                    </span>
                    {productos.length > 0 && (
                        <span style={{ fontSize: '0.75rem', color: '#888' }}>
>>>>>>> f7802eda5a35f46eb9c721dd1a7879f921367f21
                            Mostrando {indiceInicio + 1}–{Math.min(indiceInicio + productosPorPagina, productos.length)} de {productos.length} | Página {paginaSegura} de {totalPaginas}
                        </span>
                    )}
                </div>

                {cargandoProductos ? (
                    <p style={{ color: '#aaa', textAlign: 'center' }}>Cargando inventario...</p>
                ) : (
                    <>
<<<<<<< HEAD
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.85rem' }}>
                            {productosPaginados.map(p => (
                                <div key={p.idProducto || p.id_producto || p.id} style={{ backgroundColor: '#0D0B0A', padding: '0.85rem', borderRadius: '8px', border: '1px solid #26201B', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div>
                                        <strong style={{ fontSize: '0.9rem', color: '#F3ECE0', display: 'block', marginBottom: '0.2rem' }}>{p.nombre}</strong>
=======
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                            {productosPaginados.map(p => (
                                <div key={p.idProducto || p.id_producto || p.id} style={{ backgroundColor: '#0D0B0A', padding: '0.8rem', borderRadius: '8px', border: '1px solid #26201B', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div>
                                        <strong style={{ fontSize: '0.9rem', color: '#F3ECE0', display: 'block' }}>{p.nombre}</strong>
>>>>>>> f7802eda5a35f46eb9c721dd1a7879f921367f21
                                        <span style={{ fontSize: '0.75rem', color: '#888', display: 'block', marginBottom: '0.4rem' }}>{p.categoria} | Stock: {p.stock}</span>
                                        <span style={{ fontSize: '0.85rem', color: '#C5A059', fontWeight: 'bold', display: 'block', marginBottom: '0.6rem' }}>${p.precio}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
<<<<<<< HEAD
                                        <button onClick={() => handleEditarProducto(p)} style={{ flex: 1, padding: '0.4rem', backgroundColor: '#26201B', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>Editar</button>
                                        <button onClick={() => handleEliminarProducto(p.idProducto || p.id_producto || p.id)} style={{ padding: '0.4rem 0.65rem', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>X</button>
=======
                                        <button onClick={() => handleEditarProducto(p)} style={{ flex: 1, padding: '0.3rem', backgroundColor: '#26201B', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}>Editar</button>
                                        <button onClick={() => handleEliminarProducto(p.idProducto || p.id_producto || p.id)} style={{ padding: '0.3rem 0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: 'none', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}>X</button>
>>>>>>> f7802eda5a35f46eb9c721dd1a7879f921367f21
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* CONTROLES DE PAGINACIÓN */}
                        {totalPaginas > 1 && (
<<<<<<< HEAD
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #26201B' }}>
=======
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #26201B' }}>
>>>>>>> f7802eda5a35f46eb9c721dd1a7879f921367f21
                                <button
                                    type="button"
                                    onClick={() => setPaginaActual(prev => Math.max(1, prev - 1))}
                                    disabled={paginaSegura === 1}
                                    style={{
<<<<<<< HEAD
                                        padding: '0.5rem 0.85rem',
=======
                                        padding: '0.5rem 1rem',
>>>>>>> f7802eda5a35f46eb9c721dd1a7879f921367f21
                                        backgroundColor: paginaSegura === 1 ? '#120F0C' : '#26201B',
                                        color: paginaSegura === 1 ? '#555' : '#F3ECE0',
                                        border: '1px solid #382E26',
                                        borderRadius: '8px',
                                        cursor: paginaSegura === 1 ? 'not-allowed' : 'pointer',
<<<<<<< HEAD
                                        fontSize: '0.78rem',
=======
                                        fontSize: '0.8rem',
>>>>>>> f7802eda5a35f46eb9c721dd1a7879f921367f21
                                        fontWeight: 'bold'
                                    }}
                                >
                                    ← Anterior
                                </button>

<<<<<<< HEAD
                                <span style={{ fontSize: '0.78rem', color: '#C5A059', fontWeight: 'bold', textAlign: 'center' }}>
=======
                                <span style={{ fontSize: '0.8rem', color: '#C5A059', fontWeight: 'bold' }}>
>>>>>>> f7802eda5a35f46eb9c721dd1a7879f921367f21
                                    Página {paginaSegura} / {totalPaginas}
                                </span>

                                <button
                                    type="button"
                                    onClick={() => setPaginaActual(prev => Math.min(totalPaginas, prev + 1))}
                                    disabled={paginaSegura === totalPaginas}
                                    style={{
<<<<<<< HEAD
                                        padding: '0.5rem 0.85rem',
=======
                                        padding: '0.5rem 1rem',
>>>>>>> f7802eda5a35f46eb9c721dd1a7879f921367f21
                                        backgroundColor: paginaSegura === totalPaginas ? '#120F0C' : '#C5A059',
                                        color: paginaSegura === totalPaginas ? '#555' : '#000',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: paginaSegura === totalPaginas ? 'not-allowed' : 'pointer',
<<<<<<< HEAD
                                        fontSize: '0.78rem',
=======
                                        fontSize: '0.8rem',
>>>>>>> f7802eda5a35f46eb9c721dd1a7879f921367f21
                                        fontWeight: 'bold'
                                    }}
                                >
                                    Siguiente →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* FORMULARIO DE REGISTRO / EDICIÓN */}
            <div style={{ backgroundColor: '#16120E', padding: '1.25rem', borderRadius: '16px', border: '1px solid #26201B' }}>
                <span style={{ fontSize: '0.78rem', color: '#C5A059', fontWeight: 'bold', letterSpacing: '0.05em', display: 'block', marginBottom: '1rem' }}>
                    {productoEditandoId ? `✏️ EDITANDO PRODUCTO #${productoEditandoId}` : '➕ REGISTRAR NUEVO PRODUCTO'}
                </span>
                <form onSubmit={handleGuardarProducto} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                    <input type="text" name="nombre" placeholder="Nombre" value={formData.nombre} onChange={handleInputChange} required style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem', backgroundColor: '#0D0B0A', border: '1px solid #26201B', borderRadius: '6px', color: '#fff' }} />
                    <select name="categoria" value={formData.categoria} onChange={handleInputChange} style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem', backgroundColor: '#0D0B0A', border: '1px solid #26201B', borderRadius: '6px', color: '#fff' }}>
                        <option value="Whisky">Whisky</option>
                        <option value="Bourbon">Bourbon</option>
                        <option value="Vino Tinto">Vino Tinto</option>
                        <option value="Vino Blanco">Vino Blanco</option>
                        <option value="Tequila">Tequila</option>
                        <option value="Ron">Ron</option>
                    </select>
                    <input type="number" step="0.01" name="precio" placeholder="Precio" value={formData.precio} onChange={handleInputChange} required style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem', backgroundColor: '#0D0B0A', border: '1px solid #26201B', borderRadius: '6px', color: '#fff' }} />
                    <input type="number" name="stock" placeholder="Stock" value={formData.stock} onChange={handleInputChange} required style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem', backgroundColor: '#0D0B0A', border: '1px solid #26201B', borderRadius: '6px', color: '#fff' }} />
                    <input type="text" name="imagen" placeholder="URL Imagen" value={formData.imagen} onChange={handleInputChange} style={{ gridColumn: '1 / -1', width: '100%', boxSizing: 'border-box', padding: '0.75rem', backgroundColor: '#0D0B0A', border: '1px solid #26201B', borderRadius: '6px', color: '#fff' }} />
                    <textarea name="descripcion" placeholder="Descripción" value={formData.descripcion} onChange={handleInputChange} style={{ gridColumn: '1 / -1', width: '100%', boxSizing: 'border-box', padding: '0.75rem', backgroundColor: '#0D0B0A', border: '1px solid #26201B', borderRadius: '6px', color: '#fff', minHeight: '65px' }} />
                    <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <button type="submit" style={{ flex: '1 1 160px', padding: '0.85rem', backgroundColor: '#C5A059', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                            {productoEditandoId ? 'Guardar Cambios' : 'Registrar Producto'}
                        </button>
                        {productoEditandoId && (
                            <button type="button" onClick={handleCancelarEditar} style={{ flex: '1 1 100px', padding: '0.85rem', backgroundColor: '#26201B', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                                Cancelar
                            </button>
                        )}
                    </div>
                </form>
            </div>

        </div>
    );
}