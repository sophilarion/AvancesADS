document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('sismografoCanvas');
    const ctx = canvas.getContext('2d');
    const magnitudDisplay = document.getElementById('magnitudDisplay');

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // ✅ --- 1. CONFIGURACIÓN DE FIREBASE ---
    // Se usa la URL que proporcionaste.
    const firebaseConfig = {
      databaseURL: "https://simulador-ba4cf-default-rtdb.firebaseio.com/",
    };

    // Inicializar Firebase
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    // Creamos una referencia a una "carpeta" llamada 'sismos' donde guardaremos los registros.
    const sismosRef = database.ref('sismos');


    // --- Parámetros de la Simulación (igual que el original) ---
    let energia = 0;
    let energiaMaxima = 0;
    const DECAY_RATE = 0.98;
    const CLICK_ENERGY_BOOST = 15;
    const RAPID_CLICK_MULTIPLIER = 1.8;
    const MAX_ENERGY_CAP = 150;

    let lastClickTime = 0;
    let isShaking = false;
    let timeoutId = null;
    let x = 0;

    // La lógica de dibujo y la cuadrícula (drawGrid, dibujar) permanecen exactamente igual.
    // ... (puedes pegar aquí las funciones dibujar() y drawGrid() del código anterior sin cambios) ...
    function dibujar() {
        ctx.fillStyle = '#fcfdfd';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        const amplitude = (energia / MAX_ENERGY_CAP) * (canvas.height / 2.2);
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#d9534f';
        ctx.moveTo(0, canvas.height / 2);
        for (let i = 0; i < canvas.width; i++) {
            const waveX = i;
            const waveY1 = Math.sin((i + x) * 0.1) * amplitude * 0.6;
            const waveY2 = Math.sin((i + x) * 0.25) * amplitude * 0.4;
            const waveY = waveY1 + waveY2;
            ctx.lineTo(waveX, canvas.height / 2 + waveY);
        }
        ctx.stroke();
        x -= 3;
        if (energia > 0) {
            energia *= DECAY_RATE;
            if (energia < 0.1) {
                energia = 0;
            }
        }
        requestAnimationFrame(dibujar);
    }

    function drawGrid() {
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;
        for (let i = (x % 20); i < canvas.width; i += 20) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, canvas.height);
            ctx.stroke();
        }
        for (let i = 0; i < canvas.height; i += 20) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(canvas.width, i);
            ctx.stroke();
        }
        ctx.strokeStyle = '#a0a0a0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
    }


    // --- Lógica del Sismo (igual que el original) ---
    function iniciarSismo(event) {
        const currentTime = Date.now();
        const timeSinceLastClick = currentTime - lastClickTime;
        let boost = CLICK_ENERGY_BOOST;
        if (timeSinceLastClick < 300) {
            boost *= RAPID_CLICK_MULTIPLIER * (300 / timeSinceLastClick);
        }
        energia += boost;
        if (energia > MAX_ENERGY_CAP) {
            energia = MAX_ENERGY_CAP;
        }
        if (energia > energiaMaxima) {
            energiaMaxima = energia;
        }
        lastClickTime = currentTime;
        if (!isShaking) {
            isShaking = true;
            magnitudDisplay.textContent = "Detectando...";
        }
        clearTimeout(timeoutId);
        timeoutId = setTimeout(finalizarSismo, 2500);
    }
    
    // ✅ --- 2. FUNCIÓN DE FINALIZAR SISMO (ACTUALIZADA) ---
    function finalizarSismo() {
        isShaking = false;
        if (energiaMaxima > 0) {
            const magnitud = calcularMagnitud(energiaMaxima);
            const nivelPeligro = determinarPeligro(magnitud);
            
            magnitudDisplay.textContent = magnitud.toFixed(1);

            // Preparamos el objeto que enviaremos a Firebase
            const registroSismo = {
                magnitud: magnitud.toFixed(1),
                nivelPeligro: nivelPeligro,
                timestamp: new Date().toISOString() // Fecha y hora actual en formato estándar
            };

            // Usamos push() para añadir un nuevo registro con un ID único
            sismosRef.push(registroSismo)
                .then(() => {
                    console.log("✅ Datos guardados en Firebase exitosamente:", registroSismo);
                })
                .catch((error) => {
                    console.error("❌ Error al guardar datos en Firebase:", error);
                });

        } else {
            magnitudDisplay.textContent = "---";
        }
        energiaMaxima = 0; // Reiniciar para el próximo evento
    }

    function calcularMagnitud(maxEnergia) {
        if (maxEnergia <= 0) return 0.0;
        let magnitud = 1.5 + Math.log10(maxEnergia) * 2.8;
        return Math.min(magnitud, 9.5);
    }

    // ✅ --- 3. NUEVA FUNCIÓN PARA DETERMINAR EL PELIGRO ---
    function determinarPeligro(magnitud) {
        if (magnitud < 4.0) return "Bajo / Imperceptible";
        if (magnitud < 6.0) return "Ligero / Moderado";
        if (magnitud < 7.0) return "Fuerte / Peligroso";
        return "Muy Peligroso / Mayor";
    }

    // Iniciar todo (igual que el original)
    canvas.addEventListener('click', iniciarSismo);
    dibujar();
});