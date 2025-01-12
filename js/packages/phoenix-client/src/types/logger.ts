export type Logger = {
  info: (message: string) => void;
  error: (message: string) => void;
  log: (message: string) => void;
};
