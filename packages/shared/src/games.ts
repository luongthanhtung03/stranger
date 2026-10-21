// Mini games played while waiting in the queue. The score travels into the room
// as the first line of the partner's chat.

export type GameId = "whack" | "pong" | "billiards";

export const GAME_IDS: GameId[] = ["whack", "pong", "billiards"];

export interface GameScore {
  game: GameId;
  score: number;
}

export const GAME_META: Record<GameId, { title: string; emoji: string; hint: string }> = {
  whack: { title: "Đập chuột", emoji: "🐹", hint: "Chạm vào chuột trước khi nó trốn!" },
  pong: { title: "Giữ bóng", emoji: "🏓", hint: "Đỡ bóng, phá gạch — bóng sẽ ngày càng nhanh!" },
  billiards: { title: "Bida 4 lỗ", emoji: "🎱", hint: "Kéo bi trắng ra sau rồi thả — đưa bi hồng vào lỗ" },
};

/** Chat line the *other* person sees about your result; null if nothing to brag about. */
export function gameResultText(name: string, s: GameScore): string | null {
  if (!s.score) return null;
  if (s.game === "billiards" && s.score < 0) {
    return `${name} vừa đút bi trắng vào lỗ ${-s.score} lần 🎱😂 — đừng cười nhé`;
  }
  switch (s.game) {
    case "whack":
      return `${name} vừa đập được ${s.score} con chuột 🐹 — bạn phá kỷ lục được không?`;
    case "pong":
      return `${name} giữ bóng được ${s.score} lần 🏓 — bạn thì sao?`;
    case "billiards":
      return `${name} vừa đút ${s.score} bi vào lỗ 🎱 — thách bạn đấy!`;
  }
}
