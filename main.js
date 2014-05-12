$(document).ready(function() {
    console.log( "i'm ready now!" );

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

    var apiCallInterval = 1000 / 5
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

    throttle( function() {
        lastfm.artist.getInfo( {"artist": "Electric Light Orchestra"},
                               {  "success": onApiResponse,
                                  "error": onApiError
                               });
    }, apiCallInterval );

    throttle( function() {
        lastfm.artist.getTopTags( {"artist": "Electric Light Orchestra"},
                                  {  "success": onApiResponse,
                                     "error": onApiError
                                  });
    }, apiCallInterval );

    throttle( function() {
        lastfm.track.getInfo( {"artist": "Electric Light Orchestra",
                               "track": "Do Ya"
                              },
                              { "success": onApiResponse,
                                "error": onApiError
                              }
                            );
    }, apiCallInterval );

    throttle( function() {
        lastfm.track.getTopTags( {"artist": "Electric Light Orchestra",
                                  "track": "Do Ya"
                                 },
                                 {  "success": onApiResponse,
                                    "error": onApiError
                                 });
    }, apiCallInterval );

    throttle( function() {
        lastfm.user.getTopArtists( {"user": "aid9990",
                                    "period": "3month",
                                   },
                                   { "success": onApiResponse,
                                     "error": onApiError
                                   }
                                 );
    }, apiCallInterval );

    throttle( function() {
        lastfm.user.getTopTracks( {"user": "aid9990",
                                   "period": "3month",
                                  },
                                  { "success": onApiResponse,
                                    "error": onApiError
                                  }
                                );
    }, apiCallInterval );
});
