function verificarYBloquear() {
    if (!localStorage.getItem("accesoPermitido")) {
        window.location.replace("login.html");
    }
}

// Bloqueo inicial
verificarYBloquear();

// Escuchar si se cierra sesión en otra pestaña
window.addEventListener('storage', (e) => {
    if (e.key === "accesoPermitido" && !e.newValue) {
        verificarYBloquear();
    }
});

function cerrarSesion() {
    localStorage.removeItem("accesoPermitido"); // Esto avisa a todas las pestañas
    window.location.replace("login.html");
}
