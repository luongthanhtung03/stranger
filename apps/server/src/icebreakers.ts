import { ICEBREAKERS, type Icebreaker } from "@stranger/shared";

/** Random card, avoiding an immediate repeat. */
export function pickCard(lastId?: string): Icebreaker {
  let card = ICEBREAKERS[Math.floor(Math.random() * ICEBREAKERS.length)];
  if (card.id === lastId) card = ICEBREAKERS[(ICEBREAKERS.indexOf(card) + 1) % ICEBREAKERS.length];
  return card;
}
