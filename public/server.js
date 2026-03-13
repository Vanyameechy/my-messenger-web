const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// ==================== НАСТРОЙКИ ====================
const PORT = 3000;
const JWT_SECRET = 'your-secret-key-change-this'; // в продакшене используйте переменные окружения
const LOG_FILE = path.join(__dirname, 'server.log');
const DB_FILE = path.join(__dirname, 'messenger.db');

// ==================== ЛОГИРОВАНИЕ ====================
function log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    let logEntry = `[${timestamp}] [${level}] ${message}`;
    if (data) logEntry += ` ${JSON.stringify(data)}`;
    console.log(logEntry);
    fs.appendFileSync(LOG_FILE, logEntry + '\n');
}

// ==================== БАЗА ДАННЫХ ====================
const db = new Database(DB_FILE);
db.pragma('foreign_keys = ON');

// Создание таблиц (с IF NOT EXISTS)
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        displayName TEXT,
        passwordHash TEXT NOT NULL,
        avatar TEXT,
        bio TEXT,
        phone TEXT,
        lastSeen DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        settings TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT CHECK(type IN ('private', 'group')) NOT NULL,
        title TEXT,
        avatar TEXT,
        description TEXT,
        createdBy INTEGER NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(createdBy) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_participants (
        chatId INTEGER NOT NULL,
        userId INTEGER NOT NULL,
        role TEXT CHECK(role IN ('member', 'admin', 'creator')) DEFAULT 'member',
        joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        lastReadMessageId INTEGER DEFAULT 0,
        PRIMARY KEY (chatId, userId),
        FOREIGN KEY(chatId) REFERENCES chats(id) ON DELETE CASCADE,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chatId INTEGER NOT NULL,
        senderId INTEGER NOT NULL,
        text TEXT,
        attachments TEXT DEFAULT '[]',
        replyTo INTEGER,
        edited BOOLEAN DEFAULT 0,
        deleted BOOLEAN DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(chatId) REFERENCES chats(id) ON DELETE CASCADE,
        FOREIGN KEY(senderId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(replyTo) REFERENCES messages(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        name TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS folder_chats (
        folderId INTEGER NOT NULL,
        chatId INTEGER NOT NULL,
        PRIMARY KEY (folderId, chatId),
        FOREIGN KEY(folderId) REFERENCES folders(id) ON DELETE CASCADE,
        FOREIGN KEY(chatId) REFERENCES chats(id) ON DELETE CASCADE
    );
`);

// Создание индексов
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chatId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_participants_user ON chat_participants(userId);
    CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(userId);
`);

// Добавление колонок в users, если их нет (для обратной совместимости)
const userColumns = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
if (!userColumns.includes('phone')) {
    db.exec("ALTER TABLE users ADD COLUMN phone TEXT");
}
if (!userColumns.includes('lastSeen')) {
    db.exec("ALTER TABLE users ADD COLUMN lastSeen DATETIME");
}

log('INFO', 'Database initialized');

// Вспомогательные функции для работы с БД
function getUserById(id) {
    return db.prepare('SELECT id, username, displayName, avatar, bio, phone, lastSeen, createdAt, settings FROM users WHERE id = ?').get(id);
}

function getUserByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function createUser(username, password, displayName = null) {
    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare('INSERT INTO users (username, displayName, passwordHash) VALUES (?, ?, ?)')
        .run(username, displayName || username, hash);
    return getUserById(info.lastInsertRowid);
}

// Получить все чаты пользователя
function getUserChats(userId) {
    return db.prepare('SELECT chatId FROM chat_participants WHERE userId = ?').all(userId).map(r => r.chatId);
}

// ==================== НАСТРОЙКА EXPRESS ====================
const app = express();
app.use(express.json());

// Раздача статических файлов из папки public
app.use(express.static('public'));

// Middleware для проверки JWT (кроме публичных маршрутов)
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// ==================== REST API ====================

// Регистрация
app.post('/api/auth/register', (req, res) => {
    const { username, password, displayName } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    try {
        const existing = getUserByUsername(username);
        if (existing) return res.status(400).json({ error: 'Username already exists' });
        const user = createUser(username, password, displayName);
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
        log('INFO', 'User registered', { userId: user.id, username });
        res.json({ user, token });
    } catch (err) {
        log('ERROR', 'Registration failed', { error: err.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Вход
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = getUserByUsername(username);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Обновляем lastSeen
    db.prepare('UPDATE users SET lastSeen = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    log('INFO', 'User logged in', { userId: user.id, username });
    res.json({
        user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar,
            bio: user.bio,
            phone: user.phone,
            lastSeen: user.lastSeen,
            createdAt: user.createdAt,
            settings: JSON.parse(user.settings)
        },
        token
    });
});

// Получить текущего пользователя (по токену)
app.get('/api/auth/me', authenticate, (req, res) => {
    const user = getUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
        ...user,
        settings: JSON.parse(user.settings)
    });
});

// Обновить профиль
app.put('/api/users/:id', authenticate, (req, res) => {
    if (parseInt(req.params.id) !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    const { displayName, avatar, bio, phone, settings } = req.body;
    const updates = [];
    const params = [];
    if (displayName !== undefined) {
        updates.push('displayName = ?');
        params.push(displayName);
    }
    if (avatar !== undefined) {
        updates.push('avatar = ?');
        params.push(avatar);
    }
    if (bio !== undefined) {
        updates.push('bio = ?');
        params.push(bio);
    }
    if (phone !== undefined) {
        updates.push('phone = ?');
        params.push(phone);
    }
    if (settings !== undefined) {
        updates.push('settings = ?');
        params.push(JSON.stringify(settings));
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.userId);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    log('INFO', 'User updated', { userId: req.userId });
    res.json(getUserById(req.userId));
});

// Список пользователей (кроме себя)
app.get('/api/users', authenticate, (req, res) => {
    const users = db.prepare('SELECT id, username, displayName, avatar FROM users WHERE id != ?').all(req.userId);
    res.json(users);
});

// Получить информацию о пользователе (включая онлайн-статус)
app.get('/api/users/:id', authenticate, (req, res) => {
    const user = getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const online = onlineUsers.has(user.id);
    res.json({ ...user, online, lastSeen: user.lastSeen });
});

// Статус пользователя (онлайн/офлайн)
app.get('/api/users/:id/status', authenticate, (req, res) => {
    const user = getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const online = onlineUsers.has(user.id);
    res.json({ userId: user.id, online, lastSeen: user.lastSeen });
});

// Создать чат (личный или группу)
app.post('/api/chats', authenticate, (req, res) => {
    const { type, title, participantIds, avatar, description } = req.body;
    if (!type || !['private', 'group'].includes(type)) {
        return res.status(400).json({ error: 'Invalid chat type' });
    }
    if (type === 'group' && !title) {
        return res.status(400).json({ error: 'Group title required' });
    }
    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
        return res.status(400).json({ error: 'At least one participant required' });
    }

    // Убедимся, что создатель включён в список
    const allParticipants = Array.from(new Set([req.userId, ...participantIds]));

    // Для личного чата проверяем, не существует ли уже чат между этими двумя
    if (type === 'private' && allParticipants.length === 2) {
        const existing = db.prepare(`
            SELECT c.id FROM chats c
            JOIN chat_participants cp1 ON c.id = cp1.chatId
            JOIN chat_participants cp2 ON c.id = cp2.chatId
            WHERE c.type = 'private' AND cp1.userId = ? AND cp2.userId = ?
        `).get(allParticipants[0], allParticipants[1]);
        if (existing) {
            return res.json({ chatId: existing.id, message: 'Chat already exists' });
        }
    }

    const insertChat = db.prepare(`
        INSERT INTO chats (type, title, avatar, description, createdBy)
        VALUES (?, ?, ?, ?, ?)
    `);
    const result = insertChat.run(type, title || null, avatar || null, description || null, req.userId);
    const chatId = result.lastInsertRowid;

    // Добавляем участников
    const insertParticipant = db.prepare(`
        INSERT INTO chat_participants (chatId, userId, role) VALUES (?, ?, ?)
    `);
    for (const uid of allParticipants) {
        const role = uid === req.userId ? 'creator' : 'member';
        insertParticipant.run(chatId, uid, role);
    }

    log('INFO', 'Chat created', { chatId, type, by: req.userId });
    res.json({ chatId });
});

// Получить список чатов пользователя
app.get('/api/chats', authenticate, (req, res) => {
    const chats = db.prepare(`
        SELECT c.*,
               (SELECT COUNT(*) FROM messages m WHERE m.chatId = c.id AND m.id > cp.lastReadMessageId AND m.deleted = 0) AS unreadCount,
               (SELECT json_group_array(json_object('id', u.id, 'username', u.username, 'displayName', u.displayName, 'avatar', u.avatar))
                FROM chat_participants cp2
                JOIN users u ON cp2.userId = u.id
                WHERE cp2.chatId = c.id) AS participants
        FROM chats c
        JOIN chat_participants cp ON c.id = cp.chatId
        WHERE cp.userId = ?
        ORDER BY c.createdAt DESC
    `).all(req.userId);

    // Парсим JSON участников и добавляем информацию о последнем сообщении и онлайн-статусе
    const result = chats.map(chat => {
        const participants = JSON.parse(chat.participants).map(p => ({
            ...p,
            online: onlineUsers.has(p.id)
        }));
        delete chat.participants;

        // Последнее сообщение
        const lastMsg = db.prepare(`
            SELECT m.*, u.username as senderUsername, u.displayName as senderDisplayName
            FROM messages m
            JOIN users u ON m.senderId = u.id
            WHERE m.chatId = ? AND m.deleted = 0
            ORDER BY m.createdAt DESC LIMIT 1
        `).get(chat.id);

        return {
            ...chat,
            participants,
            lastMessage: lastMsg || null,
            unreadCount: chat.unreadCount
        };
    });

    res.json(result);
});

// Получить информацию о конкретном чате
app.get('/api/chats/:id', authenticate, (req, res) => {
    const chatId = req.params.id;
    // Проверяем, является ли пользователь участником
    const participant = db.prepare('SELECT 1 FROM chat_participants WHERE chatId = ? AND userId = ?').get(chatId, req.userId);
    if (!participant) return res.status(403).json({ error: 'Not a participant' });

    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
    const participants = db.prepare(`
        SELECT u.id, u.username, u.displayName, u.avatar, u.lastSeen, cp.role, cp.joinedAt
        FROM chat_participants cp
        JOIN users u ON cp.userId = u.id
        WHERE cp.chatId = ?
    `).all(chatId).map(p => ({
        ...p,
        online: onlineUsers.has(p.id)
    }));
    res.json({ ...chat, participants });
});

// Обновить информацию о чате
app.put('/api/chats/:id', authenticate, (req, res) => {
    const chatId = req.params.id;
    const { title, avatar, description } = req.body;

    // Проверяем права: только creator или admin могут менять
    const role = db.prepare('SELECT role FROM chat_participants WHERE chatId = ? AND userId = ?').get(chatId, req.userId);
    if (!role || (role.role !== 'creator' && role.role !== 'admin')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const updates = [];
    const params = [];
    if (title !== undefined) {
        updates.push('title = ?');
        params.push(title);
    }
    if (avatar !== undefined) {
        updates.push('avatar = ?');
        params.push(avatar);
    }
    if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    params.push(chatId);

    db.prepare(`UPDATE chats SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    log('INFO', 'Chat updated', { chatId, by: req.userId });

    // Уведомляем участников через WebSocket
    notifyChatUpdate(chatId, { type: 'chat_updated', chatId });

    res.json({ success: true });
});

// Добавить участника в группу
app.post('/api/chats/:id/participants', authenticate, (req, res) => {
    const chatId = req.params.id;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    // Проверяем права
    const role = db.prepare('SELECT role FROM chat_participants WHERE chatId = ? AND userId = ?').get(chatId, req.userId);
    if (!role || (role.role !== 'creator' && role.role !== 'admin')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Проверяем, не участник ли уже
    const existing = db.prepare('SELECT 1 FROM chat_participants WHERE chatId = ? AND userId = ?').get(chatId, userId);
    if (existing) return res.status(400).json({ error: 'Already a participant' });

    db.prepare('INSERT INTO chat_participants (chatId, userId, role) VALUES (?, ?, ?)').run(chatId, userId, 'member');
    log('INFO', 'User added to chat', { chatId, userId, by: req.userId });

    notifyChatUpdate(chatId, { type: 'user_joined', chatId, userId });

    res.json({ success: true });
});

// Удалить участника из группы (или выйти самому)
app.delete('/api/chats/:id/participants/:userId', authenticate, (req, res) => {
    const chatId = req.params.id;
    const targetUserId = parseInt(req.params.userId);
    const currentUserId = req.userId;

    // Если удаляем себя - разрешено всегда
    if (targetUserId !== currentUserId) {
        const role = db.prepare('SELECT role FROM chat_participants WHERE chatId = ? AND userId = ?').get(chatId, currentUserId);
        if (!role || (role.role !== 'creator' && role.role !== 'admin')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
    }

    db.prepare('DELETE FROM chat_participants WHERE chatId = ? AND userId = ?').run(chatId, targetUserId);
    log('INFO', 'User removed from chat', { chatId, userId: targetUserId, by: currentUserId });

    notifyChatUpdate(chatId, { type: 'user_left', chatId, userId: targetUserId });

    res.json({ success: true });
});

// Изменить роль участника
app.put('/api/chats/:id/participants/:userId', authenticate, (req, res) => {
    const chatId = req.params.id;
    const targetUserId = parseInt(req.params.userId);
    const { role } = req.body;
    if (!role || !['member', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }

    const currentUserRole = db.prepare('SELECT role FROM chat_participants WHERE chatId = ? AND userId = ?').get(chatId, req.userId);
    if (!currentUserRole) return res.status(403).json({ error: 'Not a participant' });
    if (currentUserRole.role !== 'creator' && (role === 'admin' || targetUserId === req.userId)) {
        return res.status(403).json({ error: 'Only creator can assign admin role' });
    }

    db.prepare('UPDATE chat_participants SET role = ? WHERE chatId = ? AND userId = ?').run(role, chatId, targetUserId);
    log('INFO', 'User role updated', { chatId, userId: targetUserId, role, by: req.userId });

    notifyChatUpdate(chatId, { type: 'role_updated', chatId, userId: targetUserId, role });

    res.json({ success: true });
});

// Получить сообщения чата (с пагинацией)
app.get('/api/chats/:id/messages', authenticate, (req, res) => {
    const chatId = req.params.id;
    const { limit = 50, before } = req.query;

    const participant = db.prepare('SELECT 1 FROM chat_participants WHERE chatId = ? AND userId = ?').get(chatId, req.userId);
    if (!participant) return res.status(403).json({ error: 'Not a participant' });

    let query = `
        SELECT m.*, u.username as senderUsername, u.displayName as senderDisplayName
        FROM messages m
        JOIN users u ON m.senderId = u.id
        WHERE m.chatId = ? AND m.deleted = 0
    `;
    const params = [chatId];
    if (before) {
        query += ' AND m.id < ?';
        params.push(before);
    }
    query += ' ORDER BY m.createdAt DESC LIMIT ?';
    params.push(parseInt(limit));

    const messages = db.prepare(query).all(...params).reverse();
    res.json(messages);
});

// Отправить сообщение (REST)
app.post('/api/messages', authenticate, (req, res) => {
    const { chatId, text, attachments, replyTo } = req.body;
    if (!chatId || !text) return res.status(400).json({ error: 'chatId and text required' });

    const participant = db.prepare('SELECT 1 FROM chat_participants WHERE chatId = ? AND userId = ?').get(chatId, req.userId);
    if (!participant) return res.status(403).json({ error: 'Not a participant' });

    const insert = db.prepare(`
        INSERT INTO messages (chatId, senderId, text, attachments, replyTo)
        VALUES (?, ?, ?, ?, ?)
    `);
    const result = insert.run(chatId, req.userId, text, JSON.stringify(attachments || []), replyTo || null);
    const messageId = result.lastInsertRowid;

    const message = db.prepare(`
        SELECT m.*, u.username as senderUsername, u.displayName as senderDisplayName
        FROM messages m
        JOIN users u ON m.senderId = u.id
        WHERE m.id = ?
    `).get(messageId);

    log('INFO', 'Message sent', { messageId, chatId, sender: req.userId });

    notifyNewMessage(chatId, message);

    res.json(message);
});

// Редактировать сообщение
app.put('/api/messages/:id', authenticate, (req, res) => {
    const messageId = req.params.id;
    const { text } = req.body;

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.senderId !== req.userId) return res.status(403).json({ error: 'Not your message' });

    db.prepare(`
        UPDATE messages SET text = ?, edited = 1, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(text, messageId);

    const updated = db.prepare(`
        SELECT m.*, u.username as senderUsername, u.displayName as senderDisplayName
        FROM messages m
        JOIN users u ON m.senderId = u.id
        WHERE m.id = ?
    `).get(messageId);

    notifyMessageUpdate(message.chatId, { type: 'message_edited', message: updated });

    res.json(updated);
});

// Удалить сообщение (мягкое удаление)
app.delete('/api/messages/:id', authenticate, (req, res) => {
    const messageId = req.params.id;
    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.senderId !== req.userId) return res.status(403).json({ error: 'Not your message' });

    db.prepare('UPDATE messages SET deleted = 1 WHERE id = ?').run(messageId);
    notifyMessageUpdate(message.chatId, { type: 'message_deleted', messageId, chatId: message.chatId });

    res.json({ success: true });
});

// ==================== ПАПКИ ====================
// Получить все папки пользователя с чатами
app.get('/api/folders', authenticate, (req, res) => {
    const folders = db.prepare(`
        SELECT f.*,
               (SELECT json_group_array(chatId) FROM folder_chats WHERE folderId = f.id) AS chatIds
        FROM folders f
        WHERE f.userId = ?
        ORDER BY f.createdAt DESC
    `).all(req.userId);

    // Преобразуем chatIds из строки JSON в массив
    const result = folders.map(f => ({
        ...f,
        chatIds: f.chatIds ? JSON.parse(f.chatIds) : []
    }));

    res.json(result);
});

// Создать папку
app.post('/api/folders', authenticate, (req, res) => {
    const { name, chats } = req.body; // chats - массив chatId
    if (!name) return res.status(400).json({ error: 'Folder name required' });

    const insert = db.prepare('INSERT INTO folders (userId, name) VALUES (?, ?)');
    const result = insert.run(req.userId, name);
    const folderId = result.lastInsertRowid;

    if (chats && Array.isArray(chats) && chats.length > 0) {
        const insertChat = db.prepare('INSERT INTO folder_chats (folderId, chatId) VALUES (?, ?)');
        for (const chatId of chats) {
            insertChat.run(folderId, chatId);
        }
    }

    log('INFO', 'Folder created', { folderId, userId: req.userId });
    res.json({ folderId });
});

// Обновить папку
app.put('/api/folders/:id', authenticate, (req, res) => {
    const folderId = req.params.id;
    const { name, chats } = req.body;

    // Проверяем, принадлежит ли папка пользователю
    const folder = db.prepare('SELECT * FROM folders WHERE id = ? AND userId = ?').get(folderId, req.userId);
    if (!folder) return res.status(404).json({ error: 'Folder not found' });

    if (name !== undefined) {
        db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name, folderId);
    }

    if (chats !== undefined && Array.isArray(chats)) {
        // Удаляем старые связи и добавляем новые
        db.prepare('DELETE FROM folder_chats WHERE folderId = ?').run(folderId);
        const insertChat = db.prepare('INSERT INTO folder_chats (folderId, chatId) VALUES (?, ?)');
        for (const chatId of chats) {
            insertChat.run(folderId, chatId);
        }
    }

    log('INFO', 'Folder updated', { folderId, userId: req.userId });
    res.json({ success: true });
});

// Удалить папку
app.delete('/api/folders/:id', authenticate, (req, res) => {
    const folderId = req.params.id;
    const folder = db.prepare('SELECT * FROM folders WHERE id = ? AND userId = ?').get(folderId, req.userId);
    if (!folder) return res.status(404).json({ error: 'Folder not found' });

    db.prepare('DELETE FROM folders WHERE id = ?').run(folderId);
    log('INFO', 'Folder deleted', { folderId, userId: req.userId });
    res.json({ success: true });
});

// ==================== ДОПОЛНИТЕЛЬНЫЕ ДЕЙСТВИЯ (ЗАГЛУШКИ) ====================
app.post('/api/backup', authenticate, (req, res) => {
    // В реальном приложении здесь можно генерировать JSON с историей
    res.json({ message: 'Backup created (demo)' });
});

app.post('/api/clear-history', authenticate, (req, res) => {
    // В реальном приложении можно удалить все сообщения пользователя (или пометить)
    res.json({ message: 'History cleared (demo)' });
});

app.delete('/api/account', authenticate, (req, res) => {
    // Удаляем пользователя (каскадно удалятся все связанные данные)
    db.prepare('DELETE FROM users WHERE id = ?').run(req.userId);
    log('INFO', 'Account deleted', { userId: req.userId });
    res.json({ success: true });
});

// ==================== WEB SOCKET ====================
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Хранилище соединений: userId -> набор сокетов
const userSockets = new Map();
// Множество онлайн пользователей (для быстрого доступа)
const onlineUsers = new Set();

wss.on('connection', (ws, req) => {
    const urlParams = new URLSearchParams(req.url.slice(req.url.indexOf('?') + 1));
    const token = urlParams.get('token');
    let userId = null;
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            userId = decoded.userId;
        } catch (e) {
            // невалидный токен
        }
    }

    if (!userId) {
        ws.close(1008, 'Unauthorized');
        return;
    }

    // Сохраняем соединение
    if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
        onlineUsers.add(userId);
        // Обновляем lastSeen
        db.prepare('UPDATE users SET lastSeen = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    }
    userSockets.get(userId).add(ws);
    ws.userId = userId;

    log('INFO', 'WebSocket connected', { userId });

    // Оповещаем всех участников общих чатов о том, что пользователь онлайн
    notifyUserStatusChange(userId, true);

    // Подписка на комнаты (чаты)
    ws.on('message', (rawData) => {
        try {
            const data = JSON.parse(rawData);
            if (data.type === 'join') {
                if (!ws.chats) ws.chats = new Set();
                ws.chats.add(data.chatId);
            } else if (data.type === 'leave') {
                if (ws.chats) ws.chats.delete(data.chatId);
            } else if (data.type === 'typing') {
                const { chatId } = data;
                notifyTyping(chatId, userId);
            } else if (data.type === 'read') {
                const { chatId, lastReadMessageId } = data;
                db.prepare(`
                    UPDATE chat_participants SET lastReadMessageId = ?
                    WHERE chatId = ? AND userId = ?
                `).run(lastReadMessageId, chatId, userId);
            }
        } catch (e) {
            log('ERROR', 'WebSocket message parse error', { error: e.message });
        }
    });

    ws.on('close', () => {
        const sockets = userSockets.get(userId);
        if (sockets) {
            sockets.delete(ws);
            if (sockets.size === 0) {
                userSockets.delete(userId);
                onlineUsers.delete(userId);
                // Обновляем lastSeen при полном отключении
                db.prepare('UPDATE users SET lastSeen = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
                // Оповещаем об уходе в офлайн
                notifyUserStatusChange(userId, false);
            }
        }
        log('INFO', 'WebSocket disconnected', { userId });
    });
});

// Функции для отправки уведомлений
function notifyNewMessage(chatId, message) {
    const participants = db.prepare('SELECT userId FROM chat_participants WHERE chatId = ?').all(chatId);
    participants.forEach(p => {
        const sockets = userSockets.get(p.userId);
        if (sockets) {
            const payload = JSON.stringify({ type: 'new_message', message });
            sockets.forEach(sock => {
                if (sock.readyState === WebSocket.OPEN) sock.send(payload);
            });
        }
    });
}

function notifyMessageUpdate(chatId, update) {
    const participants = db.prepare('SELECT userId FROM chat_participants WHERE chatId = ?').all(chatId);
    participants.forEach(p => {
        const sockets = userSockets.get(p.userId);
        if (sockets) {
            const payload = JSON.stringify(update);
            sockets.forEach(sock => {
                if (sock.readyState === WebSocket.OPEN) sock.send(payload);
            });
        }
    });
}

function notifyChatUpdate(chatId, update) {
    const participants = db.prepare('SELECT userId FROM chat_participants WHERE chatId = ?').all(chatId);
    participants.forEach(p => {
        const sockets = userSockets.get(p.userId);
        if (sockets) {
            const payload = JSON.stringify(update);
            sockets.forEach(sock => {
                if (sock.readyState === WebSocket.OPEN) sock.send(payload);
            });
        }
    });
}

function notifyTyping(chatId, userId) {
    const participants = db.prepare('SELECT userId FROM chat_participants WHERE chatId = ?').all(chatId);
    participants.forEach(p => {
        if (p.userId === userId) return;
        const sockets = userSockets.get(p.userId);
        if (sockets) {
            const payload = JSON.stringify({ type: 'typing', chatId, userId });
            sockets.forEach(sock => {
                if (sock.readyState === WebSocket.OPEN) sock.send(payload);
            });
        }
    });
}

function notifyUserStatusChange(userId, online) {
    // Получаем все чаты пользователя
    const chatIds = getUserChats(userId);
    if (chatIds.length === 0) return;

    // Для каждого чата получаем участников и отправляем им статус
    const placeholders = chatIds.map(() => '?').join(',');
    const participants = db.prepare(`
        SELECT DISTINCT userId FROM chat_participants WHERE chatId IN (${placeholders}) AND userId != ?
    `).all(...chatIds, userId);

    participants.forEach(p => {
        const sockets = userSockets.get(p.userId);
        if (sockets) {
            const payload = JSON.stringify({ type: 'user_status', userId, online });
            sockets.forEach(sock => {
                if (sock.readyState === WebSocket.OPEN) sock.send(payload);
            });
        }
    });
}

// ==================== ЗАПУСК СЕРВЕРА ====================
server.listen(PORT, () => {
    log('INFO', `Server running on http://localhost:${PORT}`);
});