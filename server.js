require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');  // 👈 Usamos mysql2 con `promise`
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Configurar conexión a MySQL con pool de conexiones
const pool = mysql.createPool({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Importar rutas y pasar el pool de conexiones
const animeRoutes = require('./routes/animes')(pool);
app.use('/api', animeRoutes);

// Ruta de prueba
const path = require('path');

// Servir archivos estáticos desde /public
app.use(express.static(path.join(__dirname, 'public')));

// Para cualquier ruta no reconocida, devolver index.html (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Iniciar servidor
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
