const configuredApiBase = document.querySelector('meta[name="api-base"]')?.content?.trim();
const API_BASE = configuredApiBase
    || (window.location.hostname === "localhost"
        ? "http://localhost:4000/api"
        : `${window.location.origin}/api`);
const API_BASE = "https://animepage-production.up.railway.app/api";
const ADMIN_EMAIL = ""; // opcional: define tu correo admin aquí si no usas ADMIN_EMAIL en Railway

const state = {
    user: null,
    isAdmin: false,
    allAnimes: []
};

const animeForm = document.getElementById("animeForm");

const getStoredEmail = () => localStorage.getItem("anime_user_email") || "";
const setStoredEmail = (email) => localStorage.setItem("anime_user_email", email);
const clearStoredEmail = () => localStorage.removeItem("anime_user_email");
const hasSeenAuthChoice = () => localStorage.getItem("auth_choice_seen") === "1";
const setAuthChoiceSeen = () => localStorage.setItem("auth_choice_seen", "1");
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));

async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, options);
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
        ? await response.json()
        : { error: await response.text() };

const buildUrl = (path, params = {}) => {
    const url = new URL(`${API_BASE}${path}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
    });
    return url.toString();
};

async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, options);
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || data.message || "Error en la solicitud");
    }
    return data;
}

function mostrarSeccion(seccionId) {
    document.querySelectorAll(".seccion").forEach((seccion) => {
        seccion.classList.remove("activa");
        seccion.style.display = "none";
    });

    const seccionActiva = document.getElementById(seccionId);
    if (seccionActiva) {
        seccionActiva.classList.add("activa");
        seccionActiva.style.display = "block";
    }

    if (seccionId === "seccion-ruleta") actualizarRuleta();
}

function updateAuthUI() {
    const authStatus = document.getElementById("auth-status");
    const loginBtn = document.getElementById("login-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const adminFormContainer = document.getElementById("admin-form-container");
    const guestAdminMsg = document.getElementById("guest-admin-msg");
    const emailInput = document.getElementById("email-input");
    const authChoice = document.getElementById("auth-choice");

    if (state.user) {
        authStatus.textContent = state.isAdmin
            ? `Admin: ${state.user.email}`
            : `Usuario: ${state.user.email}`;
        loginBtn.classList.add("oculto");
        logoutBtn.classList.remove("oculto");
        emailInput.classList.add("oculto");
        authChoice.classList.add("oculto");
    } else {
        authStatus.textContent = "Modo invitado";
        loginBtn.classList.remove("oculto");
        logoutBtn.classList.add("oculto");
        emailInput.classList.remove("oculto");
    }

    if (state.isAdmin) {
        adminFormContainer.classList.remove("oculto");
        guestAdminMsg.classList.add("oculto");
    } else {
        adminFormContainer.classList.add("oculto");
        guestAdminMsg.classList.remove("oculto");
    }
}

async function login(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
        throw new Error("Ingresa un correo válido");
    }

    const data = await request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail })
    });

    state.user = data.user;
    state.isAdmin = data.isAdmin;
    setStoredEmail(normalizedEmail);
    setAuthChoiceSeen();
    updateAuthUI();
    await cargarAnimes();
    mostrarMensajeTemporal(`Sesión iniciada: ${normalizedEmail}`);
}

function logout() {
    state.user = null;
    state.isAdmin = false;
    clearStoredEmail();
    updateAuthUI();
    cargarAnimes();
    mostrarMensajeTemporal("Sesión cerrada");
}

function getEmailParam() {
    return state.user?.email || "";
}

function buildQuery(params = {}) {
    const cleanParams = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "");
    if (!cleanParams.length) return "";
    return `?${new URLSearchParams(cleanParams).toString()}`;
}

async function getAnimes(params = {}) {
    return request(`/animes/ordenados${buildQuery(params)}`);
}

function updateAuthUI() {
    const authStatus = document.getElementById("auth-status");
    const loginBtn = document.getElementById("login-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const adminFormContainer = document.getElementById("admin-form-container");
    const guestAdminMsg = document.getElementById("guest-admin-msg");

    if (state.user) {
        authStatus.textContent = state.isAdmin
            ? `Admin: ${state.user.email}`
            : `Usuario: ${state.user.email}`;
        loginBtn.classList.add("oculto");
        logoutBtn.classList.remove("oculto");
    } else {
        authStatus.textContent = "Modo invitado";
        loginBtn.classList.remove("oculto");
        logoutBtn.classList.add("oculto");
    }

    if (state.isAdmin) {
        adminFormContainer.classList.remove("oculto");
        guestAdminMsg.classList.add("oculto");
    } else {
        adminFormContainer.classList.add("oculto");
        guestAdminMsg.classList.remove("oculto");
    }
}

async function login(email) {
    const data = await request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
    });

    state.user = data.user;
    state.isAdmin = data.isAdmin || (ADMIN_EMAIL && email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    setStoredEmail(email.toLowerCase());
    updateAuthUI();
    await cargarAnimes();
    mostrarMensajeTemporal(`Sesión iniciada: ${email}`);
}

function logout() {
    state.user = null;
    state.isAdmin = false;
    clearStoredEmail();
    updateAuthUI();
    cargarAnimes();
    mostrarMensajeTemporal("Sesión cerrada");
}

function getEmailParam() {
    return state.user?.email || "";
}

async function cargarAnimes() {
    try {
        const animes = await getAnimes({ email: getEmailParam() });
        state.allAnimes = animes;
        actualizarSecciones(animes);
        mostrarAnimes(animes);
    } catch (error) {
        console.error("Error al cargar animes:", error);
        mostrarMensajeTemporal("No se pudo cargar la lista de animes");
        const email = getEmailParam();
        const animes = await (await fetch(buildUrl("/animes", { email }))).json();
        state.allAnimes = animes;
        actualizarSecciones(animes);
        mostrarAnimesOrdenados();
    } catch (error) {
        console.error("Error al cargar animes:", error);
    }
}

function actualizarSecciones(animes) {
    const listaVisto = document.getElementById("visto-animes");
    const listaNoVisto = document.getElementById("no-visto-animes");
    const loginRequired = document.getElementById("login-required-visto");

    listaVisto.innerHTML = "";
    listaNoVisto.innerHTML = "";

    if (!state.user || !state.user.email) {
        loginRequired.classList.remove("oculto");
    } else {
        loginRequired.classList.add("oculto");
    }

    animes.forEach((anime) => {
        const estado = anime.estado_usuario || anime.estado;
        const card = document.createElement("div");
        card.classList.add("anime-card");
        card.innerHTML = `
            <div class="anime-container" onmouseover="this.classList.add('flipped')" onmouseout="this.classList.remove('flipped')">
                <div class="front">
                    <img src="${anime.imagen_url}" alt="${anime.nombre}">
                </div>
                <div class="back">
                    <h3>${anime.nombre}</h3>
                    <p>Capítulos: ${anime.capitulos}</p>
                    <p>Año: ${anime.anio_emision}</p>
                    <button class="estado-btn" onclick="cambiarEstado(${anime.id}, '${estado}')">
                        ${estado === "NO VISTO" ? "TERMINADO" : "DESMARCAR"}
                    </button>
                </div>
            </div>
        `;

        if (estado === "VISTO") {
            if (state.user) listaVisto.appendChild(card);
        } else {
            listaNoVisto.appendChild(card);
        }
    });
}

async function cambiarEstado(id, estadoActual) {
    if (!state.user && !state.isAdmin) {
        mostrarMensajeTemporal("Inicia sesión para guardar tu estado de visto/no visto");
        return;
    }

    const nuevoEstado = estadoActual === "VISTO" ? "NO VISTO" : "VISTO";

    try {
        await request(`/animes/${id}/estado`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estado: nuevoEstado, email: getEmailParam() })
        });
        mostrarMensajeTemporal(`Estado cambiado a ${nuevoEstado}`);
        await cargarAnimes();
    } catch (error) {
        console.error("Error al cambiar estado:", error);
        mostrarMensajeTemporal(error.message);
    }
}

animeForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!state.isAdmin) {
        mostrarMensajeTemporal("Solo admin puede agregar o actualizar animes");
        return;
    }

    const animeId = this.dataset.animeId || "";
    const animeData = {
        nombre: document.getElementById("nombre").value,
        imagen_url: document.getElementById("imagen_url").value,
        capitulos: document.getElementById("capitulos").value,
        anio_emision: document.getElementById("anio_emision").value,
        sinopsis: document.getElementById("sinopsis").value,
        estado: document.getElementById("estado").value,
        email: getEmailParam()
    };

    const endpoint = animeId ? `/animes/${animeId}` : "/animes";
    const method = animeId ? "PUT" : "POST";

    try {
        await request(endpoint, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(animeData)
        });
        mostrarMensajeTemporal(animeId ? "Anime actualizado" : "Anime agregado");
        limpiarFormulario();
        await cargarAnimes();
    } catch (error) {
        mostrarMensajeTemporal(error.message);
    }
});

document.getElementById("nombre").addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();
        buscarAnimePorNombre(this.value.trim());
    }
});

async function buscarAnimePorNombre(nombre) {
    if (!nombre) return;

    try {
        const data = await request(`/animes${buildQuery({ nombre, email: getEmailParam() })}`);
    const url = buildUrl("/animes", { nombre, email: getEmailParam() });

    try {
        const data = await (await fetch(url)).json();
        if (!data.length) {
            mostrarMensajeTemporal("No hay información");
            return;
        }

        const anime = data[0];
        document.getElementById("imagen_url").value = anime.imagen_url || "";
        document.getElementById("capitulos").value = anime.capitulos || "";
        document.getElementById("anio_emision").value = anime.anio_emision || "";
        document.getElementById("sinopsis").value = anime.sinopsis || "";
        document.getElementById("estado").value = anime.estado || "NO VISTO";
        animeForm.dataset.animeId = anime.id;
        document.querySelector(".submit-btn").textContent = "Actualizar";
    } catch (error) {
        mostrarMensajeTemporal(error.message);
    }
}

function mostrarMensajeTemporal(mensaje) {
    const mensajeDiv = document.createElement("div");
    mensajeDiv.className = "mensaje-temporal";
    mensajeDiv.textContent = mensaje;
    document.body.appendChild(mensajeDiv);

    setTimeout(() => mensajeDiv.classList.add("mostrar"), 100);
    setTimeout(() => {
        mensajeDiv.classList.remove("mostrar");
        setTimeout(() => mensajeDiv.remove(), 500);
    }, 2600);
}

function limpiarFormulario() {
    animeForm.reset();
    delete animeForm.dataset.animeId;
    document.querySelector(".submit-btn").textContent = "Agregar Anime";
}

async function mostrarAnimesOrdenados() {
    try {
        const animes = await getAnimes({ email: getEmailParam() });
        const email = getEmailParam();
        const animes = await (await fetch(buildUrl("/animes/ordenados", { email }))).json();
        state.allAnimes = animes;
        mostrarAnimes(animes);
    } catch (error) {
        console.error("❌ Error al obtener animes:", error);
    }
}

function mostrarAnimes(animes) {
    const contenedor = document.getElementById("abecedario-animes");
    contenedor.innerHTML = "";

    animes.forEach((anime) => {
        const estado = anime.estado_usuario || anime.estado;

        const animeDiv = document.createElement("div");
        animeDiv.classList.add("anime-lista");

        const imagen = document.createElement("img");
        imagen.src = anime.imagen_url;
        imagen.alt = anime.nombre;
        imagen.classList.add("anime-imagen");

        if (estado === "VISTO") {
            imagen.style.filter = "blur(2px) brightness(0.7)";
        }

        const nombre = document.createElement("span");
        nombre.textContent = anime.nombre;
        nombre.classList.add("anime-nombre");

        const sinopsis = document.createElement("p");
        sinopsis.classList.add("anime-sinopsis");
        sinopsis.textContent = anime.sinopsis || "";

        animeDiv.appendChild(imagen);
        animeDiv.appendChild(nombre);
        animeDiv.appendChild(sinopsis);
        contenedor.appendChild(animeDiv);
    });
}

function desplazarALetra(letra) {
    const animes = document.querySelectorAll(".anime-lista");
    for (const anime of animes) {
        if (anime.textContent.trim().toUpperCase().startsWith(letra.toUpperCase())) {
            anime.scrollIntoView({ behavior: "smooth", block: "start" });
            break;
        }
    }
}

function generarAbecedario() {
    const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const contenedor = document.querySelector(".letras-navbar");
    contenedor.innerHTML = "";

    letras.split("").forEach((letra) => {
        const boton = document.createElement("button");
        boton.textContent = letra;
        boton.classList.add("letra-boton");
        boton.addEventListener("click", () => desplazarALetra(letra));
        contenedor.appendChild(boton);
    });
}

function generarColoresAleatorios() {
    const colores = [];
    for (let i = 0; i < 10; i++) {
        colores.push(`hsl(${Math.random() * 360}, 100%, 50%)`);
    }
    return colores;
}

function actualizarRuleta() {
    const ruleta = document.getElementById("ruleta-box");
    const colores = generarColoresAleatorios();
    ruleta.style.background = `conic-gradient(
        ${colores[0]} 0% 10%, ${colores[1]} 10% 20%,
        ${colores[2]} 20% 30%, ${colores[3]} 30% 40%,
        ${colores[4]} 40% 50%, ${colores[5]} 50% 60%,
        ${colores[6]} 60% 70%, ${colores[7]} 70% 80%,
        ${colores[8]} 80% 90%, ${colores[9]} 90% 100%
    )`;
}

async function girarRuleta() {
    actualizarRuleta();

    const ruleta = document.getElementById("ruleta-box");
    const giros = Math.floor(Math.random() * 5) + 5;
    const anguloFinal = giros * 360 + Math.floor(Math.random() * 360);

    ruleta.style.transition = "transform 3s ease-out";
    ruleta.style.transform = `rotate(${anguloFinal}deg)`;

    setTimeout(async () => {
        const animeElegido = await obtenerAnimeAleatorio();
        if (animeElegido) mostrarAnimeSeleccionado(animeElegido);
    }, 3100);
}

async function obtenerAnimeAleatorio() {
    try {
        const animes = await request(`/animes/no-visto${buildQuery({ email: getEmailParam() })}`);
        const email = getEmailParam();
        const response = await fetch(buildUrl("/animes/no-visto", { email }));
        const animes = await response.json();
        if (!animes.length) return null;

        const indiceAleatorio = Math.floor(Math.random() * animes.length);
        return animes[indiceAleatorio];
    } catch (error) {
        console.error("❌ Error al obtener animes:", error);
        return null;
    }
}

function mostrarAnimeSeleccionado(anime) {
    const resultadoDiv = document.getElementById("resultado-ruleta");
    resultadoDiv.innerHTML = `
        <h3>${anime.nombre}</h3>
        <img src="${anime.imagen_url}" alt="${anime.nombre}" class="anime-imagen-seleccionado">
        <h3>${anime.capitulos}</h3>
        <p class="anime-sinopsis">${anime.sinopsis || ""}</p>
    `;
    resultadoDiv.style.display = "block";
}

function mostrarModal(anime) {
    const estado = anime.estado_usuario || anime.estado;
    document.getElementById("modal-imagen").src = anime.imagen_url;
    document.getElementById("modal-nombre").textContent = anime.nombre;
    document.getElementById("modal-anio").textContent = anime.anio_emision || "Desconocido";
    document.getElementById("modal-capitulos").textContent = anime.capitulos || "??";
    document.getElementById("modal-sinopsis").textContent = anime.sinopsis || "Sin sinopsis disponible";
    document.getElementById("modal-estado").textContent = estado;

    document.getElementById("anime-modal").classList.remove("oculto");
    document.querySelector(".cerrar-modal").onclick = () => {
        document.getElementById("anime-modal").classList.add("oculto");
    };

    const btnEstado = document.getElementById("modal-estado-btn");
    btnEstado.onclick = () => cambiarEstado(anime.id, estado);
}

document.getElementById("buscador-anime").addEventListener("input", function () {
    const termino = this.value.toLowerCase();
    const resultados = document.getElementById("resultados-buscador");
    resultados.innerHTML = "";

    if (!termino) {
        resultados.style.display = "none";
        return;
    }

    const coincidencias = state.allAnimes.filter((anime) =>
        anime.nombre.toLowerCase().includes(termino)
    );

    if (!coincidencias.length) {
        resultados.style.display = "none";
        return;
    }

    coincidencias.slice(0, 5).forEach((anime) => {
        const li = document.createElement("li");
        li.innerHTML = `<img src="${anime.imagen_url}" alt="${anime.nombre}"><span>${anime.nombre}</span>`;
        li.addEventListener("click", () => {
            document.getElementById("buscador-anime").value = anime.nombre;
            resultados.style.display = "none";
            mostrarModal(anime);
        });
        resultados.appendChild(li);
    });

    resultados.style.display = "block";
});

document.addEventListener("click", function (e) {
    if (!e.target.closest(".buscador-container")) {
        document.getElementById("resultados-buscador").style.display = "none";
    }
});

window.mostrarSeccion = mostrarSeccion;
window.cambiarEstado = cambiarEstado;

document.getElementById("email-input").addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();

    const email = event.target.value.trim();
    if (!email) return;

    try {
        await login(email);
    } catch (error) {
        mostrarMensajeTemporal(error.message);

    coincidencias.slice(0, 5).forEach((anime) => {
        const li = document.createElement("li");
        li.innerHTML = `<img src="${anime.imagen_url}" alt="${anime.nombre}"><span>${anime.nombre}</span>`;
        li.addEventListener("click", () => {
            document.getElementById("buscador-anime").value = anime.nombre;
            resultados.style.display = "none";
            mostrarModal(anime);
        });
        resultados.appendChild(li);
    });

    resultados.style.display = "block";
});

document.addEventListener("DOMContentLoaded", async () => {
    mostrarSeccion("inicio");
    generarAbecedario();

    document.getElementById("girarRuleta").addEventListener("click", girarRuleta);
    document.getElementById("login-btn").addEventListener("click", async () => {
        const email = document.getElementById("email-input").value.trim();
        if (!email) {
            mostrarMensajeTemporal("Escribe tu correo para iniciar sesión");
            return;
        }

        try {
            await login(email);
        } catch (error) {
            mostrarMensajeTemporal(error.message);
        }
    });

    document.getElementById("logout-btn").addEventListener("click", logout);
    document.getElementById("choice-login").addEventListener("click", () => {
        document.getElementById("auth-choice").classList.add("oculto");
        document.getElementById("email-input").focus();
        setAuthChoiceSeen();
    });
    document.getElementById("choice-guest").addEventListener("click", () => {
        document.getElementById("auth-choice").classList.add("oculto");
        setAuthChoiceSeen();
        updateAuthUI();
    });

    const savedEmail = getStoredEmail();
    if (savedEmail) {
        try {
            await login(savedEmail);
            return;
        } catch (error) {
            clearStoredEmail();
        }
    }

    updateAuthUI();
    if (!hasSeenAuthChoice()) {
        document.getElementById("auth-choice").classList.remove("oculto");
    }
    await cargarAnimes();
});

window.mostrarSeccion = mostrarSeccion;
window.cambiarEstado = cambiarEstado;

document.addEventListener("DOMContentLoaded", async () => {
    mostrarSeccion("inicio");
    generarAbecedario();

    document.getElementById("girarRuleta").addEventListener("click", girarRuleta);
    document.getElementById("login-btn").addEventListener("click", async () => {
        const email = prompt("Ingresa tu correo para iniciar sesión:");
        if (!email) return;

        try {
            await login(email);
        } catch (error) {
            mostrarMensajeTemporal(error.message);
        }
    });

    document.getElementById("logout-btn").addEventListener("click", logout);

    const savedEmail = getStoredEmail();
    if (savedEmail) {
        try {
            await login(savedEmail);
            return;
        } catch (error) {
            clearStoredEmail();
        }
    }

document.addEventListener("DOMContentLoaded", async () => {
    mostrarSeccion("inicio");
    generarAbecedario();

    document.getElementById("girarRuleta").addEventListener("click", girarRuleta);
    document.getElementById("login-btn").addEventListener("click", async () => {
        const email = document.getElementById("email-input").value.trim();
        if (!email) {
            mostrarMensajeTemporal("Escribe tu correo para iniciar sesión");
            return;
        }

        try {
            await login(email);
        } catch (error) {
            mostrarMensajeTemporal(error.message);
        }
    });

    document.getElementById("logout-btn").addEventListener("click", logout);
    document.getElementById("choice-login").addEventListener("click", () => {
        document.getElementById("auth-choice").classList.add("oculto");
        document.getElementById("email-input").focus();
        setAuthChoiceSeen();
    });
    document.getElementById("choice-guest").addEventListener("click", () => {
        document.getElementById("auth-choice").classList.add("oculto");
        setAuthChoiceSeen();
        updateAuthUI();
    });

    const savedEmail = getStoredEmail();
    if (savedEmail) {
        try {
            await login(savedEmail);
            return;
        } catch (error) {
            clearStoredEmail();
        }
    }

    updateAuthUI();
    if (!hasSeenAuthChoice()) {
        document.getElementById("auth-choice").classList.remove("oculto");
    }
    const wantsLogin = confirm("¿Deseas iniciar sesión para guardar tu progreso de animes vistos?");
    if (wantsLogin) {
        const email = prompt("Ingresa tu correo electrónico:");
        if (email) {
            try {
                await login(email);
                return;
            } catch (error) {
                mostrarMensajeTemporal(error.message);
            }
        }
    }

    updateAuthUI();
    await cargarAnimes();
});
