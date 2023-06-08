import {describe, expect, it} from "vitest";

import {orm} from "./orm";
import {QueryBuilder} from "./query";

class Album {
    constructor(
        readonly albumId: number,
        readonly title: string,
        readonly artistId: number
    ) {
    }
}

const db = orm(ob => {
    ob.model(mb => {
        mb.entity(Album, e => {
            e.property("albumId", p => p.column("AlbumId"))
                .property("title", p => p.column("Title"))
                .property("artistId", p => p.column("ArtistId"));
        });
    });
});

function test<T, A extends unknown[], R>(
    entity: new () => T,
    func: (
        builder: QueryBuilder<T>,
        ...args: A) => QueryBuilder<R>) {
    return (...args: A) => {
        console.log(args[0])
        console.log(args[1])
    }
}

class Person {
    id: number = 42
}

describe("query", () => {
    it("rest", () => {
        const fn = test(Person, (qb, $s: string, $i: number) => qb.map(p => p.id))

        fn("Wow!", 42)
    });

    it("identity", async () => {
        const q = db.query(Album);

        for await (const album of q()) {
            //console.log(album);
        }
    });

    it("map template literal", async () => {
        const q = db.query(Album, (albums, $title: string) =>
            albums.filter(a => a.title == $title).map(a => `Title: ${a.title}!`)
        );

        for await (const str of q("Miles Ahead")) {
            //console.log(str);
        }
    });

    it("map object literal", async () => {
        const q = db.query(Album, (albums, $title: string) =>
            albums
                .where(a => a.title == $title)
                .select(a => ({msg: `Hi ${a.title}!`, sum: a.artistId * 2}))
        );

        for await (const obj of q("Miles Ahead")) {
            console.log(obj);
        }
    });

    it("filter two args", async () => {
        const q = db.query(Album, (albums, $title: string, $albumId: number) =>
            albums.where(a => a.title == $title && a.albumId > $albumId)
        );

        for await (const album of q("Miles Ahead", 42)) {
            //console.log(album);
        }
    });

    it("closure throws", async () => {
        const local = 42;

        expect(() => {
            db.query(Album, albums => albums.where(a => a.albumId == local));
        }).toThrow("Unbound identifier 'local'");
    });
});
