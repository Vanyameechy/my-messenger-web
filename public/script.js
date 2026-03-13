// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let token = localStorage.getItem('token');
let currentUser = null;
let chats = [];
let folders = [];
let currentChatId = null;
let ws = null;
let typingTimeout = null;

// Настройки звука
let soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
let audioCtx = null;

// Хранилище онлайн-статусов пользователей
const onlineStatuses = new Map(); // userId -> boolean

// DOM элементы (все, что нужны)
const authModal = document.getElementById('auth-modal');
const mainView = document.getElementById('main');
const authTitle = document.getElementById('auth-title');
const authUsername = document.getElementById('auth-username');
const authPassword = document.getElementById('auth-password');
const authDisplayName = document.getElementById('auth-displayname');
const authError = document.getElementById('auth-error');
const authSubmit = document.getElementById('auth-submit');
const authToggle = document.getElementById('auth-toggle');
const userDisplayName = document.getElementById('user-displayname');
const userNameSpan = document.getElementById('user-username');
const chatsList = document.getElementById('chats-list');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatTitle = document.getElementById('chat-title');
const typingIndicator = document.getElementById('typing-indicator');
const messageInputArea = document.getElementById('message-input-area');
const newChatBtn = document.getElementById('new-chat-btn');
const chatInfoBtn = document.getElementById('chat-info-btn');
const menuToggle = document.getElementById('menu-toggle');
const dropdownMenu = document.getElementById('dropdown-menu');
const newChatModal = document.getElementById('new-chat-modal');
const chatType = document.getElementById('chat-type');
const groupTitleGroup = document.getElementById('group-title-group');
const groupTitle = document.getElementById('group-title');
const chatParticipants = document.getElementById('chat-participants');
const newChatCreate = document.getElementById('newchat-create');
const newChatCancel = document.getElementById('newchat-cancel');
const newChatError = document.getElementById('newchat-error');
const chatInfoModal = document.getElementById('chat-info-modal');
const chatInfoDetails = document.getElementById('chat-info-details');
const chatParticipantsList = document.getElementById('chat-participants-list');
const chatInfoClose = document.getElementById('chatinfo-close');
const toastContainer = document.getElementById('toast-container');

// Панели настроек
const profilePanel = document.getElementById('profile-panel');
const notificationsPanel = document.getElementById('notifications-panel');
const privacyPanel = document.getElementById('privacy-panel');
const chatSettingsPanel = document.getElementById('chat-settings-panel');
const foldersPanel = document.getElementById('folders-panel');
const accountPanel = document.getElementById('account-panel');
const appearancePanel = document.getElementById('appearance-panel');
const inactivityPanel = document.getElementById('inactivity-panel');
const folderModal = document.getElementById('folder-modal');
const folderNameInput = document.getElementById('folder-name');
const folderChatsSelection = document.getElementById('folder-chats-selection');
const folderModalSave = document.getElementById('folder-modal-save');
const folderModalCancel = document.getElementById('folder-modal-cancel');
const foldersList = document.getElementById('folders-list');
const folderAddBtn = document.getElementById('folder-add');

// Элементы профиля
const profileAvatar = document.getElementById('profile-avatar');
const profileDisplayName = document.getElementById('profile-displayname');
const profilePhone = document.getElementById('profile-phone');
const profileId = document.getElementById('profile-id');
const profileBio = document.getElementById('profile-bio');
const profileSave = document.getElementById('profile-save');
const profileCancel = document.getElementById('profile-cancel');
const profileError = document.getElementById('profile-error');

// Уведомления
const notifSound = document.getElementById('notif-sound');
const notifVibrate = document.getElementById('notif-vibrate');
const notifPreview = document.getElementById('notif-preview');
const notifDnd = document.getElementById('notif-dnd');
const notificationsSave = document.getElementById('notifications-save');
const notificationsCancel = document.getElementById('notifications-cancel');
const notificationsError = document.getElementById('notifications-error');

// Конфиденциальность
const privacyPhoneVisibility = document.getElementById('privacy-phone-visibility');
const privacyLastseenVisibility = document.getElementById('privacy-lastseen-visibility');
const privacyWhoCanWrite = document.getElementById('privacy-who-can-write');
const privacyWhoCanInvite = document.getElementById('privacy-who-can-invite');
const privacyForward = document.getElementById('privacy-forward');
const privacySave = document.getElementById('privacy-save');
const privacyCancel = document.getElementById('privacy-cancel');
const privacyError = document.getElementById('privacy-error');

// Настройки чатов
const chatFontSize = document.getElementById('chat-font-size');
const chatWallpaper = document.getElementById('chat-wallpaper');
const chatBackupBtn = document.getElementById('chat-backup');
const chatClearHistoryBtn = document.getElementById('chat-clear-history');
const chatSettingsSave = document.getElementById('chat-settings-save');
const chatSettingsCancel = document.getElementById('chat-settings-cancel');
const chatSettingsError = document.getElementById('chat-settings-error');

// Учётная запись
const account2fa = document.getElementById('account-2fa');
const twofaPasswordGroup = document.getElementById('2fa-password-group');
const account2faPassword = document.getElementById('account-2fa-password');
const account2faConfirm = document.getElementById('account-2fa-confirm');
const accountChangePhone = document.getElementById('account-change-phone');
const accountDelete = document.getElementById('account-delete');
const accountSave = document.getElementById('account-save');
const accountCancel = document.getElementById('account-cancel');
const accountError = document.getElementById('account-error');

// Внешний вид
const appearanceTheme = document.getElementById('appearance-theme');
const appearanceMessageStyle = document.getElementById('appearance-message-style');
const appearanceFontSize = document.getElementById('appearance-font-size');
const appearanceSave = document.getElementById('appearance-save');
const appearanceCancel = document.getElementById('appearance-cancel');
const appearanceError = document.getElementById('appearance-error');

// Неактивность
const inactivityPeriod = document.getElementById('inactivity-period');
const inactivitySave = document.getElementById('inactivity-save');
const inactivityCancel = document.getElementById('inactivity-cancel');
const inactivityError = document.getElementById('inactivity-error');

// Тема
let currentTheme = localStorage.getItem('theme') || 'dark';
applyTheme(currentTheme);

// ==================== УТИЛИТЫ ====================
function showToast(message, type = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showError(element, message) {
    if (!element) return;
    element.textContent = message;
    setTimeout(() => { element.textContent = ''; }, 3000);
}

async function apiRequest(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(endpoint, {
        ...options,
        headers
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Ошибка запроса');
    }
    return data;
}

function applyTheme(theme) {
    document.body.classList.remove('dark-theme', 'blue-theme', 'light-theme');
    document.body.classList.add(`${theme}-theme`);
    localStorage.setItem('theme', theme);
    currentTheme = theme;
    if (appearanceTheme) appearanceTheme.value = theme;
}

// ==================== ЗВУК ====================
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playClickSound() {
    if (!soundEnabled) return;
    try {
        initAudio();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.1);
        const osc2 = audioCtx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(330, now);
        osc2.frequency.exponentialRampToValueAtTime(0.01, now + 0.08);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        osc.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc2.start(now);
        osc.stop(now + 0.1);
        osc2.stop(now + 0.1);
    } catch (e) {
        console.log('Audio not supported');
    }
}

function addClickSoundToButtons() {
    document.querySelectorAll('button, .chat-item, a[href]').forEach(el => {
        el.removeEventListener('click', playClickSound);
        el.addEventListener('click', playClickSound);
    });
}

const observer = new MutationObserver(() => addClickSoundToButtons());
observer.observe(document.body, { childList: true, subtree: true });

// ==================== АУТЕНТИФИКАЦИЯ ====================
authSubmit.classList.add('btn-primary');
authToggle.classList.add('btn-secondary');

authToggle.addEventListener('click', (e) => {
    e.preventDefault();
    const isLogin = authTitle.textContent === 'Вход';
    if (isLogin) {
        authTitle.textContent = 'Регистрация';
        authSubmit.textContent = 'Зарегистрироваться';
        authToggle.textContent = 'Войти';
        authDisplayName.style.display = 'block';
        authSubmit.classList.remove('btn-secondary');
        authSubmit.classList.add('btn-primary');
        authToggle.classList.remove('btn-primary');
        authToggle.classList.add('btn-secondary');
    } else {
        authTitle.textContent = 'Вход';
        authSubmit.textContent = 'Войти';
        authToggle.textContent = 'Зарегистрироваться';
        authDisplayName.style.display = 'none';
        authSubmit.classList.remove('btn-secondary');
        authSubmit.classList.add('btn-primary');
        authToggle.classList.remove('btn-primary');
        authToggle.classList.add('btn-secondary');
    }
    authError.textContent = '';
});

authSubmit.addEventListener('click', async () => {
    const username = authUsername.value.trim();
    const password = authPassword.value;
    const displayName = authDisplayName.value.trim();
    const isLogin = authTitle.textContent === 'Вход';

    if (!username || !password) {
        showError(authError, 'Заполните все поля');
        return;
    }

    try {
        let endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
        let body = { username, password };
        if (!isLogin && displayName) body.displayName = displayName;

        const data = await apiRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });

        token = data.token;
        localStorage.setItem('token', token);
        currentUser = data.user;

        authModal.classList.remove('show');
        mainView.style.display = 'block';
        userDisplayName.textContent = currentUser.displayName || currentUser.username;
        userNameSpan.textContent = `@${currentUser.username}`;

        initWebSocket();
        loadChats();
        showChatsMode();
    } catch (err) {
        showError(authError, err.message);
    }
});

// ==================== WEBSOCKET ====================
function initWebSocket() {
    if (ws) ws.close();
    ws = new WebSocket(`ws://localhost:3000?token=${token}`);

    ws.onopen = () => {
        console.log('WebSocket connected');
        if (currentChatId) {
            ws.send(JSON.stringify({ type: 'join', chatId: currentChatId }));
        }
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };

    ws.onerror = (err) => {
        console.error('WebSocket error', err);
    };

    ws.onclose = () => {
        console.log('WebSocket closed');
        setTimeout(initWebSocket, 3000);
    };
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'new_message':
            if (data.message.chatId === currentChatId) {
                displayMessage(data.message);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
            updateChatLastMessage(data.message.chatId, data.message);
            break;
        case 'message_edited':
            if (data.message.chatId === currentChatId) {
                updateMessage(data.message);
            }
            updateChatLastMessage(data.message.chatId, data.message);
            break;
        case 'message_deleted':
            if (data.chatId === currentChatId) {
                removeMessage(data.messageId);
            }
            break;
        case 'user_joined':
        case 'user_left':
        case 'chat_updated':
            loadChats();
            if (currentChatId === data.chatId) {
                loadChatInfo(currentChatId);
            }
            break;
        case 'typing':
            if (data.chatId === currentChatId && data.userId !== currentUser.id) {
                typingIndicator.textContent = 'Печатает...';
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(() => {
                    typingIndicator.textContent = '';
                }, 3000);
            }
            break;
        case 'user_status':
            // Обновляем статус пользователя в onlineStatuses
            onlineStatuses.set(data.userId, data.online);
            // Обновляем отображение в списке чатов и информации о чате
            updateUserStatusInUI(data.userId, data.online);
            break;
    }
}

function updateUserStatusInUI(userId, online) {
    // Обновляем индикаторы в списке чатов
    document.querySelectorAll(`.chat-item[data-user-id="${userId}"] .online-indicator`).forEach(el => {
        el.style.display = online ? 'block' : 'none';
    });
    // Обновляем в модалке информации о чате
    const statusEl = document.getElementById(`participant-status-${userId}`);
    if (statusEl) {
        statusEl.textContent = online ? 'в сети' : 'офлайн';
        statusEl.className = `participant-status ${online ? 'online' : 'offline'}`;
    }
}

// ==================== ЗАГРУЗКА ЧАТОВ И ПАПОК ====================
async function loadChats() {
    try {
        chats = await apiRequest('/api/chats');
        // Заполняем onlineStatuses из participants
        chats.forEach(chat => {
            chat.participants?.forEach(p => {
                if (p.id !== currentUser.id) {
                    onlineStatuses.set(p.id, p.online || false);
                }
            });
        });
        renderChats();
        loadFolders();
    } catch (err) {
        console.error('Failed to load chats', err);
        showToast('Не удалось загрузить чаты', 'error');
    }
}

function renderChats() {
    if (!chatsList) return;
    chatsList.innerHTML = '';
    chats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = `chat-item ${chat.id === currentChatId ? 'active' : ''}`;
        chatItem.dataset.chatId = chat.id;

        const avatar = document.createElement('div');
        avatar.className = 'chat-avatar';
        if (chat.avatar) {
            avatar.style.backgroundImage = `url('${chat.avatar}')`;
        } else {
            avatar.style.background = `linear-gradient(135deg, var(--accent), var(--accent-hover))`;
        }

        // Определяем собеседника для личного чата
        let otherParticipant = null;
        if (chat.type === 'private') {
            otherParticipant = chat.participants?.find(p => p.id !== currentUser.id);
            if (otherParticipant) {
                chatItem.dataset.userId = otherParticipant.id;
                const online = onlineStatuses.get(otherParticipant.id) || false;
                if (online) {
                    const indicator = document.createElement('span');
                    indicator.className = 'online-indicator';
                    avatar.appendChild(indicator);
                }
            }
        }

        const info = document.createElement('div');
        info.className = 'chat-info';

        let chatName = chat.title;
        if (!chatName && chat.type === 'private') {
            chatName = otherParticipant?.displayName || otherParticipant?.username || 'Личный чат';
        }
        const name = document.createElement('div');
        name.className = 'chat-name';
        name.textContent = chatName || 'Без названия';

        const lastMsg = document.createElement('div');
        lastMsg.className = 'chat-last-msg';
        lastMsg.textContent = chat.lastMessage
            ? `${chat.lastMessage.senderDisplayName}: ${chat.lastMessage.text}`
            : 'Нет сообщений';

        info.appendChild(name);
        info.appendChild(lastMsg);

        const meta = document.createElement('div');
        meta.className = 'chat-meta';

        if (chat.lastMessage) {
            const time = document.createElement('div');
            time.className = 'chat-time';
            const d = new Date(chat.lastMessage.createdAt);
            time.textContent = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            meta.appendChild(time);
        }

        if (chat.unreadCount > 0) {
            const badge = document.createElement('div');
            badge.className = 'unread-badge';
            badge.textContent = chat.unreadCount;
            meta.appendChild(badge);
        }

        chatItem.appendChild(avatar);
        chatItem.appendChild(info);
        chatItem.appendChild(meta);

        chatItem.addEventListener('click', () => {
            playClickSound();
            selectChat(chat.id);
        });
        chatsList.appendChild(chatItem);
    });
}

// ==================== СОЗДАНИЕ ЧАТА ====================
newChatBtn.addEventListener('click', () => {
    chatType.value = 'private';
    groupTitleGroup.style.display = 'none';
    groupTitle.value = '';
    chatParticipants.value = '';
    newChatModal.classList.add('show');
});

chatType.addEventListener('change', () => {
    groupTitleGroup.style.display = chatType.value === 'group' ? 'block' : 'none';
});

newChatCancel.addEventListener('click', () => {
    newChatModal.classList.remove('show');
});

newChatCreate.addEventListener('click', async () => {
    const type = chatType.value;
    const participantsStr = chatParticipants.value.trim();
    if (!participantsStr) {
        showError(newChatError, 'Укажите хотя бы одного участника');
        return;
    }
    const participantUsernames = participantsStr.split(',').map(s => s.trim()).filter(s => s);

    try {
        const users = await apiRequest('/api/users');
        const participantIds = [];
        for (const uname of participantUsernames) {
            const user = users.find(u => u.username === uname);
            if (!user) throw new Error(`Пользователь ${uname} не найден`);
            participantIds.push(user.id);
        }

        const body = {
            type,
            participantIds
        };
        if (type === 'group') {
            if (!groupTitle.value.trim()) {
                showError(newChatError, 'Введите название группы');
                return;
            }
            body.title = groupTitle.value.trim();
        }

        const result = await apiRequest('/api/chats', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        newChatModal.classList.remove('show');
        await loadChats();
        if (result.chatId) {
            await selectChat(result.chatId);
        } else {
            showToast('Чат создан');
        }
    } catch (err) {
        showError(newChatError, err.message);
    }
});

// ==================== ВЫБОР ЧАТА ====================
async function selectChat(chatId) {
    if (currentChatId === chatId) return;

    if (ws && currentChatId) {
        ws.send(JSON.stringify({ type: 'leave', chatId: currentChatId }));
    }

    currentChatId = chatId;
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.toggle('active', item.dataset.chatId == chatId);
    });

    await loadMessages(chatId);

    if (ws) {
        ws.send(JSON.stringify({ type: 'join', chatId }));
    }

    showChatsMode();

    const chat = chats.find(c => c.id === chatId);
    chatTitle.textContent = chat?.title || 'Чат';
    document.getElementById('chat-actions').style.display = 'block';
    typingIndicator.textContent = '';
}

async function loadMessages(chatId) {
    try {
        const messages = await apiRequest(`/api/chats/${chatId}/messages?limit=50`);
        messagesContainer.innerHTML = '';
        messages.forEach(msg => displayMessage(msg));
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        if (ws && messages.length > 0) {
            const lastId = messages[messages.length-1].id;
            ws.send(JSON.stringify({ type: 'read', chatId, lastReadMessageId: lastId }));
        }
    } catch (err) {
        console.error('Failed to load messages', err);
        showToast('Не удалось загрузить сообщения', 'error');
    }
}

function displayMessage(msg) {
    const isOwn = msg.senderId === currentUser.id;
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isOwn ? 'own' : 'other'}`;
    msgDiv.dataset.messageId = msg.id;

    const info = document.createElement('div');
    info.className = 'message-info';
    info.textContent = isOwn ? 'Вы' : (msg.senderDisplayName || msg.senderUsername);

    const text = document.createElement('div');
    text.textContent = msg.text;

    const time = document.createElement('span');
    time.className = 'message-time';
    const d = new Date(msg.createdAt);
    time.textContent = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    if (msg.edited) {
        const editedSpan = document.createElement('span');
        editedSpan.textContent = ' (ред.)';
        editedSpan.style.fontSize = '11px';
        editedSpan.style.opacity = '0.7';
        time.appendChild(editedSpan);
    }

    info.appendChild(time);
    msgDiv.appendChild(info);
    msgDiv.appendChild(text);

    if (isOwn) {
        const actions = document.createElement('div');
        actions.className = 'message-actions';
        actions.innerHTML = `
            <button class="message-edit" title="Редактировать">✏️</button>
            <button class="message-delete" title="Удалить">🗑️</button>
        `;
        actions.querySelector('.message-edit').addEventListener('click', () => editMessage(msg.id, msg.text));
        actions.querySelector('.message-delete').addEventListener('click', () => deleteMessage(msg.id));
        msgDiv.appendChild(actions);
    }

    messagesContainer.appendChild(msgDiv);
}

function updateMessage(updatedMsg) {
    const oldMsgDiv = document.querySelector(`.message[data-message-id="${updatedMsg.id}"]`);
    if (oldMsgDiv) {
        oldMsgDiv.remove();
        displayMessage(updatedMsg);
    }
}

function removeMessage(messageId) {
    const msgDiv = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (msgDiv) msgDiv.remove();
}

async function editMessage(messageId, oldText) {
    const newText = prompt('Редактировать сообщение:', oldText);
    if (!newText || newText === oldText) return;
    try {
        await apiRequest(`/api/messages/${messageId}`, {
            method: 'PUT',
            body: JSON.stringify({ text: newText })
        });
    } catch (err) {
        showToast('Ошибка редактирования', 'error');
    }
}

async function deleteMessage(messageId) {
    if (!confirm('Удалить сообщение?')) return;
    try {
        await apiRequest(`/api/messages/${messageId}`, { method: 'DELETE' });
    } catch (err) {
        showToast('Ошибка удаления', 'error');
    }
}

function updateChatLastMessage(chatId, message) {
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
        chat.lastMessage = message;
        renderChats();
    }
}

// ==================== ОТПРАВКА СООБЩЕНИЯ ====================
async function sendMessage() {
    let text = messageInput.value.trim();
    if (!text) return;

    // Проверка на упоминание нового пользователя
    if (text.startsWith('@')) {
        const parts = text.split(' ');
        const mentionedUsername = parts[0].substring(1);
        const restText = parts.slice(1).join(' ');

        try {
            const users = await apiRequest('/api/users');
            const targetUser = users.find(u => u.username === mentionedUsername);
            if (!targetUser) {
                showToast(`Пользователь @${mentionedUsername} не найден`, 'error');
                return;
            }

            let existingChat = chats.find(chat => 
                chat.type === 'private' && 
                chat.participants?.some(p => p.id === targetUser.id)
            );

            if (!existingChat) {
                const result = await apiRequest('/api/chats', {
                    method: 'POST',
                    body: JSON.stringify({
                        type: 'private',
                        participantIds: [targetUser.id]
                    })
                });
                await loadChats();
                existingChat = chats.find(c => c.id === result.chatId);
                if (existingChat) {
                    await selectChat(result.chatId);
                }
            } else {
                if (currentChatId !== existingChat.id) {
                    await selectChat(existingChat.id);
                }
            }

            if (restText && existingChat) {
                await apiRequest('/api/messages', {
                    method: 'POST',
                    body: JSON.stringify({ chatId: existingChat.id, text: restText })
                });
            }
            messageInput.value = '';
        } catch (err) {
            showToast('Ошибка: ' + err.message, 'error');
        }
        return;
    }

    if (!currentChatId) return;
    try {
        await apiRequest('/api/messages', {
            method: 'POST',
            body: JSON.stringify({ chatId: currentChatId, text })
        });
        messageInput.value = '';
    } catch (err) {
        showToast('Ошибка отправки: ' + err.message, 'error');
    }
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        playClickSound();
        sendMessage();
    }
});

let typingTimer;
messageInput.addEventListener('input', () => {
    if (!ws || !currentChatId) return;
    clearTimeout(typingTimer);
    ws.send(JSON.stringify({ type: 'typing', chatId: currentChatId }));
    typingTimer = setTimeout(() => {}, 2000);
});

// ==================== БУРГЕР-МЕНЮ ====================
menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('show');
    playClickSound();
});

document.addEventListener('click', (e) => {
    if (!menuToggle.contains(e.target) && !dropdownMenu.contains(e.target)) {
        dropdownMenu.classList.remove('show');
    }
});

document.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
        playClickSound();
        const view = item.dataset.view;
        dropdownMenu.classList.remove('show');

        if (view === 'logout') {
            logout();
            return;
        }

        // Скрываем все панели и сообщения
        messagesContainer.style.display = 'none';
        messageInputArea.style.display = 'none';
        chatTitle.style.display = 'none';
        document.getElementById('chat-actions').style.display = 'none';
        typingIndicator.style.display = 'none';

        const allPanels = [
            profilePanel, notificationsPanel, privacyPanel, chatSettingsPanel,
            foldersPanel, accountPanel, appearancePanel, inactivityPanel
        ];
        allPanels.forEach(p => { if (p) p.style.display = 'none'; });

        let panelToShow = null;
        switch (view) {
            case 'profile': panelToShow = profilePanel; break;
            case 'notifications': panelToShow = notificationsPanel; break;
            case 'privacy': panelToShow = privacyPanel; break;
            case 'chat-settings': panelToShow = chatSettingsPanel; break;
            case 'folders': panelToShow = foldersPanel; loadFolders(); break;
            case 'account': panelToShow = accountPanel; break;
            case 'appearance': panelToShow = appearancePanel; break;
            case 'inactivity': panelToShow = inactivityPanel; break;
        }
        if (panelToShow) {
            panelToShow.style.display = 'flex';
            loadUserSettingsIntoPanels();
        }
    });
});

// ==================== РЕЖИМ ЧАТОВ ====================
function showChatsMode() {
    messagesContainer.style.display = 'flex';
    messageInputArea.style.display = currentChatId ? 'flex' : 'none';
    chatTitle.style.display = 'block';
    document.getElementById('chat-actions').style.display = currentChatId ? 'block' : 'none';
    typingIndicator.style.display = 'block';
    dropdownMenu.classList.remove('show');

    const allPanels = [
        profilePanel, notificationsPanel, privacyPanel, chatSettingsPanel,
        foldersPanel, accountPanel, appearancePanel, inactivityPanel
    ];
    allPanels.forEach(p => { if (p) p.style.display = 'none'; });
}

// ==================== ЗАГРУЗКА НАСТРОЕК В ПАНЕЛИ ====================
function loadUserSettingsIntoPanels() {
    if (!currentUser) return;

    // Профиль
    if (profileAvatar) profileAvatar.value = currentUser.avatar || '';
    if (profileDisplayName) profileDisplayName.value = currentUser.displayName || '';
    if (profilePhone) profilePhone.value = currentUser.phone || '';
    if (profileId) profileId.value = currentUser.id;
    if (profileBio) profileBio.value = currentUser.bio || '';

    // Уведомления
    const notif = currentUser.settings?.notifications || {};
    if (notifSound) notifSound.checked = notif.sound !== false;
    if (notifVibrate) notifVibrate.checked = notif.vibrate || false;
    if (notifPreview) notifPreview.checked = notif.preview !== false;
    if (notifDnd) notifDnd.checked = notif.dnd || false;

    // Конфиденциальность
    const priv = currentUser.settings?.privacy || {};
    if (privacyPhoneVisibility) privacyPhoneVisibility.value = priv.phoneVisibility || 'everyone';
    if (privacyLastseenVisibility) privacyLastseenVisibility.value = priv.lastseenVisibility || 'everyone';
    if (privacyWhoCanWrite) privacyWhoCanWrite.value = priv.whoCanWrite || 'everyone';
    if (privacyWhoCanInvite) privacyWhoCanInvite.value = priv.whoCanInvite || 'everyone';
    if (privacyForward) privacyForward.value = priv.forward || 'everyone';

    // Настройки чатов
    const chatSet = currentUser.settings?.chat || {};
    if (chatFontSize) chatFontSize.value = chatSet.fontSize || 16;
    if (chatWallpaper) chatWallpaper.value = chatSet.wallpaper || '';

    // Учётная запись
    const acc = currentUser.settings?.account || {};
    if (account2fa) account2fa.checked = acc.twoFA || false;
    if (twofaPasswordGroup) twofaPasswordGroup.style.display = acc.twoFA ? 'block' : 'none';

    // Внешний вид
    const app = currentUser.settings?.appearance || {};
    if (appearanceTheme) appearanceTheme.value = app.theme || currentTheme;
    if (appearanceMessageStyle) appearanceMessageStyle.value = app.messageStyle || 'rounded';
    if (appearanceFontSize) appearanceFontSize.value = app.fontSize || 16;

    // Неактивность
    const inact = currentUser.settings?.inactivity || {};
    if (inactivityPeriod) inactivityPeriod.value = inact.period || '0';
}

// ==================== СОХРАНЕНИЕ НАСТРОЕК ====================
async function saveSettings(panelType, data) {
    try {
        const updated = await apiRequest(`/api/users/${currentUser.id}`, {
            method: 'PUT',
            body: JSON.stringify({ settings: { ...currentUser.settings, [panelType]: data } })
        });
        currentUser = updated;
        showToast('Настройки сохранены');
        return true;
    } catch (err) {
        showToast('Ошибка сохранения: ' + err.message, 'error');
        return false;
    }
}

// Профиль
profileSave?.addEventListener('click', async () => {
    const profileData = {
        avatar: profileAvatar.value,
        displayName: profileDisplayName.value,
        phone: profilePhone.value,
        bio: profileBio.value
    };
    try {
        await apiRequest(`/api/users/${currentUser.id}`, {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
        currentUser = { ...currentUser, ...profileData };
        userDisplayName.textContent = profileData.displayName || currentUser.username;
        showToast('Профиль обновлён');
        profileError.textContent = '';
        showChatsMode();
    } catch (err) {
        showError(profileError, err.message);
    }
});

notificationsSave?.addEventListener('click', async () => {
    const data = {
        sound: notifSound.checked,
        vibrate: notifVibrate.checked,
        preview: notifPreview.checked,
        dnd: notifDnd.checked
    };
    if (await saveSettings('notifications', data)) {
        notificationsError.textContent = '';
        showChatsMode();
    }
});

privacySave?.addEventListener('click', async () => {
    const data = {
        phoneVisibility: privacyPhoneVisibility.value,
        lastseenVisibility: privacyLastseenVisibility.value,
        whoCanWrite: privacyWhoCanWrite.value,
        whoCanInvite: privacyWhoCanInvite.value,
        forward: privacyForward.value
    };
    if (await saveSettings('privacy', data)) {
        privacyError.textContent = '';
        showChatsMode();
    }
});

chatSettingsSave?.addEventListener('click', async () => {
    const data = {
        fontSize: parseInt(chatFontSize.value),
        wallpaper: chatWallpaper.value
    };
    if (await saveSettings('chat', data)) {
        chatSettingsError.textContent = '';
        showChatsMode();
    }
});

accountSave?.addEventListener('click', async () => {
    if (account2fa.checked) {
        if (!account2faPassword.value || account2faPassword.value !== account2faConfirm.value) {
            showError(accountError, 'Пароли не совпадают');
            return;
        }
        showToast('Двухэтапная проверка включена (демо)');
    }
    const data = {
        twoFA: account2fa.checked
    };
    if (await saveSettings('account', data)) {
        accountError.textContent = '';
        showChatsMode();
    }
});

appearanceSave?.addEventListener('click', async () => {
    const data = {
        theme: appearanceTheme.value,
        messageStyle: appearanceMessageStyle.value,
        fontSize: parseInt(appearanceFontSize.value)
    };
    applyTheme(data.theme);
    if (await saveSettings('appearance', data)) {
        appearanceError.textContent = '';
        showChatsMode();
    }
});

inactivitySave?.addEventListener('click', async () => {
    const data = {
        period: inactivityPeriod.value
    };
    if (await saveSettings('inactivity', data)) {
        inactivityError.textContent = '';
        showChatsMode();
    }
});

// Кнопки отмены
const cancelButtons = [
    profileCancel, notificationsCancel, privacyCancel, chatSettingsCancel,
    foldersCancel, accountCancel, appearanceCancel, inactivityCancel
];
cancelButtons.forEach(btn => {
    if (btn) {
        btn.addEventListener('click', () => {
            playClickSound();
            showChatsMode();
        });
    }
});

// ==================== ПАПКИ ====================
folderAddBtn?.addEventListener('click', () => {
    currentEditingFolderId = null;
    folderNameInput.value = '';
    populateFolderChatsSelection();
    document.getElementById('folder-modal-title').textContent = 'Новая папка';
    folderModal.classList.add('show');
});

function populateFolderChatsSelection(selectedChatIds = []) {
    if (!folderChatsSelection) return;
    folderChatsSelection.innerHTML = '';
    chats.forEach(chat => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = chat.id;
        checkbox.checked = selectedChatIds.includes(chat.id);
        let chatName = chat.title;
        if (!chatName && chat.type === 'private') {
            const other = chat.participants?.find(p => p.id !== currentUser.id);
            chatName = other?.displayName || other?.username || 'Личный чат';
        }
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(chatName || 'Чат'));
        folderChatsSelection.appendChild(label);
    });
}

folderModalSave?.addEventListener('click', async () => {
    const name = folderNameInput.value.trim();
    if (!name) {
        showError(document.getElementById('folder-modal-error'), 'Введите название папки');
        return;
    }

    const selectedChats = Array.from(folderChatsSelection.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));

    try {
        if (currentEditingFolderId) {
            await apiRequest(`/api/folders/${currentEditingFolderId}`, {
                method: 'PUT',
                body: JSON.stringify({ name, chats: selectedChats })
            });
        } else {
            await apiRequest('/api/folders', {
                method: 'POST',
                body: JSON.stringify({ name, chats: selectedChats })
            });
        }
        folderModal.classList.remove('show');
        loadFolders();
    } catch (err) {
        showError(document.getElementById('folder-modal-error'), err.message);
    }
});

folderModalCancel?.addEventListener('click', () => {
    folderModal.classList.remove('show');
});

let currentEditingFolderId = null;

async function editFolder(folderId) {
    const folder = folders.find(f => f.id == folderId);
    if (!folder) return;
    currentEditingFolderId = folderId;
    folderNameInput.value = folder.name;
    populateFolderChatsSelection(folder.chatIds || []);
    document.getElementById('folder-modal-title').textContent = 'Редактировать папку';
    folderModal.classList.add('show');
}

async function deleteFolder(folderId) {
    if (!confirm('Удалить папку?')) return;
    try {
        await apiRequest(`/api/folders/${folderId}`, { method: 'DELETE' });
        loadFolders();
    } catch (err) {
        showToast('Ошибка удаления папки', 'error');
    }
}

async function loadFolders() {
    try {
        folders = await apiRequest('/api/folders');
        renderFolders();
    } catch (err) {
        console.error('Failed to load folders', err);
    }
}

function renderFolders() {
    if (!foldersList) return;
    foldersList.innerHTML = '';
    folders.forEach(folder => {
        const folderDiv = document.createElement('div');
        folderDiv.className = 'folder-item';
        folderDiv.innerHTML = `
            <span class="folder-name">${folder.name}</span>
            <span class="folder-chats-count">${folder.chatIds?.length || 0} чатов</span>
            <button class="folder-edit" data-id="${folder.id}">✏️</button>
            <button class="folder-delete" data-id="${folder.id}">🗑️</button>
        `;
        foldersList.appendChild(folderDiv);
    });

    document.querySelectorAll('.folder-edit').forEach(btn => {
        btn.addEventListener('click', () => editFolder(btn.dataset.id));
    });
    document.querySelectorAll('.folder-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteFolder(btn.dataset.id));
    });
}

// ==================== ИНФОРМАЦИЯ О ЧАТЕ ====================
chatInfoBtn.addEventListener('click', async () => {
    if (!currentChatId) return;
    await loadChatInfo(currentChatId);
    chatInfoModal.classList.add('show');
});

async function loadChatInfo(chatId) {
    try {
        const chat = await apiRequest(`/api/chats/${chatId}`);
        chatInfoDetails.innerHTML = `
            <p><strong>Название:</strong> ${chat.title || '—'}</p>
            <p><strong>Тип:</strong> ${chat.type === 'private' ? 'Личный' : 'Группа'}</p>
            <p><strong>Описание:</strong> ${chat.description || '—'}</p>
            <p><strong>Создан:</strong> ${new Date(chat.createdAt).toLocaleString()}</p>
        `;
        chatParticipantsList.innerHTML = '<h3>Участники</h3>';
        chat.participants.forEach(p => {
            const div = document.createElement('div');
            div.className = 'participant-item';
            const online = p.online ? 'в сети' : 'офлайн';
            div.innerHTML = `
                <span>${p.displayName || p.username} ${p.id === currentUser.id ? '(Вы)' : ''}</span>
                <span class="participant-role">${p.role}</span>
                <span class="participant-status ${p.online ? 'online' : 'offline'}" id="participant-status-${p.id}">${online}</span>
            `;
            chatParticipantsList.appendChild(div);
        });
    } catch (err) {
        console.error(err);
    }
}

chatInfoClose.addEventListener('click', () => {
    chatInfoModal.classList.remove('show');
});

// ==================== ДОПОЛНИТЕЛЬНЫЕ КНОПКИ ====================
chatBackupBtn?.addEventListener('click', async () => {
    try {
        await apiRequest('/api/backup', { method: 'POST' });
        showToast('Резервная копия создана (демо)');
    } catch (err) {
        showToast('Ошибка', 'error');
    }
});

chatClearHistoryBtn?.addEventListener('click', async () => {
    if (!confirm('Очистить историю всех чатов?')) return;
    try {
        await apiRequest('/api/clear-history', { method: 'POST' });
        showToast('История очищена (демо)');
    } catch (err) {
        showToast('Ошибка', 'error');
    }
});

accountDelete?.addEventListener('click', async () => {
    if (!confirm('Вы уверены, что хотите удалить аккаунт? Это действие необратимо.')) return;
    try {
        await apiRequest('/api/account', { method: 'DELETE' });
        logout();
        showToast('Аккаунт удалён');
    } catch (err) {
        showToast('Ошибка удаления', 'error');
    }
});

accountChangePhone?.addEventListener('click', () => {
    showToast('Функция смены номера в разработке', 'info');
});

// ==================== ВЫХОД ====================
function logout() {
    localStorage.removeItem('token');
    token = null;
    if (ws) ws.close();
    mainView.style.display = 'none';
    authModal.classList.add('show');
    authUsername.value = '';
    authPassword.value = '';
    authDisplayName.value = '';
    authTitle.textContent = 'Вход';
    authSubmit.textContent = 'Войти';
    authToggle.textContent = 'Зарегистрироваться';
    authDisplayName.style.display = 'none';
    authSubmit.classList.remove('btn-secondary');
    authSubmit.classList.add('btn-primary');
    authToggle.classList.remove('btn-primary');
    authToggle.classList.add('btn-secondary');
    dropdownMenu.classList.remove('show');
    showToast('Вы вышли из системы');
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
(async function init() {
    if (token) {
        try {
            currentUser = await apiRequest('/api/auth/me');
            authModal.classList.remove('show');
            mainView.style.display = 'block';
            userDisplayName.textContent = currentUser.displayName || currentUser.username;
            userNameSpan.textContent = `@${currentUser.username}`;
            initWebSocket();
            loadChats();
            showChatsMode();
        } catch (err) {
            console.error('Token invalid', err);
            localStorage.removeItem('token');
            token = null;
            authModal.classList.add('show');
        }
    } else {
        authModal.classList.add('show');
    }

    soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    if (account2fa) {
        account2fa.addEventListener('change', () => {
            if (twofaPasswordGroup) twofaPasswordGroup.style.display = account2fa.checked ? 'block' : 'none';
        });
    }

    addClickSoundToButtons();
})();