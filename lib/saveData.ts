export type IdentifiedRecord = { id: number };

export function addNewId<T>(data: T, newId = 0): T & IdentifiedRecord {
  return { ...data, id: newId };
}

export function addNewIdArray<T>(data: T[], newId = 0): (T & IdentifiedRecord)[] {
  return data.map((data, index) => addNewId(data, newId + index));
}
