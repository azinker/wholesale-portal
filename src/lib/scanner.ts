import * as net from "net";

export type ScanResult = {
  clean: boolean;
  detail: string;
};

/**
 * Scan a buffer against ClamAV using the INSTREAM protocol.
 *
 * Protocol:
 * 1. Send "zINSTREAM\0"
 * 2. Send chunks: 4-byte big-endian length + data
 * 3. Send terminator: 4 zero bytes
 * 4. Read response: "stream: OK\0" or "stream: <virus> FOUND\0"
 */
export async function scanBuffer(buffer: Buffer): Promise<ScanResult> {
  const host = process.env.CLAMAV_HOST || "localhost";
  const port = parseInt(process.env.CLAMAV_PORT || "3310", 10);

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("ClamAV scan timed out (30s)"));
    }, 30_000);

    let response = "";

    socket.connect(port, host, () => {
      // Send INSTREAM command
      socket.write("zINSTREAM\0");

      // Send file data in chunks (max 2MB per chunk)
      const CHUNK_SIZE = 2 * 1024 * 1024;
      for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
        const chunk = buffer.subarray(offset, offset + CHUNK_SIZE);
        const sizeHeader = Buffer.alloc(4);
        sizeHeader.writeUInt32BE(chunk.length, 0);
        socket.write(sizeHeader);
        socket.write(chunk);
      }

      // Send terminator (zero-length chunk)
      const terminator = Buffer.alloc(4);
      terminator.writeUInt32BE(0, 0);
      socket.write(terminator);
    });

    socket.on("data", (data) => {
      response += data.toString();
    });

    socket.on("end", () => {
      clearTimeout(timeout);
      const trimmed = response.trim().replace(/\0/g, "");

      if (trimmed.includes("OK")) {
        resolve({ clean: true, detail: trimmed });
      } else if (trimmed.includes("FOUND")) {
        resolve({ clean: false, detail: trimmed });
      } else {
        // ClamAV returned unexpected response
        resolve({ clean: false, detail: `Unexpected ClamAV response: ${trimmed}` });
      }
    });

    socket.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`ClamAV connection failed: ${err.message}`));
    });
  });
}
