import { describe, expect, it } from "vitest";
import postgres from 'postgres'

const sql = postgres("postgres://postgres:postgres@db:5432/postgres")

describe("Test", () => {
    it("First", async () => {
        const users =
            await sql.unsafe("SELECT * FROM information_schema.tables LIMIT 5")

        for (const row of users) {
            console.log(row);

        }
    })
})