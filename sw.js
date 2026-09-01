// ============================================
// CONFIGURACIÓN — misma URL de Apps Script que usa la app de choferes
// ============================================
const API_URL = 'PEGAR_AQUI_LA_URL_DE_TU_APPS_SCRIPT_WEB_APP';
const INTERVALO_ACTUALIZACION_MS = 90 * 1000; // 90 segundos

// Coordenadas del depósito (Maestro Santana 2561, Béccar) como centro inicial del mapa
const CENTRO_INICIAL = [-34.4740, -58.5390];

const pantallaLogin = document.getElementById('pantalla-login');
const pantallaPanel = document.getElementById('pantalla-panel');
const formLogin = document.getElementById('form-login');
const errorLogin = document.getElementById('error-login');
const filtroChofer = document.getElementById('filtro-chofer');
const ultimaActualizacion = document.getElementById('ultima-actualizacion');
const cantPendientes = document.getElementById('cant-pendientes');
const cantEntregados = document.getElementById('cant-entregados');
const cantCancelados = document.getElementById('cant-cancelados');

let mapa = null;
let marcadores = [];
let credenciales = null;
let intervaloId = null;

// ---------- API ----------
async function llamarAPI(accion, datos = {}) {
  try {
    const respuesta = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ accion, ...datos })
    });
    return await respuesta.json();
  } catch (err) {
    return { ok: false, error: 'No se pudo conectar con el servidor' };
  }
}

// ---------- Sesión (dura mientras esté abierta la pestaña) ----------
function guardarSesion(usuario, password) {
  sessionStorage.setItem('admin_usuario', usuario);
  sessionStorage.setItem('admin_password', password);
}
function obtenerSesion() {
  return {
    usuario: sessionStorage.getItem('admin_usuario'),
    password: sessionStorage.getItem('admin_password')
  };
}
function cerrarSesion() {
  sessionStorage.removeItem('admin_usuario');
  sessionStorage.removeItem('admin_password');
  if (intervaloId) clearInterval(intervaloId);
  pantallaPanel.classList.add('oculto');
  pantallaLogin.classList.remove('oculto');
}

// ---------- Login ----------
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorLogin.textContent = '';
  const usuario = document.getElementById('input-usuario').value.trim();
  const password = document.getElementById('input-password').value;

  const resultado = await llamarAPI('loginAdmin', { usuario, password });
  if (resultado.ok) {
    guardarSesion(usuario, password);
    iniciarPanel();
  } else {
    errorLogin.textContent = resultado.error || 'Error al ingresar';
  }
});

document.getElementById('btn-salir').addEventListener('click', cerrarSesion);

// ---------- Mapa ----------
function inicializarMapa() {
  if (mapa) return;
  mapa = L.map('mapa').setView(CENTRO_INICIAL, 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19
  }).addTo(mapa);
}

function iconoPara(estado) {
  let color = '#e63946'; // pendiente = rojo
  if (estado === 'Entregado') color = '#2a9d8f'; // verde
  if (estado === 'Cancelado') color = '#8d99ae'; // gris
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

function limpiarMarcadores() {
  marcadores.forEach(m => mapa.removeLayer(m));
  marcadores = [];
}

function dibujarPedidos(pedidos) {
  limpiarMarcadores();

  const choferSeleccionado = filtroChofer.value;
  let pendientes = 0, entregados = 0, cancelados = 0;
  const puntos = [];

  pedidos.forEach(p => {
    if (p.estado === 'Entregado') entregados++;
    else if (p.estado === 'Cancelado') cancelados++;
    else pendientes++;

    if (choferSeleccionado && p.chofer !== choferSeleccionado) return;
    if (!p.lat || !p.lng) return;

    const marcador = L.marker([p.lat, p.lng], { icon: iconoPara(p.estado) }).addTo(mapa);
    const claseEstado = p.estado === 'Entregado' ? 'estado-entregado'
      : p.estado === 'Cancelado' ? 'estado-cancelado' : 'estado-pendiente';
    const bloqueObservacion = p.observaciones && p.observaciones !== 'Sin observaciones'
      ? `<div class="observacion">⚠️ ${p.observaciones}</div>`
      : '';

    marcador.bindPopup(`
      <div class="popup-pedido">
        <div class="titulo">Pedido ${p.id} — ${p.cliente}</div>
        <div>${p.direccion || ''}</div>
        <div>Chofer: <strong>${p.chofer}</strong></div>
        <div class="${claseEstado}">${p.estado}</div>
        ${bloqueObservacion}
      </div>
    `);

    marcadores.push(marcador);
    puntos.push([p.lat, p.lng]);
  });

  cantPendientes.textContent = pendientes;
  cantEntregados.textContent = entregados;
  cantCancelados.textContent = cancelados;

  if (puntos.length > 0) {
    mapa.fitBounds(puntos, { padding: [40, 40], maxZoom: 15 });
  }
}

function actualizarFiltroChoferes(pedidos) {
  const seleccionActual = filtroChofer.value;
  const choferes = [...new Set(pedidos.map(p => p.chofer))].sort();

  filtroChofer.innerHTML = '<option value="">Todos los choferes</option>';
  choferes.forEach(c => {
    const opcion = document.createElement('option');
    opcion.value = c;
    opcion.textContent = c;
    filtroChofer.appendChild(opcion);
  });
  filtroChofer.value = seleccionActual;
}

// ---------- Carga de datos ----------
let pedidosActuales = [];

async function actualizarDatos() {
  const sesion = obtenerSesion();
  const resultado = await llamarAPI('pedidosMapa', sesion);

  if (!resultado.ok) {
    if (resultado.error === 'No autorizado') {
      cerrarSesion();
    }
    return;
  }

  pedidosActuales = resultado.pedidos;
  actualizarFiltroChoferes(pedidosActuales);
  dibujarPedidos(pedidosActuales);

  const ahora = new Date();
  ultimaActualizacion.textContent = 'Actualizado ' + ahora.toLocaleTimeString('es-AR');
}

filtroChofer.addEventListener('change', () => dibujarPedidos(pedidosActuales));

function iniciarPanel() {
  pantallaLogin.classList.add('oculto');
  pantallaPanel.classList.remove('oculto');
  inicializarMapa();
  actualizarDatos();
  intervaloId = setInterval(actualizarDatos, INTERVALO_ACTUALIZACION_MS);
}

// ---------- Arranque ----------
(function iniciar() {
  const sesion = obtenerSesion();
  if (sesion.usuario && sesion.password) {
    iniciarPanel();
  }
})();
