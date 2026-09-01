// ============================================
// CONFIGURACIÓN — pegar aquí la URL del Apps Script publicado como Web App
// ============================================
const API_URL = 'https://script.google.com/macros/s/AKfycbzR_nguUBtWl4Tqu3BNF3IGfriB8ER5JxoKsae4xAvYh_nVFN1NaCEJfvAidiAKJgWrSg/exec';

// ---------- Elementos ----------
const pantallaLogin = document.getElementById('pantalla-login');
const pantallaPedidos = document.getElementById('pantalla-pedidos');
const pantallaRemito = document.getElementById('pantalla-remito');
const spinner = document.getElementById('spinner');

const formLogin = document.getElementById('form-login');
const errorLogin = document.getElementById('error-login');
const nombreChofer = document.getElementById('nombre-chofer');
const listaPedidos = document.getElementById('lista-pedidos');
const sinPedidos = document.getElementById('sin-pedidos');

let pedidoSeleccionado = null;
let fotoBase64 = null;

// ---------- Utilidades ----------
function mostrarSpinner(mostrar) {
  spinner.classList.toggle('oculto', !mostrar);
}

function cambiarPantalla(pantalla) {
  [pantallaLogin, pantallaPedidos, pantallaRemito].forEach(p => p.classList.add('oculto'));
  pantalla.classList.remove('oculto');
}

// Llama al Apps Script evitando el preflight de CORS (por eso usamos text/plain)
async function llamarAPI(accion, datos = {}) {
  mostrarSpinner(true);
  try {
    const respuesta = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ accion, ...datos })
    });
    return await respuesta.json();
  } catch (err) {
    return { ok: false, error: 'No se pudo conectar. Revisá tu conexión a internet.' };
  } finally {
    mostrarSpinner(false);
  }
}

// ---------- Sesión ----------
function guardarSesion(usuario, nombre) {
  localStorage.setItem('chofer_usuario', usuario);
  localStorage.setItem('chofer_nombre', nombre);
}

function obtenerSesion() {
  return {
    usuario: localStorage.getItem('chofer_usuario'),
    nombre: localStorage.getItem('chofer_nombre')
  };
}

function cerrarSesion() {
  localStorage.removeItem('chofer_usuario');
  localStorage.removeItem('chofer_nombre');
  cambiarPantalla(pantallaLogin);
}

// ---------- Login ----------
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorLogin.textContent = '';
  const usuario = document.getElementById('input-usuario').value.trim();
  const password = document.getElementById('input-password').value;

  const resultado = await llamarAPI('login', { usuario, password });
  if (resultado.ok) {
    guardarSesion(resultado.usuario, resultado.nombre);
    iniciarPantallaPedidos();
  } else {
    errorLogin.textContent = resultado.error || 'Error al ingresar';
  }
});

document.getElementById('btn-salir').addEventListener('click', cerrarSesion);
document.getElementById('btn-volver').addEventListener('click', () => {
  pedidoSeleccionado = null;
  fotoBase64 = null;
  document.getElementById('input-foto').value = '';
  document.getElementById('preview-foto').classList.add('oculto');
  document.getElementById('btn-confirmar').disabled = true;
  cambiarPantalla(pantallaPedidos);
});

// ---------- Pedidos ----------
async function cargarPedidos() {
  const sesion = obtenerSesion();
  const resultado = await llamarAPI('pedidos', { usuario: sesion.usuario });

  listaPedidos.innerHTML = '';
  if (!resultado.ok) {
    sinPedidos.textContent = resultado.error;
    sinPedidos.classList.remove('oculto');
    return;
  }

  if (resultado.pedidos.length === 0) {
    sinPedidos.classList.remove('oculto');
    return;
  }
  sinPedidos.classList.add('oculto');

  resultado.pedidos.forEach(pedido => {
    const tarjeta = document.createElement('div');
    tarjeta.className = 'tarjeta-pedido';
    tarjeta.innerHTML = `
      <div class="id-pedido">Pedido ${pedido.id}</div>
      <div class="cliente">${pedido.cliente}</div>
      <div class="direccion">${pedido.direccion || ''}</div>
      <button class="btn-entregar" data-id="${pedido.id}">Entregar y adjuntar remito</button>
      <button class="btn-cancelar" data-id="${pedido.id}">Cancelado</button>
    `;
    tarjeta.querySelector('.btn-entregar').addEventListener('click', () => abrirPantallaRemito(pedido));
    tarjeta.querySelector('.btn-cancelar').addEventListener('click', () => cancelarPedido(pedido));
    listaPedidos.appendChild(tarjeta);
  });
}

async function cancelarPedido(pedido) {
  const confirmado = confirm(`¿Confirmás que el pedido ${pedido.id} (${pedido.cliente}) fue cancelado por el cliente?`);
  if (!confirmado) return;

  const resultado = await llamarAPI('cancelarPedido', { pedidoId: pedido.id });
  if (resultado.ok) {
    cargarPedidos();
  } else {
    alert(resultado.error || 'No se pudo cancelar el pedido');
  }
}

function iniciarPantallaPedidos() {
  const sesion = obtenerSesion();
  nombreChofer.textContent = sesion.nombre || sesion.usuario;
  cambiarPantalla(pantallaPedidos);
  cargarPedidos();
}

document.getElementById('btn-actualizar').addEventListener('click', cargarPedidos);

// ---------- Adjuntar remito ----------
function abrirPantallaRemito(pedido) {
  pedidoSeleccionado = pedido;
  document.getElementById('remito-pedido-id').textContent = pedido.id;
  document.getElementById('remito-cliente').textContent = pedido.cliente;
  document.getElementById('remito-direccion').textContent = pedido.direccion || '';
  document.getElementById('mensaje-remito').textContent = '';
  cambiarPantalla(pantallaRemito);
}

document.getElementById('input-foto').addEventListener('change', (e) => {
  const archivo = e.target.files[0];
  if (!archivo) return;

  const lector = new FileReader();
  lector.onload = () => {
    fotoBase64 = lector.result; // incluye el prefijo data:image/...;base64,
    const preview = document.getElementById('preview-foto');
    preview.src = fotoBase64;
    preview.classList.remove('oculto');
    document.getElementById('btn-confirmar').disabled = false;
  };
  lector.readAsDataURL(archivo);
});

document.getElementById('btn-confirmar').addEventListener('click', async () => {
  if (!pedidoSeleccionado || !fotoBase64) return;

  const mensaje = document.getElementById('mensaje-remito');
  mensaje.textContent = '';
  mensaje.style.color = '';

  const nombreArchivo = `remito_${pedidoSeleccionado.id}_${Date.now()}.jpg`;
  const resultado = await llamarAPI('subirRemito', {
    pedidoId: pedidoSeleccionado.id,
    imagenBase64: fotoBase64,
    nombreArchivo
  });

  if (resultado.ok) {
    const hayFaltante = resultado.observaciones && resultado.observaciones !== 'Sin observaciones';

    if (hayFaltante) {
      mensaje.style.color = 'var(--rojo)';
      mensaje.textContent = '⚠️ Entrega confirmada, pero se detectó: ' + resultado.observaciones;
    } else {
      mensaje.style.color = 'var(--verde)';
      mensaje.textContent = 'Entrega confirmada ✅';
    }

    setTimeout(() => {
      pedidoSeleccionado = null;
      fotoBase64 = null;
      cambiarPantalla(pantallaPedidos);
      cargarPedidos();
    }, hayFaltante ? 2500 : 900);
  } else {
    mensaje.textContent = resultado.error || 'No se pudo confirmar la entrega';
  }
});

// ---------- Arranque ----------
(function iniciar() {
  const sesion = obtenerSesion();
  if (sesion.usuario) {
    iniciarPantallaPedidos();
  } else {
    cambiarPantalla(pantallaLogin);
  }
})();

// ---------- Service worker (PWA) ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
