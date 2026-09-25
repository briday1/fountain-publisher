import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
export function testDB() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  sql.exec(readFileSync(new URL("./accounts.sql", import.meta.url), "utf8"));
  sql.exec(
    readFileSync(new URL("./library-history.sql", import.meta.url), "utf8"),
  );
  sql.exec(
    readFileSync(new URL("./library-sharing.sql", import.meta.url), "utf8"),
  );
  const prepare = (q) => {
    let values = [];
    const statement = {
      bind(...args) {
        values = args;
        return statement;
      },
      async first() {
        return sql.prepare(q).get(...values) || null;
      },
      async all() {
        return { results: sql.prepare(q).all(...values) };
      },
      async run() {
        return { meta: sql.prepare(q).run(...values) };
      },
    };
    return statement;
  };
  return {
    sql,
    DB: {
      prepare,
      async batch(statements) {
        sql.exec("BEGIN");
        try {
          const result = [];
          for (const s of statements) result.push(await s.run());
          sql.exec("COMMIT");
          return result;
        } catch (error) {
          sql.exec("ROLLBACK");
          throw error;
        }
      },
    },
  };
}
export const request = (
  path,
  body,
  cookie = "",
  origin = "https://writeshape.com",
) =>
  new Request("https://writeshape.com" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
