import cuid from "cuid";

export async function generateFormattedID(prefix: string): Promise<string> {
  return `${prefix}-${cuid()}`;
}