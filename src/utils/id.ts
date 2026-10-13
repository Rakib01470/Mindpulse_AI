/** Collision-resistant local IDs (no network, no native module needed). */
export const newId = (prefix: string): string => {
  const time = Date.now().toString(36);
  const rand = Array.from({ length: 10 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
  return `${prefix}_${time}${rand}`;
};

export const nowIso = (): string => new Date().toISOString();
