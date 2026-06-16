// STONK Arcade 랜덤 유틸
// Math.random() 대신 crypto.getRandomValues()를 우선 사용한다.
// 매 게임 시작마다 새 배열/카드/슬롯 결과를 생성하므로 거의 모든 판이 다르게 나온다.

export function randomUint32() {
  if (globalThis.crypto?.getRandomValues) {
    const arr = new Uint32Array(1);
    globalThis.crypto.getRandomValues(arr);
    return arr[0];
  }
  return Math.floor(Math.random() * 0xffffffff);
}

export function randomFloat() {
  return randomUint32() / 0x100000000;
}

export function randomInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (hi < lo) throw new Error('randomInt: invalid range');
  const range = hi - lo + 1;
  const maxUnbiased = Math.floor(0x100000000 / range) * range;
  let x;
  do {
    x = randomUint32();
  } while (x >= maxUnbiased);
  return lo + (x % range);
}

export function shuffle(input) {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pickWeighted(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) throw new Error('pickWeighted: total weight must be positive');
  let roll = randomFloat() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.value;
  }
  return items[items.length - 1].value;
}
