import type { Group, Person, RotationAssignment, Zone } from "@prisma/client";

type PreviousRotation = {
  assignments: Array<
    Pick<RotationAssignment, "zoneId" | "personId" | "zoneIndex"> & {
      zone: Pick<Zone, "id" | "name" | "orderIndex">;
      person: Pick<Person, "id" | "name">;
    }
  >;
};

export type GeneratedAssignment = {
  personId: string;
  zoneId: string;
  zoneIndex: number;
  personName: string;
  zoneName: string;
  repeatedZone: boolean;
  repeatedFrontNeighbor: boolean;
};

export type GeneratedRotation = {
  score: number;
  assignments: GeneratedAssignment[];
};

type CandidateAssignment = {
  person: Pick<Person, "id" | "name">;
  zone: Pick<Zone, "id" | "name" | "orderIndex">;
};

function shuffle<T>(items: T[]) {
  const clone = [...items];

  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }

  return clone;
}

function scoreCandidate(
  candidate: CandidateAssignment[],
  previousRotations: PreviousRotation[]
) {
  if (previousRotations.length === 0) {
    return {
      score: 0,
      assignments: candidate.map(({ person, zone }) => ({
        personId: person.id,
        zoneId: zone.id,
        zoneIndex: zone.orderIndex,
        personName: person.name,
        zoneName: zone.name,
        repeatedZone: false,
        repeatedFrontNeighbor: false
      }))
    };
  }

  const previousZonesByPerson = new Map<string, Set<string>>();
  const previousNeighborsByPerson = new Map<string, Set<string>>();

  for (const prev of previousRotations) {
    const ordered = [...prev.assignments].sort((a, b) => a.zoneIndex - b.zoneIndex);

    for (let i = 0; i < ordered.length; i += 1) {
      const assignment = ordered[i];

      if (!previousZonesByPerson.has(assignment.personId)) {
        previousZonesByPerson.set(assignment.personId, new Set());
      }
      previousZonesByPerson.get(assignment.personId)!.add(assignment.zoneId);

      const frontNeighbor = i === 0 ? ordered[ordered.length - 1] : ordered[i - 1];
      if (frontNeighbor) {
        if (!previousNeighborsByPerson.has(assignment.personId)) {
          previousNeighborsByPerson.set(assignment.personId, new Set());
        }
        previousNeighborsByPerson.get(assignment.personId)!.add(frontNeighbor.personId);
      }
    }
  }

  let score = 0;
  const assignments = candidate
    .sort((a, b) => a.zone.orderIndex - b.zone.orderIndex)
    .map(({ person, zone }, index, orderedCandidate) => {
      const repeatedZone = previousZonesByPerson.get(person.id)?.has(zone.id) ?? false;
      const currentFrontNeighbor =
        orderedCandidate.length === 0
          ? null
          : index === 0
            ? orderedCandidate[orderedCandidate.length - 1]?.person.id ?? null
            : orderedCandidate[index - 1]?.person.id ?? null;
      const repeatedFrontNeighbor =
        currentFrontNeighbor !== null &&
        (previousNeighborsByPerson.get(person.id)?.has(currentFrontNeighbor) ?? false);

      if (repeatedZone) {
        score += 100;
      }

      if (repeatedFrontNeighbor) {
        score += 60;
      }

      return {
        personId: person.id,
        zoneId: zone.id,
        zoneIndex: zone.orderIndex,
        personName: person.name,
        zoneName: zone.name,
        repeatedZone,
        repeatedFrontNeighbor
      };
    });

  return { score, assignments };
}

export function generateRotation({
  group,
  zones,
  people,
  previousRotations,
  iterations = 500
}: {
  group: Pick<Group, "id" | "name">;
  zones: Array<Pick<Zone, "id" | "name" | "orderIndex">>;
  people: Array<Pick<Person, "id" | "name">>;
  previousRotations: PreviousRotation[];
  iterations?: number;
}): GeneratedRotation {
  if (zones.length === 0) {
    throw new Error("Det finns inga zoner att tilldela.");
  }

  if (people.length < zones.length) {
    throw new Error(
      `Gruppen ${group.name} har för få aktiva personer för att fylla ${zones.length} zoner.`
    );
  }

  let best: GeneratedRotation | null = null;

  for (let attempt = 0; attempt < iterations; attempt += 1) {
    const shuffledPeople = shuffle(people).slice(0, zones.length);
    const candidate = zones.map((zone, index) => ({
      zone,
      person: shuffledPeople[index]
    }));

    const scored = scoreCandidate(candidate, previousRotations);

    if (best === null || scored.score < best.score) {
      best = scored;

      if (best.score === 0) {
        break;
      }
    }
  }

  if (!best) {
    throw new Error("Det gick inte att skapa en rotation.");
  }

  return best;
}
