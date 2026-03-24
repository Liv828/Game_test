// game-core.js

// ---------- 游戏常量 ----------
const PLAYER_COUNT = 6;
const COLORS = ["红","橙","黄","绿","青","蓝","紫","粉","棕","灰"];
const NUMBERS = [1,2,3,4,5,6,7,8,9];
const CAPACITIES = [2,3,3];
const ROUNDS = 3;
const ROUND_DRAW = [4,4,3];
const ROUND_PICK = [3,3,2];
const TYPE_STRENGTH = {
    "高牌": 0, "对子": 1, "顺子": 2, "三条": 3, "同色": 4, "同花顺": 5
};

// ---------- Card 类 ----------
class Card {
    constructor(color, number) {
        this.color = color;
        this.number = number;
    }
    clone() { return new Card(this.color, this.number); }
    toString() { return `${this.color}${this.number}`; }
}

// ---------- 辅助函数 ----------
function getColorBg(color) {
    const map = {
        "红": "#ffcccc", "橙": "#ffe0cc", "黄": "#ffffcc", "绿": "#ccffcc",
        "青": "#ccffff", "蓝": "#ccccff", "紫": "#e0ccff", "粉": "#ffccff",
        "棕": "#e0ccb3", "灰": "#e0e0e0"
    };
    return map[color] || "#ffffff";
}

// ---------- 牌型评估 ----------
function evaluateRow(cards) {
    if (cards.length === 0) return { type: "高牌", score: 0, details: {} };
    const n = cards.length;
    const numbers = cards.map(c => c.number);
    const colors = cards.map(c => c.color);
    const sortedNums = [...numbers].sort((a,b)=>a-b);

    if (n === 2) {
        if (cards[0].number === cards[1].number) {
            const pairValue = cards[0].number;
            const score = pairValue;
            return { type: "对子", score: score, details: { pairValue, third: null } };
        }
        return { type: "高牌", score: 0, details: {} };
    } else if (n === 3) {
        // 同花顺
        if (new Set(colors).size === 1 && sortedNums[2] - sortedNums[0] === 2 && new Set(numbers).size === 3)
            return { type: "同花顺", score: 10, details: { maxNum: sortedNums[2] } };
        // 同色
        else if (new Set(colors).size === 1)
            return { type: "同色", score: 7, details: { maxNum: sortedNums[2] } };
        // 三条
        else if (new Set(numbers).size === 1)
            return { type: "三条", score: 5, details: { tripleValue: numbers[0] } };
        // 顺子
        else if (sortedNums[1] === sortedNums[0]+1 && sortedNums[2] === sortedNums[1]+1)
            return { type: "顺子", score: 3, details: { maxNum: sortedNums[2] } };
        // 对子
        const count = {};
        numbers.forEach(n => count[n] = (count[n]||0)+1);
        for (let [num, cnt] of Object.entries(count)) {
            if (cnt === 2) {
                const other = numbers.find(n => n != num);
                return { type: "对子", score: 2 , details: { pairValue: parseInt(num), third: other } };
            }
        }
        return { type: "高牌", score: 0, details: { maxNum: sortedNums[2] } };
    }
    return { type: "高牌", score: 0 };
}

function compareRows(rowA, rowB) {
    const evalA = evaluateRow(rowA);
    const evalB = evaluateRow(rowB);
    if (TYPE_STRENGTH[evalA.type] !== TYPE_STRENGTH[evalB.type]) {
        return TYPE_STRENGTH[evalA.type] - TYPE_STRENGTH[evalB.type];
    }
    if (evalA.type === "对子") {
        if (evalA.details.pairValue !== evalB.details.pairValue)
            return evalA.details.pairValue - evalB.details.pairValue;
        const thirdA = evalA.details.third || 0;
        const thirdB = evalB.details.third || 0;
        return thirdA - thirdB;
    } else {
        const maxA = evalA.details.maxNum || (rowA.length ? Math.max(...rowA.map(c=>c.number)) : 0);
        const maxB = evalB.details.maxNum || (rowB.length ? Math.max(...rowB.map(c=>c.number)) : 0);
        return maxA - maxB;
    }
}

function isBusted(rows) {
    if (rows[0].length === 0 || rows[1].length === 0 || rows[2].length === 0) return false;
    const cmp1 = compareRows(rows[0], rows[1]);
    const cmp2 = compareRows(rows[1], rows[2]);
    return cmp1 > 0 || cmp2 > 0;
}

function getSpecialBonus(rows) {
    const allCards = rows.flat();
    if (allCards.length !== 8) return 0;
    const nums = allCards.map(c => c.number);
    const colors = allCards.map(c => c.color);
    const sortedNums = [...nums].sort((a,b)=>a-b);
    const isSeq = (sortedNums[0] === 1 && sortedNums[7] === 8) || (sortedNums[0] === 2 && sortedNums[7] === 9);
    let dragon = false;
    if (isSeq && new Set(nums).size === 8) dragon = true;
    const count = {};
    nums.forEach(n => count[n] = (count[n]||0)+1);
    const allPairs = Object.values(count).every(v => v%2 === 0);
    const row0 = rows[0]; const row1 = rows[1]; const row2 = rows[2];
    const isRow0Seq = row0.length===2 && Math.abs(row0[0].number - row0[1].number) === 1;
    const isRow1Seq = row1.length===3 && (()=>{let n=row1.map(c=>c.number).sort((a,b)=>a-b); return n[1]===n[0]+1 && n[2]===n[1]+1;})();
    const isRow2Seq = row2.length===3 && (()=>{let n=row2.map(c=>c.number).sort((a,b)=>a-b); return n[1]===n[0]+1 && n[2]===n[1]+1;})();
    const threeSnakes = isRow0Seq && isRow1Seq && isRow2Seq;
    const allColorsDiff = new Set(colors).size === 8;
    const allOdd = nums.every(n => n%2===1);
    const allEven = nums.every(n => n%2===0);
    const oddEven = allOdd || allEven;
    let best = 0;
    if (dragon && allColorsDiff) best = 35;
    else if (dragon) best = 15;
    else if (threeSnakes) best = 10;
    else if (allPairs) best = 10;
    else if (allColorsDiff) best = 10;
    else if (oddEven) best = 10;
    return best;
}

function calculatePlayerScore(rows) {
    if (isBusted(rows)) return 0;
    let baseScore = 0;
    for (let i=0; i<3; i++) {
        const eval = evaluateRow(rows[i]);
        baseScore += eval.score;
    }
    const special = getSpecialBonus(rows);
    return Math.max(baseScore, special);
}