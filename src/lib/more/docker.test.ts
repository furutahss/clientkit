import { describe, expect, it } from "vitest";

import { composeToRun, parseDockerRun, runToCompose, shellSplit } from "./docker";

describe("docker run ⇄ compose", () => {
  it("シェル風に分割する", () => {
    expect(shellSplit(`a "b c" 'd e' f\\ g h=\\"x\\"`)).toEqual(["a", "b c", "d e", "f g", 'h="x"']);
    expect(shellSplit("a \\\n  b")).toEqual(["a", "b"]);
    expect(() => shellSplit('a "b')).toThrow("unterminated quote");
  });

  it("docker run を解析してcomposeにする", () => {
    const cmd = `docker run -d --name web -p 8080:80 -p 443:443 -v data:/var/lib/app -v ./conf:/etc/conf:ro -e "A=1" -e B=two --restart unless-stopped --network mynet -w /app -u 1000:1000 --memory=512m --cpus 1.5 --privileged --cap-add NET_ADMIN --log-driver json-file nginx:1.25 nginx -g "daemon off;"`;
    const spec = parseDockerRun(cmd);
    expect(spec).toMatchObject({ image: "nginx:1.25", name: "web", ports: ["8080:80", "443:443"], volumes: ["data:/var/lib/app", "./conf:/etc/conf:ro"], env: ["A=1", "B=two"], restart: "unless-stopped", memory: "512m", privileged: true, command: ["nginx", "-g", "daemon off;"] });
    expect(spec.unsupported).toEqual(["--log-driver"]);
    const yaml = runToCompose(spec);
    expect(yaml).toContain("services:\n  web:\n    image: nginx:1.25\n    container_name: web");
    expect(yaml).toContain("    ports:\n      - 8080:80");
    expect(yaml).toContain("mem_limit: 512m");
    expect(yaml).toContain("volumes:\n  data: {}");
    expect(yaml).toContain("networks:\n  mynet:\n    external: true");
  });

  it("docker run でないコマンドは例外", () => {
    expect(() => parseDockerRun("ls -la")).toThrow("not-docker-run");
    expect(() => parseDockerRun("docker run -d")).toThrow("no-image");
    expect(parseDockerRun("docker run -it --rm alpine sh").command).toEqual(["sh"]);
  });

  it("composeからdocker runにする", () => {
    const yaml = `services:
  db:
    image: postgres:16
    ports: ["5432:5432"]
    environment:
      POSTGRES_PASSWORD: secret
    volumes: [pgdata:/var/lib/postgresql/data]
    restart: always
  app:
    build: .
    depends_on: [db]
    command: ["node", "server.js"]
`;
    const [db, app] = composeToRun(yaml);
    expect(db.command).toBe(["docker run -d", "  --name db", "  -p 5432:5432", "  -v pgdata:/var/lib/postgresql/data", "  -e POSTGRES_PASSWORD=secret", "  --restart always", "  postgres:16"].join(" \\\n"));
    expect(app.notes.length).toBe(2);
    expect(app.command).toContain("node server.js");
    expect(() => composeToRun("a: 1")).toThrow("not-compose");
  });
});
