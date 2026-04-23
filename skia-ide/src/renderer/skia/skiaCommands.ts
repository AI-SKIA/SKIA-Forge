type CommandFn = () => void;

const commands = new Map<string, CommandFn>();

export const registerCommand = (id: string, fn: CommandFn): void => {
  commands.set(id, fn);
};

export const runCommand = (id: string): void => {
  const fn = commands.get(id);
  if (fn) {
    fn();
  }
};
