import type { PlanningCard as PlanningCardData, PlanningResponse } from "@asc/contracts";
import { addDays, isIsoDate, isoDate, startOfWeek } from "@asc/domain";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { assignWorkOrder, getPlanning } from "@/lib/api-client";
import { useSession } from "@/lib/auth";
import { planningKeyboardCoordinates } from "@/lib/planning-keyboard";
import { WORK_ORDER_PRIORITY_CLASS, WORK_ORDER_TYPE_LABELS } from "@/lib/work-order-labels";

/**
 * Planning de la semaine (spec 008).
 *
 * C'est la page d'accueil du dispatcher, pas un module : « tout se fait depuis
 * le planning » (`07-principes-ux.md`, règle 1). Une ligne par technicien, sept
 * colonnes, et à gauche le backlog des OT qui attendent d'être placés.
 *
 * Le déplacement existe à la souris **et au clavier** (règle 5).
 */

const BACKLOG_ID = "backlog";

/** `cell:<utilisateur>:<jour>` — l'identifiant porte l'affectation entière. */
function cellId(userId: string, day: string): string {
  return `cell:${userId}:${day}`;
}

interface Assignment {
  readonly assignee: string | null;
  readonly scheduledOn: string | null;
}

/** Lit l'affectation que désigne une zone de dépôt. `null` si elle est inconnue. */
function assignmentOf(droppableId: string): Assignment | null {
  if (droppableId === BACKLOG_ID) {
    return { assignee: null, scheduledOn: null };
  }
  const [prefix, userId, day] = droppableId.split(":");
  if (prefix !== "cell" || userId === undefined || day === undefined) {
    return null;
  }
  return { assignee: userId, scheduledOn: day };
}

const DAY_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const WEEK_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatDay(day: string): string {
  return DAY_FORMAT.format(new Date(`${day}T00:00:00Z`));
}

/** Lundi de la semaine demandée, ou de la semaine en cours. */
function resolveWeek(requested: string | undefined): string {
  const day =
    requested !== undefined && isIsoDate(requested)
      ? isoDate(requested)
      : isoDate(new Date().toISOString().slice(0, 10));
  return startOfWeek(day);
}

export function PlanningPage({ week }: { week: string | undefined }): React.JSX.Element {
  const session = useSession();
  const token = session?.accessToken ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const monday = resolveWeek(week);
  const queryKey = ["planning", monday] as const;

  const { data, isPending } = useQuery({
    queryKey,
    queryFn: () => getPlanning(token, monday),
    enabled: token !== "",
    placeholderData: keepPreviousData,
  });

  const assign = useMutation({
    mutationFn: ({ id, assignment }: { id: string; assignment: Assignment }) =>
      assignWorkOrder(token, id, {
        assignee: assignment.assignee,
        scheduledOn: assignment.scheduledOn === null ? null : isoDate(assignment.scheduledOn),
      }),
    // Déplacement optimiste : la carte est dans sa nouvelle case tout de suite.
    // Un planning qui clignote à chaque geste est inutilisable (R7.4).
    onMutate: ({ id, assignment }) => {
      const previous = queryClient.getQueryData<PlanningResponse>(queryKey);
      if (previous !== undefined) {
        queryClient.setQueryData(queryKey, moveCard(previous, id, assignment));
      }
      setError(null);
      return { previous };
    },
    onError: (mutationError, _variables, context) => {
      // Retour à la place d'origine, avec la raison : le serveur refuse par
      // exemple de renvoyer au backlog un OT déjà commencé (R4.4).
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      setError(mutationError.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: planningKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent): void {
    if (over === null) {
      return;
    }
    const assignment = assignmentOf(String(over.id));
    if (assignment === null) {
      return;
    }
    const card = findCard(data, String(active.id));
    if (card === undefined || isSameAssignment(card, assignment)) {
      return;
    }
    assign.mutate({ id: String(active.id), assignment });
  }

  function goToWeek(target: string): void {
    void navigate({ to: "/", search: { semaine: target } });
  }

  const days = data?.days ?? [];

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Planning</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Semaine du {WEEK_FORMAT.format(new Date(`${monday}T00:00:00Z`))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => goToWeek(addDays(isoDate(monday), -7))}>
            Semaine précédente
          </Button>
          <Button
            variant="outline"
            onClick={() => goToWeek(startOfWeek(isoDate(new Date().toISOString().slice(0, 10))))}
          >
            Cette semaine
          </Button>
          <Button variant="outline" onClick={() => goToWeek(addDays(isoDate(monday), 7))}>
            Semaine suivante
          </Button>
        </div>
      </header>

      {error !== null && (
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {error}
        </p>
      )}

      {isPending && data === undefined ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Chargement…</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          accessibility={{
            screenReaderInstructions: {
              draggable:
                "Appuyez sur Espace pour prendre cet OT, les flèches pour le déplacer de case en case, Espace pour le déposer, Échap pour annuler.",
            },
            announcements: {
              onDragStart: ({ active }) => `OT ${active.id} pris.`,
              onDragOver: ({ over }) =>
                over === null
                  ? "Hors de toute case."
                  : `Sur ${describeDroppable(String(over.id), data)}.`,
              onDragEnd: ({ over }) =>
                over === null
                  ? "Déplacement annulé, l'OT reste en place."
                  : `Déposé sur ${describeDroppable(String(over.id), data)}.`,
              onDragCancel: () => "Déplacement annulé, l'OT reste en place.",
            },
          }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <Backlog cards={data?.backlog ?? []} />

            <div className="min-w-0 flex-1 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="w-40 border-b border-[var(--color-border)] p-2 text-left font-medium">
                      Technicien
                    </th>
                    {days.map((day) => (
                      <th
                        key={day}
                        className="border-b border-[var(--color-border)] p-2 text-left font-medium"
                      >
                        {formatDay(day)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.rows ?? []).map((row) => (
                    <tr key={row.user.id} className="align-top">
                      <th
                        scope="row"
                        className="border-b border-[var(--color-border)] p-2 text-left font-normal"
                      >
                        <span className="block font-medium">{row.user.name}</span>
                        {!row.user.active && (
                          <span className="text-xs text-[var(--color-muted-foreground)]">
                            Compte désactivé
                          </span>
                        )}
                      </th>
                      {days.map((day) => (
                        <PlanningCell
                          key={day}
                          id={cellId(row.user.id, day)}
                          label={`${row.user.name}, ${formatDay(day)}`}
                          cards={row.cards.filter((card) => card.workOrder.scheduledOn === day)}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {(data?.rows ?? []).length === 0 && (
                <p className="p-4 text-sm text-[var(--color-muted-foreground)]">
                  Aucun utilisateur actif.{" "}
                  <Link to="/utilisateurs" className="underline">
                    Créez un technicien
                  </Link>{" "}
                  pour commencer à planifier.
                </p>
              )}
            </div>
          </div>
        </DndContext>
      )}
    </section>
  );
}

/** Réserve de travail : les OT ouverts que personne ne porte encore (R6). */
function Backlog({ cards }: { cards: readonly PlanningCardData[] }): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: BACKLOG_ID });

  return (
    <div className="lg:w-64 lg:shrink-0">
      <h2 className="mb-2 text-sm font-medium">À planifier ({cards.length})</h2>
      <div
        ref={setNodeRef}
        data-testid="planning-backlog"
        className={`min-h-24 space-y-2 rounded-md border border-dashed p-2 ${
          isOver ? "border-[var(--color-foreground)]" : "border-[var(--color-border)]"
        }`}
      >
        {cards.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Rien en attente. Les OT créés arrivent ici.
          </p>
        ) : (
          cards.map((card) => <WorkOrderCard key={card.workOrder.id} card={card} />)
        )}
      </div>
    </div>
  );
}

/** Une case de la grille : un technicien, un jour. */
function PlanningCell({
  id,
  label,
  cards,
}: {
  id: string;
  label: string;
  cards: readonly PlanningCardData[];
}): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <td
      ref={setNodeRef}
      data-testid={id}
      aria-label={label}
      className={`min-w-28 space-y-2 border-b border-l border-[var(--color-border)] p-2 ${
        isOver ? "bg-[var(--color-muted)]" : ""
      }`}
    >
      {cards.map((card) => (
        <WorkOrderCard key={card.workOrder.id} card={card} />
      ))}
    </td>
  );
}

/** Carte déplaçable — souris et clavier (R7.1). */
function WorkOrderCard({ card }: { card: PlanningCardData }): React.JSX.Element {
  const { workOrder } = card;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: workOrder.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-testid="planning-card"
      data-reference={workOrder.reference}
      style={
        transform === null
          ? undefined
          : { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
      }
      className={`cursor-grab rounded-md border border-[var(--color-border)] bg-[var(--color-background)] p-2 text-left text-xs ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <span className="block font-medium">{workOrder.reference}</span>
      <span className={`block ${WORK_ORDER_PRIORITY_CLASS[workOrder.priority]}`}>
        {WORK_ORDER_TYPE_LABELS[workOrder.type]} · {card.siteName}
      </span>
      <span className="block text-[var(--color-muted-foreground)]">{card.unitReference}</span>
    </div>
  );
}

/** Libellé parlé d'une zone de dépôt, pour les annonces aux lecteurs d'écran. */
function describeDroppable(droppableId: string, planning: PlanningResponse | undefined): string {
  if (droppableId === BACKLOG_ID) {
    return "la liste à planifier";
  }
  const assignment = assignmentOf(droppableId);
  if (assignment === null || assignment.assignee === null || assignment.scheduledOn === null) {
    return "une case inconnue";
  }
  const name =
    planning?.rows.find((row) => row.user.id === assignment.assignee)?.user.name ?? "un technicien";
  return `${name}, ${formatDay(assignment.scheduledOn)}`;
}

function findCard(
  planning: PlanningResponse | undefined,
  workOrderId: string,
): PlanningCardData | undefined {
  if (planning === undefined) {
    return undefined;
  }
  const inRows = planning.rows.flatMap((row) => row.cards);
  return [...planning.backlog, ...inRows].find((card) => card.workOrder.id === workOrderId);
}

function isSameAssignment(card: PlanningCardData, assignment: Assignment): boolean {
  return (
    card.workOrder.assignee === assignment.assignee &&
    card.workOrder.scheduledOn === assignment.scheduledOn
  );
}

/**
 * Déplace la carte dans la copie locale du planning.
 *
 * Le statut suit la même règle que le serveur (spec 008, R4.2) : sans cela
 * l'affichage optimiste montrerait « À traiter » sur un OT qu'on vient de
 * planifier, puis se corrigerait — exactement le clignotement qu'on évite.
 */
function moveCard(
  planning: PlanningResponse,
  workOrderId: string,
  assignment: Assignment,
): PlanningResponse {
  const card = findCard(planning, workOrderId);
  if (card === undefined) {
    return planning;
  }

  const moved: PlanningCardData = {
    ...card,
    workOrder: {
      ...card.workOrder,
      assignee: assignment.assignee,
      scheduledOn: assignment.scheduledOn === null ? null : isoDate(assignment.scheduledOn),
      status:
        card.workOrder.status === "new" || card.workOrder.status === "assigned"
          ? assignment.assignee === null
            ? "new"
            : "assigned"
          : card.workOrder.status,
    },
  };
  const without = (cards: readonly PlanningCardData[]): PlanningCardData[] =>
    cards.filter((candidate) => candidate.workOrder.id !== workOrderId);

  const inWeek =
    assignment.scheduledOn !== null && planning.days.some((day) => day === assignment.scheduledOn);

  return {
    ...planning,
    backlog:
      assignment.assignee === null
        ? [moved, ...without(planning.backlog)]
        : without(planning.backlog),
    rows: planning.rows.map((row) => ({
      ...row,
      cards:
        row.user.id === assignment.assignee && inWeek
          ? [...without(row.cards), moved]
          : without(row.cards),
    })),
  };
}
