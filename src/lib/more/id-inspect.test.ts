import { describe, expect, it } from "vitest";

import { inspectId, inspectObjectId, inspectSnowflake, inspectUlid, inspectUuid } from "./id-inspect";

const get = (i: { details: [string, string][] } | null, k: string) => i?.details.find(([x]) => x === k)?.[1];

describe("ID解析", () => {
  it("UUID v7 / v1 / v4 を判別し時刻を読む", () => {
    expect(get(inspectUuid("017f22e2-79b0-7cc3-98c4-dc0c0c07398f"), "timestamp (ms)")).toBe("2022-02-22T19:22:22.000Z");
    expect(get(inspectUuid("c232ab00-9414-11ec-b3c8-9f6bdeced846"), "timestamp (100ns)")).toBe("2022-02-22T19:22:22.000Z");
    expect(get(inspectUuid("550e8400-e29b-41d4-a716-446655440000"), "version")).toBe("4");
    expect(inspectUuid("not-a-uuid")).toBeNull();
  });

  it("ULID・ObjectId・Snowflakeを解析する", () => {
    expect(get(inspectUlid("01ARZ3NDEKTSV4RRFFQ69G5FAV"), "timestamp (ms)")).toBe("2016-07-30T23:54:10.259Z");
    expect(inspectUlid("81ARZ3NDEKTSV4RRFFQ69G5FAV")).toBeNull();
    expect(get(inspectObjectId("507f1f77bcf86cd799439011"), "timestamp (s)")).toBe("2012-10-17T21:13:27.000Z");
    const [tw] = inspectSnowflake("1541815603606036480");
    expect(get(tw, "timestamp")).toBe(new Date(Number((1541815603606036480n >> 22n) + 1288834974657n)).toISOString());
    expect(get(tw, "sequence")).toBe("0");
    expect(get(inspectSnowflake("175928847299117063", 0n)[0], "timestamp")).toBe(new Date(Number(175928847299117063n >> 22n)).toISOString());
    expect(get(inspectSnowflake("175928847299117063")[1], "timestamp")).toBe("2016-04-30T11:18:25.796Z");
  });

  it("複数の解釈を返す", () => {
    expect(inspectId("507f1f77bcf86cd799439011").map((i) => i.type)).toEqual(["MongoDB ObjectId"]);
    expect(inspectId("zzz")).toEqual([]);
  });
});
