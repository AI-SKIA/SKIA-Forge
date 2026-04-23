import type { Command, CommandContext } from "./Command";

export class LogoutCommand implements Command {
  name = "logout";
  description = "Logout stub.";

  async run(_context: CommandContext, _args: unknown): Promise<{ ok: true; message: string }> {
    return { ok: true, message: "Not implemented yet" };
  }
}