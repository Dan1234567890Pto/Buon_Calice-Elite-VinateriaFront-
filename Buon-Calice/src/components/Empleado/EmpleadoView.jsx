import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function PerfilClienteView() {
    const navigate = useNavigate();
    const API_AUTH = 'https://buon-calice-fhfefadvd2bygphx.westcentralus-01.azurewebsites.net/api/auth';

    const [esRegistro, setEsRegistro] = useState(false);
    const [cargando, setCargando] = useState(false);

    // Estados para verificación de correo (OTP de 6 dígitos)
    const [pasoVerificacion, setPasoVerificacion] = useState(false);
    const [correoPendiente, setCorreoPendiente] = useState('');
    const [codigoOtp, setCodigoOtp] = useState('');
    const [reenviando, setReenviando] = useState(false);

    // Obtener sesión previa si existe
    const [cliente, setCliente] = useState(() => {
        const guardado = localStorage.getItem('cliente_buoncalice') || localStorage.getItem('usuario_cliente');
        return guardado ? JSON.parse(guardado) : null;
    });

    const [formData, setFormData] = useState({
        nombre: '',
        correo: '',
        password: '',
        telefono: ''
    });

    const guardarSesionCliente = (data) => {
        const rawUsuario = data.usuario || data;
        const usuarioObj = {
            ...rawUsuario,
            rol: (rawUsuario.rol || 'cliente').toLowerCase()
        };

        localStorage.setItem('cliente_buoncalice', JSON.stringify(usuarioObj));
        localStorage.setItem('usuario_cliente', JSON.stringify(usuarioObj));
        setCliente(usuarioObj);
        navigate('/');
    };

    // Control del campo Nombre: Elimina números en tiempo real
    const handleNombreChange = (e) => {
        const valorLimpio = e.target.value.replace(/[0-9]/g, '');
        setFormData(prev => ({ ...prev, nombre: valorLimpio }));
    };

    // Control del campo Teléfono: Acepta solo números y limita a 10 dígitos
    const handleTelefonoChange = (e) => {
        const soloNumeros = e.target.value.replace(/\D/g, '');
        if (soloNumeros.length <= 10) {
            setFormData(prev => ({ ...prev, telefono: soloNumeros }));
        }
    };

    // Control del código OTP: Solo números, máximo 6 dígitos
    const handleCodigoChange = (e) => {
        const soloNumeros = e.target.value.replace(/\D/g, '').slice(0, 6);
        setCodigoOtp(soloNumeros);
    };

    const handleInputChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    // Envío de Login
    const handleLogin = async (e) => {
        e.preventDefault();
        if (!formData.correo.trim() || !formData.password.trim()) {
            alert('⚠️ Ingrese su correo y contraseña.');
            return;
        }

        setCargando(true);
        try {
            const res = await fetch(`${API_AUTH}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    correo: formData.correo.trim(),
                    password: formData.password
                })
            });

            const data = await res.json();

            // Si la cuenta existe pero aún no verifica su correo
            if (res.status === 401 && data.requiereVerificacion) {
                setCorreoPendiente(data.correo || formData.correo.trim());
                setCodigoOtp('');
                setPasoVerificacion(true);
                alert(`📩 ${data.mensaje}`);
                return;
            }

            if (!res.ok) throw new Error(data.mensaje || 'Credenciales incorrectas');

            guardarSesionCliente(data);
        } catch (err) {
            alert(`⚠️ ${err.message}`);
        } finally {
            setCargando(false);
        }
    };

    // Envío de Registro con Validaciones Estrictas + Verificación por Correo
    const handleRegistro = async (e) => {
        e.preventDefault();

        if (!formData.nombre.trim() || !formData.correo.trim() || !formData.password.trim() || !formData.telefono.trim()) {
            alert('⚠️ Todos los campos son obligatorios.');
            return;
        }

        if (formData.telefono.length !== 10) {
            alert('⚠️ El número de teléfono debe tener exactamente 10 dígitos.');
            return;
        }

        const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regexEmail.test(formData.correo)) {
            alert('⚠️ Ingrese un correo electrónico válido.');
            return;
        }

        setCargando(true);
        try {
            const correoLimpio = formData.correo.trim();
            const res = await fetch(`${API_AUTH}/registrar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: formData.nombre.trim(),
                    correo: correoLimpio,
                    password: formData.password,
                    telefono: formData.telefono.trim(),
                    rol: 'cliente'
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.mensaje || data.error || 'Error al registrar usuario.');

            if (data.requiereVerificacion) {
                setCorreoPendiente(data.correo || correoLimpio);
                setCodigoOtp('');
                setPasoVerificacion(true);
                alert(`📩 ${data.mensaje}`);
            } else {
                alert('🎉 Cuenta creada con éxito. Ahora puedes iniciar sesión.');
                setEsRegistro(false);
            }
        } catch (err) {
            alert(`⚠️ ${err.message}`);
        } finally {
            setCargando(false);
        }
    };

    // Validar el código de 6 dígitos recibido en el correo
    const handleVerificarCodigo = async (e) => {
        e.preventDefault();
        if (codigoOtp.length !== 6) {
            alert('⚠️ Ingresa el código completo de 6 dígitos.');
            return;
        }

        setCargando(true);
        try {
            const res = await fetch(`${API_AUTH}/verificar-correo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    correo: correoPendiente,
                    codigo: codigoOtp
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.mensaje || data.error || 'Código incorrecto.');

            alert('✅ ¡Correo verificado con éxito! Bienvenido a Buon Calice.');
            setPasoVerificacion(false);
            guardarSesionCliente(data);
        } catch (err) {
            alert(`⚠️ ${err.message}`);
        } finally {
            setCargando(false);
        }
    };

    // Reenviar código OTP al correo
    const handleReenviarCodigo = async () => {
        if (!correoPendiente || reenviando) return;

        setReenviando(true);
        try {
            const res = await fetch(`${API_AUTH}/reenviar-codigo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ correo: correoPendiente })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.mensaje || 'No se pudo reenviar el código.');

            alert(`📨 ${data.mensaje}`);
        } catch (err) {
            alert(`⚠️ ${err.message}`);
        } finally {
            setReenviando(false);
        }
    };

    const handleCerrarSesion = () => {
        localStorage.removeItem('cliente_buoncalice');
        localStorage.removeItem('usuario_cliente');
        setCliente(null);
    };

    const inputStyle = {
        width: '100%',
        boxSizing: 'border-box',
        padding: '0.75rem',
        borderRadius: '8px',
        border: '1px solid #26201B',
        backgroundColor: '#0D0B0A',
        color: '#fff',
        outline: 'none'
    };

    // VISTA DE PERFIL ACTIVO
    if (cliente) {
        return (
            <div style={{ padding: 'clamp(1rem, 4vw, 2rem)', backgroundColor: '#0D0B0A', minHeight: '100vh', color: '#fff', maxWidth: '500px', margin: '0 auto', boxSizing: 'border-box' }}>
                <div style={{ backgroundColor: '#16120E', padding: '2rem', borderRadius: '16px', border: '1px solid #26201B', textAlign: 'center' }}>
                    <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>👤</span>
                    <h2 style={{ color: '#C5A059', fontFamily: 'serif', margin: '0 0 0.5rem 0' }}>{cliente.nombre || 'Cliente Buon Calice'}</h2>
                    <p style={{ color: '#aaa', fontSize: '0.9rem', margin: '0 0 0.5rem 0', wordBreak: 'break-word' }}>{cliente.correo}</p>
                    {cliente.telefono && <p style={{ color: '#aaa', fontSize: '0.85rem', margin: '0 0 1.5rem 0' }}>📞 {cliente.telefono}</p>}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <button onClick={() => navigate('/')} style={{ padding: '0.8rem', backgroundColor: '#C5A059', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                            Ver Catálogo
                        </button>
                        <button onClick={handleCerrarSesion} style={{ padding: '0.8rem', backgroundColor: 'transparent', color: '#dc2626', border: '1px solid #dc2626', borderRadius: '8px', cursor: 'pointer' }}>
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // VISTA DE VERIFICACIÓN DE CORREO (CÓDIGO DE 6 DÍGITOS)
    if (pasoVerificacion) {
        return (
            <div style={{ padding: 'clamp(1rem, 4vw, 2rem)', backgroundColor: '#0D0B0A', minHeight: '100vh', color: '#fff', maxWidth: '450px', margin: '0 auto', boxSizing: 'border-box' }}>
                <div style={{ backgroundColor: '#16120E', padding: '2rem', borderRadius: '16px', border: '1px solid #C5A059', textAlign: 'center' }}>
                    <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>✉️</span>
                    <h2 style={{ color: '#C5A059', fontFamily: 'serif', margin: '0 0 0.5rem 0' }}>
                        Verifica tu Correo
                    </h2>
                    <p style={{ color: '#aaa', fontSize: '0.85rem', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
                        Enviamos un código de 6 dígitos de parte de <strong style={{ color: '#F3ECE0' }}>Buon Calice</strong> a:<br />
                        <span style={{ color: '#C5A059', fontWeight: 'bold', wordBreak: 'break-word' }}>{correoPendiente}</span>
                    </p>

                    <form onSubmit={handleVerificarCodigo} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={codigoOtp}
                            onChange={handleCodigoChange}
                            placeholder="000000"
                            required
                            style={{
                                ...inputStyle,
                                textAlign: 'center',
                                fontSize: '1.8rem',
                                fontFamily: 'monospace',
                                letterSpacing: '0.5rem',
                                fontWeight: 'bold',
                                color: '#D4AF37',
                                border: '1px solid #C5A059'
                            }}
                        />

                        <button
                            type="submit"
                            disabled={cargando || codigoOtp.length !== 6}
                            style={{
                                padding: '0.85rem',
                                backgroundColor: codigoOtp.length === 6 ? '#C5A059' : '#382E26',
                                color: codigoOtp.length === 6 ? '#000' : '#888',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                cursor: codigoOtp.length === 6 ? 'pointer' : 'not-allowed'
                            }}
                        >
                            {cargando ? 'Verificando...' : 'Confirmar Código'}
                        </button>
                    </form>

                    <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
                        <button
                            type="button"
                            onClick={handleReenviarCodigo}
                            disabled={reenviando}
                            style={{ background: 'none', border: 'none', color: '#C5A059', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            {reenviando ? 'Enviando nuevo código...' : '¿No te llegó? Reenviar código'}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setPasoVerificacion(false);
                                setCodigoOtp('');
                            }}
                            style={{ background: 'none', border: 'none', color: '#888', fontSize: '0.8rem', cursor: 'pointer' }}
                        >
                            ← Cambiar correo o volver
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // VISTA DE LOGIN / REGISTRO
    return (
        <div style={{ padding: 'clamp(1rem, 4vw, 2rem)', backgroundColor: '#0D0B0A', minHeight: '100vh', color: '#fff', maxWidth: '450px', margin: '0 auto', boxSizing: 'border-box' }}>
            <div style={{ backgroundColor: '#16120E', padding: '2rem', borderRadius: '16px', border: '1px solid #26201B' }}>
                <h2 style={{ color: '#C5A059', fontFamily: 'serif', textAlign: 'center', marginTop: 0 }}>
                    {esRegistro ? 'Crear Cuenta' : 'Iniciar Sesión'}
                </h2>

                <form onSubmit={esRegistro ? handleRegistro : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {esRegistro && (
                        <>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '0.4rem' }}>NOMBRE COMPLETO</label>
                                <input
                                    type="text"
                                    name="nombre"
                                    value={formData.nombre}
                                    onChange={handleNombreChange}
                                    required
                                    placeholder="Solo letras"
                                    style={inputStyle}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '0.4rem' }}>TELÉFONO (10 DÍGITOS)</label>
                                <input
                                    type="tel"
                                    name="telefono"
                                    value={formData.telefono}
                                    onChange={handleTelefonoChange}
                                    required
                                    maxLength={10}
                                    placeholder="10 dígitos numéricos"
                                    style={inputStyle}
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '0.4rem' }}>CORREO ELECTRÓNICO</label>
                        <input
                            type="email"
                            name="correo"
                            value={formData.correo}
                            onChange={handleInputChange}
                            required
                            placeholder="ejemplo@correo.com"
                            style={inputStyle}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '0.4rem' }}>CONTRASEÑA</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleInputChange}
                            required
                            placeholder="••••••••"
                            style={inputStyle}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={cargando}
                        style={{ padding: '0.85rem', backgroundColor: '#C5A059', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '0.5rem' }}
                    >
                        {cargando ? 'Procesando...' : (esRegistro ? 'Registrarse' : 'Ingresar')}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                    <button
                        onClick={() => {
                            setEsRegistro(!esRegistro);
                            setFormData({ nombre: '', correo: '', password: '', telefono: '' });
                        }}
                        style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                        {esRegistro ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate aquí'}
                    </button>
                </div>
            </div>
        </div>
    );
}