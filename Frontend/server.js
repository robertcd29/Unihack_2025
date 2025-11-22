const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-key-change-this-in-production';

const server = http.createServer(app);

const wss = new WebSocket.Server({ 
    server: server,
    path: '/ws/parking'
});

const pool = new Pool({
    user: 'postgres',
    host: '172.20.10.5',
    database: 'smart_park',
    password: 'd',
    port: 5432,
});

app.use(cors());
app.use(express.json());

pool.connect((err, client, release) => {
    if (err) {
        return console.error('Eroare la conectarea la PostgreSQL:', err.stack);
    }
    console.log('Conectat la PostgreSQL');
    release();
});

app.post('/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        console.log('Încercare login pentru:', username);

        const result = await pool.query(
            'SELECT * FROM admins WHERE username = $1',
            [username]
        ).catch(() => null);

        if (!result || result.rows.length === 0) {
            console.log('Nu există tabel admins, folosesc credențiale hardcodate');
            
            if (username === 'admin' && password === 'admin123') {
                const token = jwt.sign(
                    { username: 'admin', role: 'admin' },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );

                return res.json({
                    success: true,
                    token: token,
                    username: 'admin',
                    message: 'Autentificare reușită!'
                });
            } else {
                return res.status(401).json({
                    success: false,
                    message: 'Username sau parolă greșită!'
                });
            }
        }

        const admin = result.rows[0];
        const validPassword = await bcrypt.compare(password, admin.password_hash);

        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: 'Username sau parolă greșită!'
            });
        }

        const token = jwt.sign(
            { id: admin.id, username: admin.username, role: 'admin' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log('Login reușit pentru:', username);

        res.json({
            success: true,
            token: token,
            username: admin.username,
            message: 'Autentificare reușită!'
        });

    } catch (error) {
        console.error('Eroare la login:', error);
        res.status(500).json({
            success: false,
            message: 'Eroare la autentificare'
        });
    }
});

function verifyToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(403).json({ message: 'Token lipsă!' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Token invalid!' });
        }
        req.user = decoded;
        next();
    });
}

app.get('/admin/verify', verifyToken, (req, res) => {
    res.json({
        success: true,
        username: req.user.username,
        message: 'Token valid!'
    });
});

app.post('/admin/parking/add', verifyToken, async (req, res) => {
    try {
        const { 
            parking_name, 
            parking_number, 
            empty_spots, 
            occupied_spots,
            total_spots,
            price_per_hour,
            schedule,
            has_surveillance,
            has_disabled_access,
            has_ev_charging,
            type,
            coordinates
        } = req.body;

        const result = await pool.query(`
            INSERT INTO parking_spots (
                parking_name, parking_number, empty_spots, occupied_spots, 
                total_spots, price_per_hour, schedule, has_surveillance, 
                has_disabled_access, has_ev_charging, type, coordinates
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `, [
            parking_name, parking_number, empty_spots, occupied_spots,
            total_spots, price_per_hour, schedule, has_surveillance,
            has_disabled_access, has_ev_charging, type, 
            JSON.stringify(coordinates)
        ]);

        broadcastParkingUpdate(result.rows);

        res.json({
            success: true,
            parking: result.rows[0],
            message: 'Parcare adăugată cu succes!'
        });

    } catch (error) {
        console.error('Eroare la adăugare parcare:', error);
        res.status(500).json({
            success: false,
            message: 'Eroare la adăugare parcare'
        });
    }
});

app.get('/api/v1/parcari/all', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                id, parking_name, parking_number, empty_spots, occupied_spots,
                total_spots, price_per_hour, schedule, has_surveillance,
                has_disabled_access, has_ev_charging, type, coordinates, updated_at
            FROM parking_spots
            ORDER BY parking_number
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching parking data:', err);
        res.status(500).json({ error: 'Eroare la obținerea datelor' });
    }
});

app.get('/parking_spots', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM parking_spots ORDER BY parking_number
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Eroare la obținerea datelor' });
    }
});

app.get('/parking_spots/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const result = await pool.query(
            'SELECT * FROM parking_spots WHERE LOWER(parking_name) = LOWER($1)',
            [name]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Parcare negăsită' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Eroare la interogare' });
    }
});

app.put('/parking_spots/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { empty_spots, occupied_spots, has_surveillance, has_disabled_access, has_ev_charging } = req.body;

        const result = await pool.query(`
            UPDATE parking_spots 
            SET empty_spots = $1, occupied_spots = $2, has_surveillance = $3,
                has_disabled_access = $4, has_ev_charging = $5, updated_at = NOW()
            WHERE id = $6
            RETURNING *
        `, [empty_spots, occupied_spots, has_surveillance, has_disabled_access, has_ev_charging, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Parcare negăsită' });
        }

        broadcastParkingUpdate(result.rows);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Eroare la actualizare' });
    }
});

app.get('/stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_zones,
                SUM(empty_spots) as total_empty,
                SUM(occupied_spots) as total_occupied,
                SUM(empty_spots + occupied_spots) as total_spots
            FROM parking_spots
        `);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Eroare la statistici' });
    }
});

let connectedClients = 0;

wss.on('connection', (ws) => {
    connectedClients++;
    console.log(`Client conectat la WebSocket (Total: ${connectedClients})`);

    sendParkingData(ws);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
            }
        } catch (err) {
            console.error('Eroare parsare mesaj:', err);
        }
    });

    ws.on('close', () => {
        connectedClients--;
        console.log(`Client deconectat (Rămași: ${connectedClients})`);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

async function sendParkingData(ws) {
    try {
        const result = await pool.query('SELECT * FROM parking_spots ORDER BY parking_number');
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(result.rows));
        }
    } catch (err) {
        console.error('Error sending parking data:', err);
    }
}

function broadcastParkingUpdate(data) {
    const message = JSON.stringify(data);
    let sentCount = 0;

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
            sentCount++;
        }
    });

    console.log(`Update broadcast la ${sentCount} clienți`);
}

setInterval(async () => {
    try {
        const result = await pool.query('SELECT * FROM parking_spots ORDER BY parking_number');
        broadcastParkingUpdate(result.rows);
    } catch (err) {
        console.error('Error in periodic update:', err);
    }
}, 5000);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTP Server running on http://0.0.0.0:${PORT}`);
    console.log(`WebSocket Server ready at ws://0.0.0.0:${PORT}/ws/parking`);
    console.log(`Login endpoint: http://0.0.0.0:${PORT}/admin/login`);
    console.log(`Default credentials: admin / admin123`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    server.close(() => {
        console.log('Server closed');
        pool.end();
    });
});