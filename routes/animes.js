const express = require('express');
const router = express.Router();

module.exports = (pool) => {
    const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

    const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

    const resolveRequester = async (email) => {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) return { user: null, email: '', isAdmin: false };

        const [users] = await pool.query('SELECT id, email FROM users WHERE email = ?', [normalizedEmail]);
        if (!users.length) {
            return { user: null, email: normalizedEmail, isAdmin: normalizedEmail === ADMIN_EMAIL };
        }

        return {
            user: users[0],
            email: normalizedEmail,
            isAdmin: normalizedEmail === ADMIN_EMAIL
        };
    };

    const ensureTables = async () => {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_anime_estado (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                anime_id INT NOT NULL,
                estado ENUM('VISTO', 'NO VISTO') NOT NULL DEFAULT 'NO VISTO',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_anime (user_id, anime_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (anime_id) REFERENCES animes(id) ON DELETE CASCADE
            )
        `);
    };

    ensureTables().catch((error) => {
        console.error('❌ Error al inicializar tablas de usuario:', error);
    });

    router.post('/auth/login', async (req, res) => {
        const email = normalizeEmail(req.body?.email);
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Correo electrónico inválido' });
        }

        try {
            await pool.query('INSERT IGNORE INTO users (email) VALUES (?)', [email]);
            const [users] = await pool.query('SELECT id, email, created_at FROM users WHERE email = ?', [email]);
            const user = users[0];

            res.json({
                user,
                isAdmin: email === ADMIN_EMAIL
            });
        } catch (error) {
            console.error('❌ Error en login:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    });

    router.get('/animes', async (req, res) => {
        const nombre = req.query.nombre;
        const email = req.query.email;

        try {
            const requester = await resolveRequester(email);

            let query = `
                SELECT a.*, ${requester.user && !requester.isAdmin ? "COALESCE(ua.estado, 'NO VISTO')" : 'a.estado'} AS estado_usuario
                FROM animes a
            `;
            const params = [];

            if (requester.user && !requester.isAdmin) {
                query += ' LEFT JOIN user_anime_estado ua ON ua.anime_id = a.id AND ua.user_id = ? ';
                params.push(requester.user.id);
            } else {
                query += ' LEFT JOIN user_anime_estado ua ON 1 = 0 ';
            }

            if (nombre) {
                query += ' WHERE a.nombre = ?';
                params.push(nombre);
            }

            const [results] = await pool.query(query, params);
            res.json(results);
        } catch (error) {
            console.error('❌ Error al obtener animes:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    });

    router.get('/animes/ordenados', async (req, res) => {
        const email = req.query.email;
        try {
            const requester = await resolveRequester(email);
            let query = `
                SELECT a.*, ${requester.user && !requester.isAdmin ? "COALESCE(ua.estado, 'NO VISTO')" : 'a.estado'} AS estado_usuario
                FROM animes a
            `;
            const params = [];

            if (requester.user && !requester.isAdmin) {
                query += ' LEFT JOIN user_anime_estado ua ON ua.anime_id = a.id AND ua.user_id = ? ';
                params.push(requester.user.id);
            } else {
                query += ' LEFT JOIN user_anime_estado ua ON 1 = 0 ';
            }

            query += ' ORDER BY a.nombre ASC';
            const [results] = await pool.query(query, params);
            res.json(results);
        } catch (error) {
            console.error('❌ Error al obtener animes ordenados:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    });

    router.get('/animes/no-visto', async (req, res) => {
        const email = req.query.email;
        try {
            const requester = await resolveRequester(email);
            let query = `
                SELECT a.*, ${requester.user && !requester.isAdmin ? "COALESCE(ua.estado, 'NO VISTO')" : 'a.estado'} AS estado_usuario
                FROM animes a
            `;
            const params = [];

            if (requester.user && !requester.isAdmin) {
                query += ' LEFT JOIN user_anime_estado ua ON ua.anime_id = a.id AND ua.user_id = ? ';
                params.push(requester.user.id);
                query += " WHERE COALESCE(ua.estado, 'NO VISTO') = 'NO VISTO'";
            } else {
                query += ' LEFT JOIN user_anime_estado ua ON 1 = 0 ';
                query += " WHERE a.estado = 'NO VISTO'";
            }

            const [results] = await pool.query(query, params);
            res.json(results);
        } catch (error) {
            console.error('❌ Error al obtener animes NO VISTO:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    });

    router.post('/animes', async (req, res) => {
        const requester = await resolveRequester(req.body?.email);
        if (!requester.isAdmin) {
            return res.status(403).json({ error: 'Solo el admin puede agregar animes' });
        }

        const { nombre, imagen_url, capitulos, anio_emision, sinopsis, estado } = req.body;

        if (!nombre || !imagen_url || !capitulos || !anio_emision || !sinopsis || !estado) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }

        try {
            const [result] = await pool.query(
                'INSERT INTO animes (nombre, imagen_url, capitulos, anio_emision, sinopsis, estado) VALUES (?, ?, ?, ?, ?, ?)',
                [nombre, imagen_url, capitulos, anio_emision, sinopsis, estado]
            );
            res.json({ message: 'Anime agregado', id: result.insertId });
        } catch (error) {
            console.error('🔥 Error en el servidor:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    });

    router.delete('/animes/:id', async (req, res) => {
        const requester = await resolveRequester(req.query.email);
        if (!requester.isAdmin) {
            return res.status(403).json({ error: 'Solo el admin puede eliminar animes' });
        }

        const { id } = req.params;

        try {
            const [result] = await pool.query('DELETE FROM animes WHERE id = ?', [id]);
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Anime no encontrado' });
            }
            res.json({ message: 'Anime eliminado correctamente' });
        } catch (error) {
            console.error('🔥 Error al eliminar anime:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    });

    router.put('/animes/:id/estado', async (req, res) => {
        const { id } = req.params;
        const { estado, email } = req.body;

        if (!estado) {
            return res.status(400).json({ error: 'El estado es obligatorio' });
        }

        try {
            const requester = await resolveRequester(email);

            if (requester.isAdmin) {
                const [result] = await pool.query('UPDATE animes SET estado = ? WHERE id = ?', [estado, id]);
                if (result.affectedRows === 0) {
                    return res.status(404).json({ message: 'Anime no encontrado' });
                }
                return res.json({ message: 'Estado global actualizado' });
            }

            if (!requester.user) {
                return res.status(401).json({ error: 'Debes iniciar sesión para guardar tu progreso' });
            }

            await pool.query(
                `INSERT INTO user_anime_estado (user_id, anime_id, estado)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE estado = VALUES(estado)`,
                [requester.user.id, id, estado]
            );

            res.json({ message: 'Estado personal actualizado' });
        } catch (error) {
            console.error('🔥 Error al actualizar estado:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    });

    router.put('/animes/:id', async (req, res) => {
        const requester = await resolveRequester(req.body?.email);
        if (!requester.isAdmin) {
            return res.status(403).json({ error: 'Solo el admin puede actualizar animes' });
        }

        const { id } = req.params;
        let { nombre, imagen_url, capitulos, anio_emision, sinopsis, estado } = req.body;

        try {
            const [animeData] = await pool.query('SELECT * FROM animes WHERE id = ?', [id]);
            if (animeData.length === 0) {
                return res.status(404).json({ message: 'Anime no encontrado' });
            }

            const animeActual = animeData[0];
            nombre = nombre ?? animeActual.nombre;
            imagen_url = imagen_url ?? animeActual.imagen_url;
            capitulos = capitulos ?? animeActual.capitulos;
            anio_emision = anio_emision ?? animeActual.anio_emision;
            sinopsis = sinopsis ?? animeActual.sinopsis;
            estado = estado ?? animeActual.estado;

            await pool.query(
                'UPDATE animes SET nombre = ?, imagen_url = ?, capitulos = ?, anio_emision = ?, sinopsis = ?, estado = ? WHERE id = ?',
                [nombre, imagen_url, capitulos, anio_emision, sinopsis, estado, id]
            );

            res.json({ message: 'Anime actualizado correctamente' });
        } catch (error) {
            console.error('🔥 Error al actualizar anime:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    });

    return router;
};
