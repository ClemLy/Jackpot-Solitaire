export function createHandler(config: {
  url: string;
  serviceKey: string;
  allowedOrigins: string[];
}): (req: Request) => Promise<Response>;
