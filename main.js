$(document).ready(function() {
    console.log( "i'm ready now!" );

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

    lastfm.artist.getInfo( {"artist": "Electric Light Orchestra"},
                           {  "success": onApiResponse,
                              "error": onApiError
                           });

    lastfm.artist.getTopTags( {"artist": "Electric Light Orchestra"},
                           {  "success": onApiResponse,
                              "error": onApiError
                           });

    lastfm.track.getInfo( {"artist": "Electric Light Orchestra",
                           "track": "Do Ya"
                          },
                          { "success": onApiResponse,
                            "error": onApiError
                          }
                        );

    lastfm.track.getTopTags( {"artist": "Electric Light Orchestra",
                              "track": "Do Ya"
                             },
                             {  "success": onApiResponse,
                                "error": onApiError
                             });

    lastfm.user.getTopArtists( {"user": "aid9990",
                                "period": "3month",
                               },
                               { "success": onApiResponse,
                                 "error": onApiError
                               }
                             );

    lastfm.user.getTopTracks( {"user": "aid9990",
                               "period": "3month",
                              },
                              { "success": onApiResponse,
                                "error": onApiError
                              }
                            );
});
