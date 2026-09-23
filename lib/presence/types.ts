/** A global count measured by the database, which may be briefly cached. */
export type OnlineCountSnapshot = {
  count: number;
  measuredAt: string;
};
