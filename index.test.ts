import { describe, expect, it } from "vitest";

import { orm } from "./orm";

class Album {
    constructor(
        readonly albumId: number,
        readonly title: string,
        readonly artistId: number
    ) {}
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

describe("query", () => {
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
                .select(a => ({ msg: `Hi ${a.title}!`, sum: a.artistId * 2 }))
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
