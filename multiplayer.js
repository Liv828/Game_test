let peer = null;
let conn = null;
let connections = [];
let hasShownResult = false;

const MSG_TYPES = {
    JOIN: 'join',
    STATE: 'state',
    PLACE: 'place',
    REMOVE: 'remove',
    REVEAL: 'reveal',
    NEXT_READY: 'nextRoundReady',
    RESET_READY: 'resetReady'
};

function createRoom() {
    console.log('创建房间...');
    peer = new Peer(undefined, {
        host: 'peerjs-server.herokuapp.com',
        port: 443,
        secure: true
    });
    peer.on('open', (id) => {
        roomId = id;
        isHost = true;
        isMultiplayer = true;
        localPlayerId = 0;
        initPlayers(1);
        revealReady.fill(false);
        nextRoundReady.fill(false);
        resetReady.fill(false);          // 初始化重置就绪数组
        resetGameMultiplayer();
        document.getElementById('roomIdInput').value = roomId;
        showMessage(`房间创建成功，房间号：${roomId}，等待其他玩家加入...`);
        peer.on('connection', handleConnection);
        document.getElementById('hostBtn').disabled = true;
        document.getElementById('joinBtn').disabled = false;
        // 房主的重置按钮不禁用
    });
    peer.on('error', (err) => {
        console.error('Peer error:', err);
        showMessage('连接失败：' + err.message);
    });
}

function joinRoom(roomId) {
    console.log('加入房间:', roomId);
    peer = new Peer(undefined, {
        host: 'peerjs-server.webrtc.cn',
        port: 443,
        secure: true
        });
    peer.on('open', () => {
        conn = peer.connect(roomId);
        conn.on('open', () => {
            isHost = false;
            isMultiplayer = true;
            conn.send({ type: MSG_TYPES.JOIN });
            conn.on('data', handleMessageFromHost);
            showMessage('已加入房间，等待游戏开始...');
            document.getElementById('hostBtn').disabled = false;
            document.getElementById('joinBtn').disabled = true;
            document.getElementById('resetBtn').disabled = false;   // 客机重置按钮启用（但点击后只发送准备）
        });
        conn.on('error', (err) => {
            console.error('Connection error:', err);
            showMessage('连接错误');
        });
    });
    peer.on('error', (err) => {
        console.error('Peer error:', err);
        showMessage('连接失败');
    });
}

function handleConnection(connection) {
    const newPlayerId = connections.length + 1;
    if (newPlayerId >= PLAYER_COUNT) {
        connection.send({ type: 'error', message: '房间已满' });
        connection.close();
        return;
    }
    connections.push({ conn: connection, playerId: newPlayerId });

    connection.on('data', (data) => {
        const { type, payload } = data;
        const entry = connections.find(c => c.conn === connection);
        if (!entry) return;
        const playerId = entry.playerId;

        switch (type) {
            case MSG_TYPES.JOIN:
                players[playerId].isAI = false;
                players[playerId].name = `玩家${playerId + 1}`;
                const stateForNewPlayer = serializeGameStateForPlayer(playerId);
                stateForNewPlayer.localPlayerId = playerId;
                connection.send({ type: MSG_TYPES.STATE, payload: stateForNewPlayer });
                broadcastState();
                break;
            case MSG_TYPES.PLACE:
                if (roundRevealed) return;
                if (hostProcessPlace(playerId, payload)) broadcastState();
                break;
            case MSG_TYPES.REMOVE:
                if (roundRevealed) return;
                if (hostProcessRemove(playerId, payload)) broadcastState();
                break;
            case MSG_TYPES.REVEAL:
                if (roundRevealed) return;
                const allReady = hostProcessReveal(playerId);
                if (allReady) {
                    roundRevealed = true;
                    broadcastState();
                    showMessage('所有玩家已亮牌，现在可以查看所有计分板。');
                    if (currentRound === ROUNDS - 1) {
                        finalizeGameMultiplayer();
                    }
                } else {
                    broadcastState();
                }
                break;
            case MSG_TYPES.NEXT_READY:
                if (!roundRevealed) return;
                const nextAllReady = hostProcessNextReady(playerId);
                if (nextAllReady) broadcastState();
                else broadcastState();
                break;
            case MSG_TYPES.RESET_READY:
                if (!isHost) return;
                if (resetReady[playerId]) return;
                resetReady[playerId] = true;
                const allResetReady = players.every((p, idx) => p.isAI || resetReady[idx]);
                if (allResetReady) {
                    resetGameMultiplayer();
                    broadcastState();
                    resetReady.fill(false);
                    showMessage('所有玩家已准备，游戏重置！');
                } else {
                    broadcastState();
                }
                break;
        }
    });
}

function broadcastState() {
    for (let { conn, playerId } of connections) {
        const filtered = serializeGameStateForPlayer(playerId);
        filtered.localPlayerId = playerId;
        conn.send({ type: MSG_TYPES.STATE, payload: filtered });
    }
    // 主机直接渲染（避免 applyGameState 覆盖）
    render();
}

function serializeGameStateForPlayer(viewerId) {
    const visiblePlayers = players.map((p, idx) => {
        const isSelf = (idx === viewerId);
        return {
            id: p.id,
            name: p.name,
            rows: p.rows.map(r => r.map(c => ({ color: c.color, number: c.number }))),
            rowsRound: p.rowsRound,
            hand: isSelf ? p.hand.map(c => ({ color: c.color, number: c.number })) : [],
            discard: isSelf ? p.discard.map(c => ({ color: c.color, number: c.number })) : [],
            isAI: p.isAI,
            roundPlacedCount: p.roundPlacedCount,
            finalScore: p.finalScore,
            selectedIndices: []
        };
    });
    return {
        players: visiblePlayers,
        currentRound,
        roundRevealed,
        gameEnded,
        revealReady,
        nextRoundReady,
        resetReady      // 必须包含重置就绪数组
    };
}

function applyGameState(state) {
    players = state.players.map(p => ({
        ...p,
        rows: p.rows.map(r => r.map(c => new Card(c.color, c.number))),
        hand: p.hand.map(c => new Card(c.color, c.number)),
        discard: p.discard.map(c => new Card(c.color, c.number)),
        finalScore: p.finalScore,
        selectedIndices: new Set()
    }));
    currentRound = state.currentRound;
    roundRevealed = state.roundRevealed;
    gameEnded = state.gameEnded;
    revealReady = state.revealReady;
    nextRoundReady = state.nextRoundReady;
    resetReady = state.resetReady;      // 更新重置就绪数组

    if (state.localPlayerId !== undefined) {
        localPlayerId = state.localPlayerId;
        console.log('✅ applyGameState 设置 localPlayerId =', localPlayerId);
    }

    // 重置弹窗标志（游戏未结束时）
    if (!state.gameEnded) {
        hasShownResult = false;
    }
    // 游戏结束且未弹窗时显示排名
    if (state.gameEnded && !hasShownResult) {
        hasShownResult = true;
        const sorted = [...players].sort((a,b) => b.finalScore - a.finalScore);
        let resultMsg = "🏆 游戏结束！最终排名 🏆\n";
        let rank = 1, lastScore = null;
        for (let i=0; i<sorted.length; i++) {
            if (lastScore !== null && sorted[i].finalScore !== lastScore) rank = i+1;
            resultMsg += `第${rank}名： ${sorted[i].name} : ${sorted[i].finalScore} 分\n`;
            lastScore = sorted[i].finalScore;
        }
        alert(resultMsg);
    }

    console.log(`本地玩家手牌长度: ${players[localPlayerId]?.hand?.length}`);
    render();
}

function handleMessageFromHost(data) {
    const { type, payload } = data;
    if (type === MSG_TYPES.STATE) {
        applyGameState(payload);
    }
}

function sendAction(type, payload) {
    console.log('sendAction:', type, payload);
    if (isHost) {
        const playerId = localPlayerId;
        switch (type) {
            case 'place':
                if (hostProcessPlace(playerId, payload)) broadcastState();
                break;
            case 'remove':
                if (hostProcessRemove(playerId, payload)) broadcastState();
                break;
            case 'reveal':
                const allReady = hostProcessReveal(playerId);
                if (allReady) {
                    roundRevealed = true;
                    broadcastState();
                    showMessage('所有玩家已亮牌，现在可以查看所有计分板。');
                } else {
                    broadcastState();
                }
                break;
            case 'nextRoundReady':
                const nextAllReady = hostProcessNextReady(playerId);
                if (nextAllReady) broadcastState();
                else broadcastState();
                break;
            case 'resetReady':
                if (resetReady[playerId]) return;
                resetReady[playerId] = true;
                const allResetReady = players.every((p, idx) => p.isAI || resetReady[idx]);
                if (allResetReady) {
                    resetGameMultiplayer();
                    broadcastState();
                    resetReady.fill(false);
                    showMessage('所有玩家已准备，游戏重置！');
                } else {
                    broadcastState();
                }
                break;
        }
    } else {
        if (conn && conn.open) {
            conn.send({ type, payload });
        } else {
            console.warn('连接未建立，无法发送消息');
        }
    }
}

function getPlayerIdByConnection(conn) {
    const entry = connections.find(c => c.conn === conn);
    return entry ? entry.playerId : -1;
}
