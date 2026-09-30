/**
 * An in-memory stand-in for node-appwrite's Databases, for tests: documents
 * per collection, with the handful of query methods the API uses.
 */

type Doc = Record<string, unknown> & { $id: string };
interface ParsedQuery { method: string; attribute?: string; values?: unknown[] }

const appwriteError = (code: number, message: string) => Object.assign(new Error(message), { code });

export class FakeDb {
  collections = new Map<string, Map<string, Doc>>();
  private clock = 0;

  private table(collectionId: string) {
    let table = this.collections.get(collectionId);
    if (!table) this.collections.set(collectionId, (table = new Map()));
    return table;
  }

  /** Seeds a document directly, e.g. a run with a given $createdAt. */
  put(collectionId: string, doc: Doc) {
    this.table(collectionId).set(doc.$id, { $createdAt: new Date().toISOString(), $updatedAt: this.stamp(), ...doc });
  }

  all(collectionId: string): Doc[] {
    return [...this.table(collectionId).values()];
  }

  private stamp() {
    this.clock += 1;
    return new Date(Date.UTC(2026, 0, 1, 0, 0, this.clock)).toISOString();
  }

  async getDocument({ collectionId, documentId }: { collectionId: string; documentId: string }) {
    const doc = this.table(collectionId).get(documentId);
    if (!doc) throw appwriteError(404, "Document not found");
    return { ...doc };
  }

  async createDocument({ collectionId, documentId, data }: { collectionId: string; documentId: string; data: Record<string, unknown> }) {
    const table = this.table(collectionId);
    if (table.has(documentId)) throw appwriteError(409, "Document already exists");
    const now = new Date().toISOString();
    const doc = { ...data, $id: documentId, $createdAt: now, $updatedAt: this.stamp() };
    table.set(documentId, doc);
    return { ...doc };
  }

  async updateDocument({ collectionId, documentId, data }: { collectionId: string; documentId: string; data: Record<string, unknown> }) {
    const table = this.table(collectionId);
    const doc = table.get(documentId);
    if (!doc) throw appwriteError(404, "Document not found");
    const next = { ...doc, ...data, $updatedAt: this.stamp() };
    table.set(documentId, next);
    return { ...next };
  }

  async deleteDocument({ collectionId, documentId }: { collectionId: string; documentId: string }) {
    if (!this.table(collectionId).delete(documentId)) throw appwriteError(404, "Document not found");
    return {};
  }

  async listDocuments({ collectionId, queries = [] }: { collectionId: string; queries?: string[] }) {
    let docs = this.all(collectionId);
    const parsed = queries.map((query) => JSON.parse(query) as ParsedQuery);
    let limit = 25;
    for (const query of parsed) {
      const key = query.attribute ?? "";
      const values = query.values ?? [];
      const get = (doc: Doc) => doc[key] as never;
      if (query.method === "equal") docs = docs.filter((doc) => values.includes(get(doc)));
      else if (query.method === "notEqual") docs = docs.filter((doc) => !values.includes(get(doc)));
      else if (query.method === "lessThan") docs = docs.filter((doc) => get(doc) < (values[0] as never));
      else if (query.method === "greaterThanEqual") docs = docs.filter((doc) => get(doc) >= (values[0] as never));
      else if (query.method === "greaterThan") docs = docs.filter((doc) => get(doc) > (values[0] as never));
      else if (query.method === "startsWith") docs = docs.filter((doc) => String(get(doc) ?? "").toLowerCase().startsWith(String(values[0]).toLowerCase()));
      else if (query.method === "limit") limit = Number(values[0]);
    }
    const total = docs.length;
    for (const query of parsed.filter((item) => item.method === "orderAsc" || item.method === "orderDesc").reverse()) {
      const key = query.attribute ?? "";
      const direction = query.method === "orderAsc" ? 1 : -1;
      docs = [...docs].sort((a, b) => (a[key] as never) > (b[key] as never) ? direction : (a[key] as never) < (b[key] as never) ? -direction : 0);
    }
    return { documents: docs.slice(0, limit).map((doc) => ({ ...doc })), total };
  }
}
