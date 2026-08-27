export const storage = {
  get: async (key: string) => {
    const value = localStorage.getItem(key);
    if (value === null) throw new Error("Not found");
    return { value };
  },
  set: async (key: string, value: string) => {
    localStorage.setItem(key, value);
    return true;
  },
  delete: async (key: string) => {
    localStorage.removeItem(key);
    return true;
  },
  list: async (prefix: string) => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    return { keys };
  }
};
