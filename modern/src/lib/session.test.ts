import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session";

describe("session", () => {
  it("lit la session d'un cookie qu'elle a signé", async () => {
    const token = await signSession({ uid: 1, username: "admin" });
    expect(await verifySession(token)).toEqual({ uid: 1, username: "admin" });
  });

  it("refuse un cookie dont le contenu a été modifié", async () => {
    const token = await signSession({ uid: 1, username: "admin" });
    const [, sig] = token.split(".");
    const forged = btoa(JSON.stringify({ uid: 2, username: "comptable" }));
    expect(await verifySession(`${forged}.${sig}`)).toBeNull();
  });

  it("refuse un cookie sans signature", async () => {
    expect(await verifySession("abc")).toBeNull();
  });
});
