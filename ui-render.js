// ui-render.js
let playersGrid, roundInfo, messageArea;

function showMessage(msg) {
    if (messageArea) messageArea.innerHTML = msg;
}

function render() {
    if (!playersGrid) return;
    playersGrid.innerHTML = '';
    for (let idx = 0; idx < players.length; idx++) {
        const p = players[idx];
        const isLocal = (isMultiplayer ? (idx === localPlayerId) : (idx === HUMAN_PLAYER));
        const isHuman = isLocal;
        const needPick = getNeedPickThisRound();
        const currentPlaced = isHuman ? getCurrentRoundPlacedCount(p) : 0;

        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-card';
        const header = document.createElement('div');
        header.className = 'player-header';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'player-name';
        nameSpan.textContent = p.name;
        nameSpan.style.cursor = 'pointer';
        nameSpan.title = '点击修改名字';
        nameSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            const newName = prompt('请输入新的玩家名称', p.name);
            if (newName && newName.trim()) {
                players[idx].name = newName.trim();
                render();
            }
        });

        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'player-score';
        scoreSpan.textContent = gameEnded ? p.finalScore : '';
        header.appendChild(nameSpan);
        header.appendChild(scoreSpan);

        const boardDiv = document.createElement('div');
        boardDiv.className = 'board';
        for (let rowIdx = 0; rowIdx < 3; rowIdx++) {
            const rowCards = p.rows[rowIdx];
            const cap = CAPACITIES[rowIdx];
            const rowDiv = document.createElement('div');
            rowDiv.className = 'row';
            rowDiv.innerHTML = `
                <div class="row-header">
                    <span>第${rowIdx+1}行 (${rowCards.length}/${cap})</span>
                </div>
                <div class="cards"></div>
            `;
            const cardsContainer = rowDiv.querySelector('.cards');

            if (rowCards.length === 0) {
                const emptyHint = document.createElement('div');
                emptyHint.style.width = '100%';
                emptyHint.style.textAlign = 'center';
                emptyHint.style.color = '#7f8c8d';
                emptyHint.innerText = '空';
                cardsContainer.appendChild(emptyHint);
            } else {
                for (let ci = 0; ci < rowCards.length; ci++) {
                    const card = rowCards[ci];
                    const cardRound = p.rowsRound[rowIdx][ci];
                    let shouldShow = false;
                    if (isHuman) {
                        shouldShow = true;
                    } else if (gameEnded) {
                        shouldShow = true;
                    } else if (roundRevealed) {
                        shouldShow = true;
                    } else if (cardRound < currentRound) {
                        shouldShow = true;
                    } else {
                        shouldShow = false;
                    }

                    if (shouldShow) {
                        const cardDiv = document.createElement('div');
                        cardDiv.className = 'card';
                        cardDiv.style.backgroundColor = getColorBg(card.color);
                        cardDiv.innerHTML = `<div class="card-number">${card.number}</div>`;
                        if (isHuman && !roundRevealed && !gameEnded && cardRound === currentRound) {
                            cardDiv.addEventListener('click', (e) => {
                                e.stopPropagation();
                                removeCardFromBoard(idx, rowIdx, ci);
                            });
                        }
                        cardsContainer.appendChild(cardDiv);
                    } else {
                        const hiddenDiv = document.createElement('div');
                        hiddenDiv.className = 'card';
                        hiddenDiv.style.backgroundColor = '#b0b0b0';
                        hiddenDiv.style.display = 'flex';
                        hiddenDiv.style.alignItems = 'center';
                        hiddenDiv.style.justifyContent = 'center';
                        hiddenDiv.innerHTML = '<span style="font-size:20px;">?</span>';
                        cardsContainer.appendChild(hiddenDiv);
                    }
                }
            }

            if (isHuman && !roundRevealed && !gameEnded) {
                rowDiv.addEventListener('click', (e) => {
                    e.stopPropagation();
                    placeCard(idx, rowIdx);
                });
            }
            boardDiv.appendChild(rowDiv);
        }

        // 手牌区域
        const handArea = document.createElement('div');
        handArea.className = 'hand-area';
        if (isHuman && !gameEnded) {
            const remainingPick = needPick - currentPlaced;
            const title = document.createElement('div');
            title.className = 'hand-title';
            if (!roundRevealed) {
                title.innerHTML = `🃏 当前手牌 <span class="place-status">(本轮还需放置 ${remainingPick} 张)</span>`;
            } else {
                title.innerHTML = `🃏 手牌 (已亮牌)`;
            }
            handArea.appendChild(title);
            const rowContainer = document.createElement('div');
            rowContainer.style.display = 'flex';
            rowContainer.style.alignItems = 'flex-start';
            rowContainer.style.gap = '20px';
            rowContainer.style.width = '100%';
            const handCardsDiv = document.createElement('div');
            handCardsDiv.className = 'hand-cards';
            handCardsDiv.style.flex = '1';
            if (!roundRevealed && p.hand.length > 0) {
                p.hand.forEach((card, hidx) => {
                    const cardDiv = document.createElement('div');
                    cardDiv.className = `hand-card ${p.selectedIndices.has(hidx) ? 'selected' : ''}`;
                    cardDiv.style.backgroundColor = getColorBg(card.color);
                    cardDiv.innerHTML = `<div class="card-number">${card.number}</div>`;
                    cardDiv.addEventListener('click', (e) => {
                        e.stopPropagation();
                        toggleSelectCard(idx, hidx);
                    });
                    handCardsDiv.appendChild(cardDiv);
                });
            } else if (!roundRevealed && p.hand.length === 0) {
                handCardsDiv.innerHTML = '<div style="color:#7f8c8d">无手牌</div>';
            } else if (roundRevealed) {
                handCardsDiv.innerHTML = '<div style="color:#7f8c8d">手牌已弃置</div>';
            }
            rowContainer.appendChild(handCardsDiv);

            const buttonColumn = document.createElement('div');
            buttonColumn.style.display = 'flex';
            buttonColumn.style.flexDirection = 'column';
            buttonColumn.style.gap = '10px';
            buttonColumn.style.alignItems = 'center';
            const actionBtn = document.createElement('button');
            if (!roundRevealed) {
                actionBtn.innerText = '✨ 亮牌';
                const canReveal = (!gameEnded && !roundRevealed && (currentPlaced === needPick));
                actionBtn.disabled = !canReveal;
                actionBtn.onclick = () => reveal();
            } else {
                actionBtn.innerText = '⏩ 下一轮';
                actionBtn.disabled = gameEnded;
                actionBtn.onclick = () => nextRound();
            }
            buttonColumn.appendChild(actionBtn);

            // 多人模式下，游戏结束后显示准备状态提示
            if (isMultiplayer && gameEnded) {
                const readySpan = document.createElement('div');
                readySpan.style.fontSize = '12px';
                readySpan.style.marginTop = '8px';
                readySpan.style.color = '#e67e22';
                readySpan.style.textAlign = 'center';
                if (resetReady[localPlayerId]) {
                    readySpan.innerText = '✅ 已准备，等待房主重置...';
                } else {
                    readySpan.innerText = isHost ? '点击「新的一局」重置游戏' : '点击「准备」重置游戏';
                }
                buttonColumn.appendChild(readySpan);
            }

            rowContainer.appendChild(buttonColumn);
            handArea.appendChild(rowContainer);
        } else {
            const title = document.createElement('div');
            title.className = 'hand-title';
            title.innerText = '🃏 手牌';
            handArea.appendChild(title);
            const placeholder = document.createElement('div');
            placeholder.style.color = '#7f8c8d';
            placeholder.innerText = roundRevealed ? (p.hand.length ? p.hand.map(c => c.toString()).join(', ') : '无') : '隐藏';
            handArea.appendChild(placeholder);
        }

        // 弃牌区
        const discardDiv = document.createElement('div');
        discardDiv.className = 'discard-area';
        discardDiv.innerHTML = `<strong>弃牌区</strong> (${p.discard.length}张)`;
        const discardCardsDiv = document.createElement('div');
        discardCardsDiv.className = 'discard-cards';
        if (isHuman || gameEnded) {
            for (let card of p.discard) {
                const cardDiv = document.createElement('div');
                cardDiv.className = 'discard-card';
                cardDiv.style.backgroundColor = getColorBg(card.color);
                cardDiv.innerHTML = `<div class="card-number" style="font-size:12px;">${card.number}</div>`;
                discardCardsDiv.appendChild(cardDiv);
            }
        } else {
            for (let i=0; i<p.discard.length; i++) {
                const cardDiv = document.createElement('div');
                cardDiv.className = 'discard-card hidden';
                cardDiv.innerText = '?';
                discardCardsDiv.appendChild(cardDiv);
            }
        }
        discardDiv.appendChild(discardCardsDiv);
        playerDiv.appendChild(header);
        playerDiv.appendChild(boardDiv);
        playerDiv.appendChild(handArea);
        playerDiv.appendChild(discardDiv);
        playersGrid.appendChild(playerDiv);
    }

    // 更新回合信息
    roundInfo.innerText = `第 ${currentRound+1} / 3 轮  ·  本轮需放置 ${ROUND_PICK[currentRound]} 张牌  (累计计分板 ${players[0]?.rows[0].length+players[0]?.rows[1].length+players[0]?.rows[2].length || 0}/8 张)`;
    if (gameEnded) roundInfo.innerText = '🏁 游戏终局 · 查看排名 🏁';

    // 更新重置按钮的文字和状态
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        if (isMultiplayer && gameEnded) {
            // 游戏结束且多人模式
            if (isHost) {
                resetBtn.innerText = '新的一局';
            } else {
                resetBtn.innerText = '准备';
            }
            // 如果已经准备过，按钮禁用；否则启用
            if (resetReady[localPlayerId]) {
                resetBtn.disabled = true;
            } else {
                resetBtn.disabled = false;
            }
            console.log(`[UI] 游戏结束，按钮文字: ${resetBtn.innerText}, 已准备: ${resetReady[localPlayerId]}`);
        } else {
            // 非游戏结束或单机模式，显示“新的一局”
            resetBtn.innerText = '新的一局';
            resetBtn.disabled = false;
        }
    }
}

// 以下为玩家操作函数，与原版一致，支持单机/联机
function placeCard(playerIdx, rowIdx) {
    if (gameEnded) return false;
    if (isMultiplayer && playerIdx !== localPlayerId) return false;
    if (!isMultiplayer && playerIdx !== HUMAN_PLAYER) return false;

    const p = players[playerIdx];
    if (roundRevealed) {
        showMessage("本轮已亮牌，无法再修改。");
        return false;
    }
    if (p.selectedIndices.size === 0) {
        showMessage("请先点击手牌选择要放置的牌。");
        return false;
    }
    if (p.rows[rowIdx].length >= CAPACITIES[rowIdx]) {
        showMessage(`第${rowIdx+1}行已满 (容量 ${CAPACITIES[rowIdx]})。`);
        return false;
    }

    const currentPlaced = getCurrentRoundPlacedCount(p);
    const needPick = getNeedPickThisRound();
    if (currentPlaced >= needPick) {
        showMessage(`本轮已放置 ${needPick} 张牌，不能再放置。如需调整请先取下本轮放置的牌。`);
        return false;
    }

    const selectedIdx = Array.from(p.selectedIndices)[0];
    const card = p.hand[selectedIdx];
    
    if (isMultiplayer) {
        sendAction('place', { rowIdx, cardIdx: selectedIdx, card: card.clone() });
    } else {
        p.rows[rowIdx].push(card.clone());
        p.rowsRound[rowIdx].push(currentRound);
        p.hand.splice(selectedIdx, 1);
        p.selectedIndices.clear();
        syncRoundPlacedCount(p);
        render();
        const newPlaced = getCurrentRoundPlacedCount(p);
        if (newPlaced === needPick) {
            showMessage(`✅ 本轮已放置 ${needPick} 张牌！点击「亮牌」继续。`);
        } else {
            showMessage(`已放置 ${newPlaced}/${needPick} 张，请继续放置或调整。`);
        }
    }
    return true;
}

function removeCardFromBoard(playerIdx, rowIdx, cardIndex) {
    if (gameEnded) return false;
    if (isMultiplayer && playerIdx !== localPlayerId) return false;
    if (!isMultiplayer && playerIdx !== HUMAN_PLAYER) return false;
    const p = players[playerIdx];
    if (roundRevealed) {
        showMessage("本轮已亮牌，无法再修改。");
        return false;
    }
    if (p.rowsRound[rowIdx][cardIndex] !== currentRound) {
        showMessage("只能取下本轮刚放置的牌。");
        return false;
    }
    if (isMultiplayer) {
        sendAction('remove', { rowIdx, cardIndex });
    } else {
        const removedCard = p.rows[rowIdx][cardIndex];
        p.rows[rowIdx].splice(cardIndex, 1);
        p.rowsRound[rowIdx].splice(cardIndex, 1);
        p.hand.push(removedCard);
        p.selectedIndices.clear();
        syncRoundPlacedCount(p);
        render();
        const needPick = getNeedPickThisRound();
        const cur = getCurrentRoundPlacedCount(p);
        showMessage(`已取下 ${removedCard}，还需放置 ${needPick - cur} 张。`);
    }
    return true;
}

function toggleSelectCard(playerIdx, idx) {
    if (gameEnded) return;
    if (isMultiplayer && playerIdx !== localPlayerId) return;
    if (!isMultiplayer && playerIdx !== HUMAN_PLAYER) return;
    const p = players[playerIdx];
    if (roundRevealed) {
        showMessage("本轮已亮牌，无法再修改手牌。");
        return;
    }
    const currentPlaced = getCurrentRoundPlacedCount(p);
    const needPick = getNeedPickThisRound();
    const canPick = needPick - currentPlaced;
    if (canPick <= 0 && !p.selectedIndices.has(idx)) {
        showMessage(`本轮已放满 ${needPick} 张，不能再添加新牌。如需更换请先取下计分板上的牌。`);
        return;
    }
    if (p.selectedIndices.has(idx)) {
        p.selectedIndices.delete(idx);
    } else {
        if (p.selectedIndices.size >= 1) {
            showMessage("每次只能选择一张牌放置，请先取消当前选中或放置后再选。");
            return;
        }
        p.selectedIndices.add(idx);
    }
    render();
}

function reveal() {
    if (gameEnded) return;
    if (roundRevealed) return;
    const playerIdx = isMultiplayer ? localPlayerId : HUMAN_PLAYER;
    const p = players[playerIdx];
    const needPick = getNeedPickThisRound();
    const placedNow = getCurrentRoundPlacedCount(p);
    if (placedNow !== needPick) {
        showMessage(`请先放置完本轮需要的 ${needPick} 张牌（当前已放置 ${placedNow} 张）。`);
        return;
    }
    if (isMultiplayer) {
        sendAction('reveal', {});
    } else {
        revealSingle();
    }
}

function nextRound() {
    if (gameEnded) return;
    if (!roundRevealed) {
        showMessage("请先点击「亮牌」完成本轮。");
        return;
    }
    if (isMultiplayer) {
        sendAction('nextRoundReady', {});
    } else {
        nextRoundSingle();
    }
}