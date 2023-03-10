export type IdentifiedRecord = { id: number };

export function addNewIdArray<T>(data: T[], newId = 0): (T & IdentifiedRecord)[] {
  return data.map((data, index) => ({ ...data, id: newId + index }));
}
