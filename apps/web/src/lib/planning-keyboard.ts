import type { ClientRect, KeyboardCoordinateGetter } from "@dnd-kit/core";

/**
 * Déplacement au clavier d'une case du planning à l'autre (spec 008, R7).
 *
 * Le comportement par défaut de dnd-kit déplace la carte de 25 pixels par
 * flèche : traverser une semaine demanderait une centaine d'appuis. Ce
 * récupérateur saute directement à la case voisine dans la direction demandée,
 * en cherchant parmi les zones de dépôt réellement mesurées.
 *
 * Ce n'est pas une option d'accessibilité ajoutée après coup : le clavier est
 * la règle 5 des principes UX, un dispatcher a une main sur le téléphone.
 */

interface Point {
  readonly x: number;
  readonly y: number;
}

const DIRECTIONS: Readonly<Record<string, Point>> = {
  ArrowRight: { x: 1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowDown: { x: 0, y: 1 },
  ArrowUp: { x: 0, y: -1 },
};

function centerOf(rect: ClientRect): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Poids du désalignement.
 *
 * Une case **alignée** avec la carte — dont la colonne contient son centre pour
 * un déplacement vertical, dont la ligne le contient pour un déplacement
 * horizontal — l'emporte toujours sur une case simplement proche. Sans cette
 * règle, une flèche « vers le bas » depuis une ligne haute (un technicien qui
 * porte cinq OT) sauterait sur la case voisine du **même** jour de la même
 * ligne, plus proche géométriquement mais absurde pour l'utilisateur.
 *
 * Entre deux cases également alignées, c'est la plus proche dans la direction
 * qui gagne.
 */
const MISALIGNMENT_WEIGHT = 10_000;

/** Écart entre `value` et l'intervalle `[min, max]` — `0` s'il est dedans. */
function gapTo(value: number, min: number, max: number): number {
  if (value < min) {
    return min - value;
  }
  return value > max ? value - max : 0;
}

export const planningKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { currentCoordinates, context },
) => {
  const direction = DIRECTIONS[event.code];
  if (direction === undefined) {
    return undefined;
  }
  event.preventDefault();

  // Rectangle de la carte déplacée. Il sert à calculer la translation finale,
  // jamais à choisir la direction.
  const dragged = context.collisionRect;
  if (dragged === null || dragged === undefined) {
    return undefined;
  }

  /**
   * On raisonne depuis la **zone survolée**, pas depuis la carte.
   *
   * Les deux coïncident tant que la carte est centrée sur sa case, mais pas au
   * départ : dans le backlog, la carte est une ligne parmi d'autres et le
   * centre de la zone est ailleurs. Partir de la zone donne un déplacement
   * régulier, case après case, quelle que soit la taille des cartes.
   */
  const current = context.over?.id;
  const from = centerOf(
    (current === undefined ? undefined : context.droppableRects.get(current)) ?? dragged,
  );

  let best: { rect: ClientRect; score: number } | undefined;
  // `droppableContainers` est une `Map` : itérer directement rendrait des
  // paires clé/valeur.
  for (const container of context.droppableContainers.values()) {
    // La zone qu'on occupe déjà n'est pas une destination.
    if (container.disabled || container.id === current) {
      continue;
    }
    const rect = context.droppableRects.get(container.id) ?? container.rect.current;
    if (rect === null || rect === undefined) {
      continue;
    }

    const to = centerOf(rect);
    const along = (to.x - from.x) * direction.x + (to.y - from.y) * direction.y;
    // Strictement devant : une case qui déborde sur l'origine n'est pas « la
    // suivante », et se sélectionner soi-même bloquerait le déplacement.
    if (along <= 1) {
      continue;
    }

    // Alignement mesuré sur l'**étendue** de la case, pas sur son centre :
    // deux cases de hauteurs différentes restent dans la même colonne.
    const misalignment =
      direction.x === 0
        ? gapTo(from.x, rect.left, rect.left + rect.width)
        : gapTo(from.y, rect.top, rect.top + rect.height);
    const score = MISALIGNMENT_WEIGHT * misalignment + along;

    if (best === undefined || score < best.score) {
      best = { rect, score };
    }
  }

  if (best === undefined) {
    return undefined;
  }

  // La carte est **centrée** sur la case visée, et pas calée sur son coin.
  //
  // C'est ce qui la fait désigner par la détection de collision, qui compare
  // des centres (`closestCenter`) : une carte plus haute que la case et calée
  // en haut aurait son centre dans la case du dessous, et dnd-kit annoncerait
  // une case pendant que le clavier en vise une autre.
  const cardCenter = centerOf(dragged);
  const targetCenter = centerOf(best.rect);
  return {
    x: currentCoordinates.x + (targetCenter.x - cardCenter.x),
    y: currentCoordinates.y + (targetCenter.y - cardCenter.y),
  };
};
