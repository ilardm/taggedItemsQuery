$(document).ready(function() {
    console.log( "i'm ready now!" );

    var apiCallInterval = 1000 / 5
    var throttle = function( fn, delay ) {
        var now = (new Date()).getTime();
        var nextExec = window.THROTTLE_NEXT_EXEC;
        if ( nextExec === undefined ) {
            nextExec = now - delay;
        }
        var timeout = nextExec + delay - now;
        window.THROTTLE_NEXT_EXEC = now + timeout;

        setTimeout( function() {
            fn();
        }, timeout);
    }

    var lsPrefix = "taggedItemsQuery_";
    var lsget = function(key) {
        return localStorage.getItem( lsPrefix + key );
    }
    var lsset = function(key, value) {
        localStorage.setItem( lsPrefix + key, value );
    }

    var onApiResponse = function(data) {
        console.log(data);
    }
    var onApiError = function(code, message) {
        console.log(code + " - " + message);
    }

    var cache = new LastFMCache();
    var lastfm = new LastFM({
        apiKey    : '8f35b45c7fff3cbd3c340ee0ee0a80a2',
        apiSecret : 'e98471405d2eb3c1b02c10dea7c30ec2',
        cache     : cache
    });

    var DATACACHE = { artists: {},
                      tracks: {},
                      tags: []
                    };
    var DATACACHEALT = { artists: [],
                         tracks: []
                       };
    var dataCacheStr = lsget("datacache");
    var lastCache = parseInt( lsget("lastcache") );
    var cacheAgeThreshold = 1000 * 60 * 60 * 24 * 7;
    if ( dataCacheStr !== null ) {
        DATACACHE = JSON.parse( dataCacheStr );

        var objToArrConverter = function(obj) {
            return Object.keys( obj ).map( function(itm) {
                return obj[itm];
            });
        }

        DATACACHEALT.artists = objToArrConverter( DATACACHE.artists );
        DATACACHEALT.tracks = objToArrConverter( DATACACHE.tracks );
    }

    var lastfmUser = "aid9990";

    // ---------------------------------------------------------------

    var processTopTags = function(data, getter, setter) {
        var tags = getter("tags");

        for ( var i = 0; i < data.toptags.tag.length; ++i ) {
            (function(tag) {
                if ( tags.indexOf( tag.name ) == -1 ) {
                    tags.push( tag.name );
                }

                if ( DATACACHE.tags.indexOf( tag.name ) == -1 ) {
                    DATACACHE.tags.push( tag.name );
                }
            })(data.toptags.tag[i]);
        }

        setter("tags", tags);
    }

    var processTopTagsOfArtist = function(data, artist) {
        processTopTags(data, function(key) {
            return DATACACHE.artists[artist][key];
        }, function(key, value) {
            DATACACHE.artists[artist][key] = value;

            var idx = DATACACHEALT.artists.indexOf( DATACACHE.artists[artist] );
            if ( idx >= 0 ) {
                DATACACHEALT.artists[idx][key] = value;
            }
        });
    }

    var processTopTagsOfTrack = function(data, track) {
        processTopTags(data, function(key) {
            return DATACACHE.tracks[track][key];
        }, function(key, value) {
            DATACACHE.tracks[track][key] = value;

            var idx = DATACACHEALT.tracks.indexOf( DATACACHE.tracks[track] );
            if ( idx >= 0 ) {
                DATACACHEALT.tracks[idx][key] = value;
            }
        });
    }

    var requestArtistTags = function(artistName) {
        if ( DATACACHE.artists[artistName] === undefined ) {
            var artistObj = { name: artistName,
                              tags: []
                            };
            DATACACHE.artists[artistName] = artistObj;
            DATACACHEALT.artists.push( artistObj );

            throttle(function(){
                lastfm.artist.getTopTags( { "artist": artistName},
                                          { "success": function(data) {
                                              processTopTagsOfArtist(data, artistName);
                                          },
                                            "error": onApiError
                                          });
            }, apiCallInterval);
        }
    }

    var processTopArtists = function(data) {
        for ( var i = 0; i < data.topartists.artist.length; ++i ) {
            (function(artist) {
                requestArtistTags(artist.name);
            })(data.topartists.artist[i]);
        }
    }

    var processTopTracks = function(data) {
        for ( var i = 0; i < data.toptracks.track.length; ++i ) {
            (function(track) {
                if ( DATACACHE.tracks[track.name] === undefined ) {
                    var trackObj = { name: track.name,
                                     artist: track.artist.name,
                                     tags: []
                                   };
                    DATACACHE.tracks[track.name] = trackObj;
                    DATACACHEALT.tracks.push( trackObj );

                    if ( DATACACHE.artists[track.artist.name] === undefined ) {
                        requestArtistTags(track.artist.name);
                    }

                    throttle(function(){
                        lastfm.track.getTopTags( { "artist": track.artist.name,
                                                   "track": track.name
                                                 },
                                                 { "success": function(data) {
                                                     processTopTagsOfTrack(data, track.name);
                                                 },
                                                   "error": onApiError
                                                 });
                    }, apiCallInterval);
                }
            })(data.toptracks.track[i]);
        }
    }

    // ---------------------------------------------------------------

    if ( isNaN(lastCache)
         || ( !isNaN(lastCache)
              && (new Date()).getTime() - lastCache > cacheAgeThreshold
            )
       ) {
        throttle(function(){
            lastfm.user.getTopArtists( {"user": lastfmUser,
                                        "period": "3month",
                                       },
                                       { "success": processTopArtists,
                                         "error": onApiError
                                       }
                                     );
        }, apiCallInterval);

        throttle(function(){
            lastfm.user.getTopTracks( {"user": lastfmUser,
                                       "period": "3month",
                                      },
                                      { "success": processTopTracks,
                                        "error": onApiError
                                      }
                                    );
        }, apiCallInterval);

        lastCache = (new Date()).getTime();
    }

    $(window).unload( function() {
        lsset("datacache", JSON.stringify( DATACACHE ) );
        lsset("lastcache", lastCache );
    });
});
