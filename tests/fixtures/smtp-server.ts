import { createServer, type Socket } from "node:net";

/** A loopback-only SMTP capture fixture. It never relays email. */
export async function createSmtpFixture(options: {
  recipientResponse?: string;
  authResponse?: string;
  onData?: (message: string) => Promise<string> | string;
} = {}) {
  const received: string[] = [];
  const accepted: string[] = [];
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.setEncoding("utf8");
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    socket.write("220 smtp.fixture.test ESMTP\r\n");
    let buffer = "";
    let inData = false;
    let processing = false;
    const respond = (text: string) => { if (!socket.destroyed) socket.write(`${text}\r\n`); };
    const processBuffer = async () => {
      if (processing) return;
      processing = true;
      try {
        while (!socket.destroyed) {
          if (inData) {
            const boundary = buffer.indexOf("\r\n.\r\n");
            if (boundary === -1) break;
            const message = buffer.slice(0, boundary).replace(/\r\n\.\./g, "\r\n.");
            buffer = buffer.slice(boundary + 5);
            inData = false;
            received.push(message);
            const result = await options.onData?.(message) ?? "250 2.0.0 Captured locally";
            if (result.startsWith("250")) accepted.push(message);
            respond(result);
            continue;
          }
          const boundary = buffer.indexOf("\r\n");
          if (boundary === -1) break;
          const command = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          if (/^EHLO /i.test(command)) respond("250-smtp.fixture.test\r\n250-AUTH PLAIN\r\n250 8BITMIME");
          else if (/^HELO /i.test(command)) respond("250 smtp.fixture.test");
          else if (/^AUTH PLAIN /i.test(command)) respond(options.authResponse ?? "235 2.7.0 Authenticated");
          else if (/^MAIL FROM:/i.test(command)) respond("250 2.1.0 Sender accepted");
          else if (/^RCPT TO:/i.test(command)) respond(options.recipientResponse ?? "250 2.1.5 Recipient accepted");
          else if (/^DATA$/i.test(command)) { inData = true; respond("354 End data with <CRLF>.<CRLF>"); }
          else if (/^(NOOP|RSET)$/i.test(command)) respond("250 2.0.0 OK");
          else if (/^QUIT$/i.test(command)) { respond("221 2.0.0 Goodbye"); socket.end(); }
          else respond("500 5.5.1 Unsupported fixture command");
        }
      } finally {
        processing = false;
      }
    };
    socket.on("data", (data: string) => {
      buffer += data;
      void processBuffer().catch(() => socket.destroy());
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { server.removeListener("error", reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("SMTP_FIXTURE_NOT_LISTENING");
  return {
    port: address.port,
    received,
    accepted,
    close: () => new Promise<void>((resolve) => {
      for (const socket of sockets) socket.destroy();
      server.close(() => resolve());
    }),
  };
}
