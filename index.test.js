"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const orm_1 = require("./orm");
class Album {
    albumId;
    title;
    artistId;
    constructor(albumId, title, artistId) {
        this.albumId = albumId;
        this.title = title;
        this.artistId = artistId;
    }
}
const db = (0, orm_1.orm)(ob => {
    ob.model(mb => {
        mb.entity(Album, e => {
            e.property("albumId", p => p.column("AlbumId"))
                .property("title", p => p.column("Title"))
                .property("artistId", p => p.column("ArtistId"));
        });
    });
});
(0, vitest_1.describe)("query", () => {
    (0, vitest_1.it)("identity", async () => {
        const q = db.query(Album);
        for await (const album of q()) {
            //console.log(album);
        }
    });
    (0, vitest_1.it)("map template literal", async () => {
        const q = db.query(Album, (albums, $title) => albums.filter(a => a.title == $title).map(a => `Title: ${a.title}!`));
        for await (const str of q("Miles Ahead")) {
            //console.log(str);
        }
    });
    (0, vitest_1.it)("map object literal", async () => {
        const q = db.query(Album, (albums, $title) => albums
            .where(a => a.title == $title)
            .select(a => ({ msg: `Hi ${a.title}!`, sum: a.artistId * 2 })));
        for await (const obj of q("Miles Ahead")) {
            console.log(obj);
        }
    });
    (0, vitest_1.it)("filter two args", async () => {
        const q = db.query(Album, (albums, $title, $albumId) => albums.where(a => a.title == $title && a.albumId > $albumId));
        for await (const album of q("Miles Ahead", 42)) {
            //console.log(album);
        }
    });
    (0, vitest_1.it)("closure throws", async () => {
        const local = 42;
        (0, vitest_1.expect)(() => {
            db.query(Album, albums => albums.where(a => a.albumId == local));
        }).toThrow("Unbound identifier 'local'");
    });
});
