// main.js
document.addEventListener('DOMContentLoaded', () => {
    playersGrid = document.getElementById('playersGrid');
    roundInfo = document.getElementById('roundInfo');
    messageArea = document.getElementById('messageArea');
    const hostBtn = document.getElementById('hostBtn');
    const joinBtn = document.getElementById('joinBtn');
    const roomIdInput = document.getElementById('roomIdInput');
    const resetBtn = document.getElementById('resetBtn');

    resetBtn.addEventListener('click', () => {
        if (isMultiplayer) {
            // 发送准备重置消息
            sendAction('resetReady', {});
            resetBtn.disabled = true;
            showMessage('已发送重置请求，等待其他玩家准备...');
        } else {
            resetGame();
        }
         });

    hostBtn.addEventListener('click', () => {
        if (typeof createRoom === 'function') {
            createRoom();
        } else {
            showMessage('multiplayer.js 未加载或 createRoom 未定义');
        }
    });

    joinBtn.addEventListener('click', () => {
        const roomId = roomIdInput.value.trim();
        if (roomId) {
            if (typeof joinRoom === 'function') {
                joinRoom(roomId);
            } else {
                showMessage('multiplayer.js 未加载或 joinRoom 未定义');
            }
        } else {
            showMessage('请输入房间号');
        }
    });

    if (!isMultiplayer) {
        resetGame();
    }
});