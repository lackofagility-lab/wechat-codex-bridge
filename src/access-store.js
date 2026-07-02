import { readJson, writeJsonAtomic } from "./store.js";

export class AccessStore {
  constructor(filePath, configuredUsers = []) {
    this.filePath = filePath;
    this.data = readJson(filePath, { allowedUserIds: [] });
    this.data.allowedUserIds ??= [];
    for (const id of configuredUsers) this.add(id);
  }

  isAllowed(userId) {
    return this.data.allowedUserIds.includes(String(userId));
  }

  add(userId) {
    const id = String(userId);
    if (!this.data.allowedUserIds.includes(id)) {
      this.data.allowedUserIds.push(id);
      writeJsonAtomic(this.filePath, this.data);
    }
  }
}
