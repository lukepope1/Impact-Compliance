import net from "net";

/**
 * Malware scanning for uploaded evidence. Talks to a ClamAV daemon (clamd) over its
 * documented INSTREAM protocol — the same integration pattern used whether clamd runs as
 * a local service (dev), a sidecar container next to the app (ECS), or a dedicated
 * scanning host reachable over the network (see docs/MALWARE_SCANNING.md).
 *
 * Fail-closed by design: with no scanner configured (CLAMAV_HOST unset), documents.ts
 * leaves malware_scan_status at "pending" rather than assuming "clean" — a compliance
 * evidence store should never let an unscanned file download just because scanning wasn't
 * set up, which is what the code here replaces (it previously hardcoded "clean").
 */
export type ScanResult = "clean" | "infected" | "failed";

export interface Scanner {
  scan(buffer: Buffer): Promise<{ result: ScanResult; detail?: string }>;
}

const INSTREAM_CHUNK_SIZE = 1024 * 1024; // clamd's default StreamMaxLength headroom; well under it either way

/**
 * clamd's INSTREAM command: send "zINSTREAM\0", then the file as a sequence of
 * (4-byte big-endian length prefix + chunk) pairs, terminated by a zero-length chunk,
 * then read a single response line — "stream: OK" or "stream: <name> FOUND".
 * https://docs.clamav.net/manual/Usage/Scanning.html#instream
 */
export class ClamdScanner implements Scanner {
  constructor(
    private host: string,
    private port: number,
    private timeoutMs = 30_000
  ) {}

  scan(buffer: Buffer): Promise<{ result: ScanResult; detail?: string }> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let response = "";
      let settled = false;

      const finish = (result: ScanResult, detail?: string) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve({ result, detail });
      };

      socket.setTimeout(this.timeoutMs);
      socket.on("timeout", () => finish("failed", "clamd connection timed out"));
      socket.on("error", (err) => finish("failed", `clamd connection error: ${err.message}`));

      socket.connect(this.port, this.host, () => {
        socket.write("zINSTREAM\0");

        let offset = 0;
        while (offset < buffer.length) {
          const chunk = buffer.subarray(offset, offset + INSTREAM_CHUNK_SIZE);
          const sizeHeader = Buffer.alloc(4);
          sizeHeader.writeUInt32BE(chunk.length, 0);
          socket.write(sizeHeader);
          socket.write(chunk);
          offset += chunk.length;
        }
        // Zero-length chunk signals end of stream.
        const zeroLength = Buffer.alloc(4);
        socket.write(zeroLength);
      });

      socket.on("data", (data) => {
        response += data.toString("utf-8");
      });

      socket.on("end", () => {
        const clean = /stream:\s*OK/i.test(response);
        const infected = /FOUND\s*$/i.test(response.trim());
        if (clean) return finish("clean");
        if (infected) return finish("infected", response.trim());
        finish("failed", `Unrecognized clamd response: ${response.trim() || "(empty)"}`);
      });
    });
  }
}

const host = process.env.CLAMAV_HOST;
const port = Number(process.env.CLAMAV_PORT ?? 3310);

export const scanner: Scanner | null = host ? new ClamdScanner(host, port) : null;

if (!scanner) {
  console.warn(
    "CLAMAV_HOST is not set — malware scanning is disabled. Uploaded evidence will stay " +
      '"pending" and cannot be downloaded until either a scanner is configured or an admin ' +
      "resolves it manually. See docs/MALWARE_SCANNING.md."
  );
}
