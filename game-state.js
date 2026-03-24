// game-state.js
let deck = [];
let players = [];
let currentRound = 0;
let roundRevealed = false;
let gameEnded = false;
let isMultiplayer = false;
let localPlayerId = -1;
let isHost = false;
let revealReady = [];
let nextRoundReady = [];
const HUMAN_PLAYER = 0;
let resetReady = [];  // 放在全局变量区域，新的一局用的

function getNeedPickThisRound() { return ROUND_PICK[currentRound]; }

function getCurrentRoundPlacedCount(player) {
    let count = 0;
    for (let i=0; i<3; i++) {
        for (let round of player.rowsRound[i]) {
            if (round === currentRound) count++;
        }
    }
    return count;
}

function syncRoundPlacedCount(player) {
    player.roundPlacedCount = getCurrentRoundPlacedCount(player);
}

function createDeck() {
    let d = [];
    for (let color of COLORS) {
        for (let num of NUMBERS) {
            d.push(new Card(color, num));
        }
    }
    for (let i = d.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
}

function initPlayers(realPlayerCount = 0) {
    resetReady = new Array(PLAYER_COUNT).fill(false);
    players = [];
    for (let i=0; i<PLAYER_COUNT; i++) {
        let isAI = true;
        let name = `AI ${i+1}`;
        if (i < realPlayerCount) {
            isAI = false;
            name = `玩家${i+1}`;
        }
        players.push({
            id: i,
            name: name,
            rows: [[],[],[]],
            rowsRound: [[],[],[]],
            hand: [],
            discard: [],
            selectedIndices: new Set(),
            finalScore: 0,
            isAI: isAI,
            roundPlacedCount: 0
        });
    }
    revealReady = new Array(PLAYER_COUNT).fill(false);
    nextRoundReady = new Array(PLAYER_COUNT).fill(false);
}

function dealRound() {
    const draw = ROUND_DRAW[currentRound];
    for (let p of players) {
        p.hand = [];
        for (let i=0; i<draw; i++) {
            if (deck.length === 0) break;
            p.hand.push(deck.pop());
        }
        p.selectedIndices.clear();
        p.roundPlacedCount = 0;
    }
}

function simulateAdd(row, card) {
    const originalScore = evaluateRow(row).score;
    const newRow = [...row, card.clone()];
    newRow.sort((a,b)=>a.number - b.number);
    const newScore = evaluateRow(newRow).score;
    return newScore - originalScore;
}

function aiPlaceAll() {
    for (let p of players) {
        if (!p.isAI) continue;
        const needPick = getNeedPickThisRound();
        let currentPlaced = 0;
        for (let i=0; i<3; i++) {
            for (let r of p.rowsRound[i]) {
                if (r === currentRound) currentPlaced++;
            }
        }
        let toPlace = needPick - currentPlaced;
        if (toPlace <= 0) continue;
        while (toPlace > 0 && p.hand.length > 0) {
            let bestGain = -Infinity;
            let bestCardIdx = -1;
            let bestRowIdx = -1;
            for (let ci=0; ci<p.hand.length; ci++) {
                const card = p.hand[ci];
                for (let ri=0; ri<3; ri++) {
                    if (p.rows[ri].length >= CAPACITIES[ri]) continue;
                    const gain = simulateAdd(p.rows[ri], card);
                    if (gain > bestGain) {
                        bestGain = gain;
                        bestCardIdx = ci;
                        bestRowIdx = ri;
                    }
                }
            }
            if (bestCardIdx === -1) {
                for (let ci=0; ci<p.hand.length; ci++) {
                    for (let ri=0; ri<3; ri++) {
                        if (p.rows[ri].length < CAPACITIES[ri]) {
                            bestCardIdx = ci;
                            bestRowIdx = ri;
                            break;
                        }
                    }
                    if (bestCardIdx !== -1) break;
                }
            }
            if (bestCardIdx === -1) break;
            const card = p.hand[bestCardIdx];
            p.rows[bestRowIdx].push(card.clone());
            p.rowsRound[bestRowIdx].push(currentRound);
            p.hand.splice(bestCardIdx, 1);
            toPlace--;
        }
    }
}

function resetGame() {
    deck = createDeck();
    initPlayers(1);
    currentRound = 0;
    roundRevealed = false;
    gameEnded = false;
    dealRound();
    if (typeof render === 'function') render();
    if (typeof showMessage === 'function') showMessage("✅ 第1轮：点击手牌选中牌，再点击任意行放置。");
}

function revealSingle() {
    if (gameEnded) return;
    const human = players[HUMAN_PLAYER];
    const needPick = getNeedPickThisRound();
    const placedNow = getCurrentRoundPlacedCount(human);
    if (placedNow !== needPick) {
        if (typeof showMessage === 'function') showMessage(`请先放置完本轮需要的 ${needPick} 张牌（当前已放置 ${placedNow} 张）。`);
        return;
    }
    if (roundRevealed) return;
    aiPlaceAll();
    for (let p of players) {
        for (let card of p.hand) {
            p.discard.push(card);
        }
        p.hand = [];
        p.selectedIndices.clear();
    }
    roundRevealed = true;
    if (currentRound + 1 >= ROUNDS) {
        finalizeGame();
    } else {
        if (typeof showMessage === 'function') showMessage(`✨ 第${currentRound+1}轮亮牌完成！点击「下一轮」继续。`);
        if (typeof render === 'function') render();
    }
}

function nextRoundSingle() {
    if (gameEnded) return;
    if (!roundRevealed) {
        if (typeof showMessage === 'function') showMessage("请先点击「亮牌」完成本轮。");
        return;
    }
    if (currentRound + 1 >= ROUNDS) {
        finalizeGame();
        return;
    }
    currentRound++;
    roundRevealed = false;
    for (let p of players) {
        if (!p.isAI) p.roundPlacedCount = 0;
    }
    dealRound();
    if (typeof render === 'function') render();
    const needPick = getNeedPickThisRound();
    if (typeof showMessage === 'function') showMessage(`🎲 第${currentRound+1}轮开始，请从 ${ROUND_DRAW[currentRound]} 张手牌中选择 ${needPick} 张放入计分板。`);
}

function finalizeGame() {
    gameEnded = true;
    for (let p of players) {
        p.finalScore = calculatePlayerScore(p.rows);
    }
    const sorted = [...players].sort((a,b) => b.finalScore - a.finalScore);
    let resultMsg = "🏆 游戏结束！最终排名 🏆\n";
    let rank = 1;
    let lastScore = null;
    for (let i = 0; i < sorted.length; i++) {
        const p = sorted[i];
        if (lastScore !== null && p.finalScore !== lastScore) {
            rank = i + 1;
        }
        resultMsg += `第${rank}名： ${p.name} : ${p.finalScore} 分\n`;
        lastScore = p.finalScore;
    }
    alert(resultMsg);
    if (typeof render === 'function') render();
}

function resetGameMultiplayer() {
    resetReady.fill(false);
    deck = createDeck();
    for (let p of players) {
        p.rows = [[],[],[]];
        p.rowsRound = [[],[],[]];
        p.hand = [];
        p.discard = [];
        p.selectedIndices.clear();
        p.finalScore = 0;
        p.roundPlacedCount = 0;
    }
    currentRound = 0;
    roundRevealed = false;
    gameEnded = false;
    revealReady.fill(false);
    nextRoundReady.fill(false);
    dealRound();
    if (typeof render === 'function') render();
    if (typeof showMessage === 'function') showMessage(`第1轮开始，请放置${ROUND_PICK[0]}张牌。`);
}

function hostProcessPlace(playerId, { rowIdx, cardIdx, card }) {
    const p = players[playerId];
    console.log(`[HOST] hostProcessPlace: player ${playerId}, hand length before: ${p.hand.length}, cardIdx: ${cardIdx}`);
    if (roundRevealed) return false;
    if (p.rows[rowIdx].length >= CAPACITIES[rowIdx]) return false;
    const currentPlaced = getCurrentRoundPlacedCount(p);
    const needPick = getNeedPickThisRound();
    if (currentPlaced >= needPick) return false;
    const newCard = card instanceof Card ? card.clone() : new Card(card.color, card.number);
    p.rows[rowIdx].push(newCard);
    p.rowsRound[rowIdx].push(currentRound);
    p.hand.splice(cardIdx, 1);
    p.selectedIndices.clear();
    syncRoundPlacedCount(p);
    console.log(`[HOST] after splice, hand length: ${p.hand.length}`);
    return true;
}

function hostProcessRemove(playerId, { rowIdx, cardIndex }) {
    const p = players[playerId];
    if (roundRevealed) return false;
    if (p.rowsRound[rowIdx][cardIndex] !== currentRound) return false;
    const removedCard = p.rows[rowIdx][cardIndex];
    p.rows[rowIdx].splice(cardIndex, 1);
    p.rowsRound[rowIdx].splice(cardIndex, 1);
    p.hand.push(removedCard);
    p.selectedIndices.clear();
    syncRoundPlacedCount(p);
    return true;
}
s
function hostProcessReveal(playerId) {
    const p = players[playerId];
    const needPick = getNeedPickThisRound();
    const placedNow = getCurrentRoundPlacedCount(p);
    if (placedNow !== needPick) return false;
    if (revealReady[playerId]) return false;
    revealReady[playerId] = true;
    const allRealReady = players.every((p, idx) => p.isAI || revealReady[idx]);
    if (allRealReady) {
        aiPlaceAll();
        for (let p of players) {
            for (let card of p.hand) {
                p.discard.push(card);
            }
            p.hand = [];
            p.selectedIndices.clear();
        }
        roundRevealed = true;
        return true;   // 告诉 multiplayer.js 所有玩家已亮牌
    }
    return false;
}

function hostProcessNextReady(playerId) {
    console.log(`[HOST] hostProcessNextReady: playerId=${playerId}, roundRevealed=${roundRevealed}, gameEnded=${gameEnded}, nextRoundReady before:`, [...nextRoundReady]);
    if (!roundRevealed || gameEnded) {
        console.log('[HOST] early return: roundRevealed or gameEnded false');
        return false;
    }
    if (nextRoundReady[playerId]) {
        console.log('[HOST] player already ready, return');
        return false;
    }
    nextRoundReady[playerId] = true;
    console.log('[HOST] nextRoundReady after set:', [...nextRoundReady]);

    const allRealReady = players.every((p, idx) => p.isAI || nextRoundReady[idx]);
    console.log('[HOST] allRealReady =', allRealReady);

    if (allRealReady) {
        if (currentRound + 1 >= ROUNDS) {
            console.log('[HOST] finalizeGameMultiplayer called');
            finalizeGameMultiplayer();
        } else {
            console.log('[HOST] startNextRoundMultiplayer called');
            startNextRoundMultiplayer();
        }
        return true;
    }
    return false;
}

function startNextRoundMultiplayer() {
    console.log(`[HOST] startNextRoundMultiplayer: currentRound from ${currentRound} to ${currentRound+1}`);
    currentRound++;
    roundRevealed = false;
    revealReady.fill(false);
    nextRoundReady.fill(false);
    console.log('[HOST] after reset, nextRoundReady:', [...nextRoundReady]);
    dealRound();
    if (typeof render === 'function') render();
    if (typeof showMessage === 'function') showMessage(`第${currentRound+1}轮开始，请放置${ROUND_PICK[currentRound]}张牌。`);
    broadcastState(); 
}

function finalizeGameMultiplayer() {
    gameEnded = true;
    for (let p of players) {
        p.finalScore = calculatePlayerScore(p.rows);
    }
    if (typeof render === 'function') render();
    // 先广播最终状态，让客机同步
    if (typeof broadcastState === 'function') broadcastState();
    // 然后主机自己弹窗（使用 setTimeout 避免阻塞）
    setTimeout(() => {
        const sorted = [...players].sort((a,b) => b.finalScore - a.finalScore);
        let resultMsg = "🏆 游戏结束！最终排名 🏆\n";
        let rank = 1, lastScore = null;
        for (let i=0; i<sorted.length; i++) {
            if (lastScore !== null && sorted[i].finalScore !== lastScore) rank = i+1;
            resultMsg += `第${rank}名： ${sorted[i].name} : ${sorted[i].finalScore} 分\n`;
            lastScore = sorted[i].finalScore;
        }
        alert(resultMsg);
    }, 100);
}